import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@school-erp/database';
import {
  composeFeeInvoice,
  computeLateFeePaise,
  gstinStateCode,
  isValidGstin,
  paymentWithinOutstanding,
  type LateFeeConfig,
  type Role,
} from '@school-erp/shared';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { appConfig } from '../config.js';
import { FeesService } from './fees.service.js';
import { studentIdsForUser, withoutSensitiveStudentFields } from '../common/family.js';
import {
  capturedPaymentFromWebhook,
  createRazorpayOrder,
  hashCheckoutToken,
  isCheckoutToken,
  newCheckoutToken,
  verifyRazorpaySignature,
} from './razorpay.js';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fees: FeesService,
  ) {}

  getProfile(organizationId: string, campusId: string) {
    return this.prisma.campusGstProfile.findFirst({ where: { organizationId, campusId } });
  }

  async saveProfile(
    organizationId: string,
    campusId: string,
    userId: string,
    input: { legalName: string; gstin: string; address?: string },
  ) {
    const gstin = input.gstin.trim().toUpperCase();
    if (!isValidGstin(gstin)) throw new BadRequestException('Enter a valid 15-character GSTIN');
    const profile = await this.prisma.campusGstProfile.upsert({
      where: { campusId },
      create: {
        organizationId,
        campusId,
        legalName: input.legalName.trim(),
        gstin,
        stateCode: gstinStateCode(gstin),
        address: input.address?.trim() || null,
      },
      update: {
        legalName: input.legalName.trim(),
        gstin,
        stateCode: gstinStateCode(gstin),
        address: input.address?.trim() || null,
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'SAVE_GST_PROFILE',
      entityType: 'CampusGstProfile',
      entityId: profile.id,
    });
    return profile;
  }

  async listInvoices(organizationId: string, campusId: string, scope?: { role: Role; userId: string }) {
    const family = scope?.role === 'PARENT' || scope?.role === 'STUDENT';
    const studentIds = family && scope ? await studentIdsForUser(this.prisma, organizationId, scope.userId) : null;
    const invoices = await this.prisma.taxInvoice.findMany({
      where: {
        organizationId,
        campusId,
        ...(studentIds
          ? { payment: { feeDemand: { enrollment: { studentId: { in: studentIds } } } } }
          : {}),
      },
      include: {
        payment: {
          include: {
            feeDemand: { include: { enrollment: { include: { student: true } } } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
    return invoices.map((invoice) => {
      const student = invoice.payment.feeDemand.enrollment.student;
      return {
        ...invoice,
        payment: {
          ...invoice.payment,
          feeDemand: {
            ...invoice.payment.feeDemand,
            enrollment: {
              ...invoice.payment.feeDemand.enrollment,
              student: withoutSensitiveStudentFields(student),
            },
          },
        },
      };
    });
  }

  async issueForPayment(
    organizationId: string,
    campusId: string,
    paymentId: string,
    buyerStateCode?: string,
  ) {
    const existing = await this.prisma.taxInvoice.findFirst({
      where: { paymentId, organizationId },
    });
    if (existing) return existing;

    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        organizationId,
        feeDemand: { enrollment: { student: { campusId } } },
      },
      include: {
        feeDemand: {
          include: {
            payments: true,
            feeStructure: { include: { lines: { include: { feeHead: true } } } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const demand = payment.feeDemand;
    const alreadyPaidPaise = demand.payments
      .filter((row) => row.id !== payment.id)
      .reduce((sum, row) => sum + row.amountPaise, 0);
    const lateRule = await this.prisma.ruleConfig.findFirst({
      where: { organizationId, campusId, key: 'late_fee' },
      orderBy: { version: 'desc' },
    });
    const lateConfig = (lateRule?.value ?? {
      fixedPaise: 0,
      percent: 0,
      graceDays: 7,
    }) as unknown as LateFeeConfig;
    const principalRemaining = Math.max(0, demand.totalPaise - demand.concessionPaise - alreadyPaidPaise);
    const lateFeePaise = computeLateFeePaise(principalRemaining, demand.dueDate, payment.paidAt, lateConfig);
    const profile = await this.getProfile(organizationId, campusId);
    const sellerStateCode = profile?.stateCode ?? null;
    const resolvedBuyer = buyerStateCode ?? sellerStateCode;
    let draft;
    try {
      draft = composeFeeInvoice({
        lines: demand.feeStructure.lines.map((line) => ({
          code: line.feeHead.code,
          name: line.feeHead.name,
          grossPaise: line.amountPaise,
          gstTreatment: line.feeHead.gstTreatment,
          gstRateBps: line.feeHead.gstRateBps,
        })),
        demandTotalPaise: demand.totalPaise,
        concessionPaise: demand.concessionPaise,
        alreadyPaidPaise,
        lateFeePaise,
        paymentPaise: payment.amountPaise,
        intraState: !sellerStateCode || !resolvedBuyer || sellerStateCode === resolvedBuyer,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not build the invoice';
      throw new BadRequestException(message);
    }
    if (draft.needsGstProfile && !profile) {
      throw new BadRequestException(
        'Save the campus GST profile before issuing an invoice that includes taxable fee heads',
      );
    }

    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const count = await this.prisma.taxInvoice.count({
        where: { organizationId, invoiceNo: { startsWith: prefix } },
      });
      const invoiceNo = `${prefix}${String(count + 1 + attempt).padStart(6, '0')}`;
      try {
        return await this.prisma.taxInvoice.create({
          data: {
            organizationId,
            campusId,
            paymentId: payment.id,
            invoiceNo,
            supply: draft.supply,
            buyerStateCode: buyerStateCode ?? profile?.stateCode ?? '00',
            sellerGstin: profile?.gstin ?? null,
            taxablePaise: draft.taxablePaise,
            exemptPaise: draft.exemptPaise,
            cgstPaise: draft.cgstPaise,
            sgstPaise: draft.sgstPaise,
            igstPaise: draft.igstPaise,
            totalPaise: draft.totalPaise,
            lines: draft.lines as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || attempt === 2) {
          throw error;
        }
      }
    }
    throw new BadRequestException('Could not allocate an invoice number');
  }

  async createOrder(
    organizationId: string,
    campusId: string,
    userId: string,
    role: Role,
    input: { feeDemandId: string; amountPaise: number },
  ) {
    if (!appConfig.razorpayKeyId || !appConfig.razorpayKeySecret) {
      throw new ServiceUnavailableException('Online payments are not configured');
    }
    const rows = await this.fees.outstanding(organizationId, campusId, { role, userId });
    const demand = rows.find((row) => row.id === input.feeDemandId);
    if (!demand) throw new NotFoundException('Fee demand not found');
    const allowed = paymentWithinOutstanding(input.amountPaise, demand.outstandingPaise);
    if (!allowed.ok) throw new BadRequestException(allowed.message);

    const reusable = await this.prisma.onlinePaymentOrder.findFirst({
      where: {
        organizationId,
        campusId,
        feeDemandId: input.feeDemandId,
        amountPaise: input.amountPaise,
        status: 'CREATED',
        checkoutExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    const checkout = newCheckoutToken();
    if (reusable) {
      await this.prisma.onlinePaymentOrder.update({
        where: { id: reusable.id },
        data: { checkoutTokenHash: checkout.hash, checkoutExpiresAt: checkout.expiresAt },
      });
      return this.orderResponse(reusable.id, reusable.razorpayOrderId, input.amountPaise, checkout.token);
    }

    const receipt = `f${Date.now().toString(36)}`.slice(0, 40);
    let razorpayOrderId: string;
    try {
      const created = await createRazorpayOrder({
        keyId: appConfig.razorpayKeyId,
        keySecret: appConfig.razorpayKeySecret,
        amountPaise: input.amountPaise,
        receipt,
        notes: { feeDemandId: input.feeDemandId, organizationId },
      });
      razorpayOrderId = created.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Razorpay order failed';
      throw new BadGatewayException(message);
    }

    const order = await this.prisma.onlinePaymentOrder.create({
      data: {
        organizationId,
        campusId,
        feeDemandId: input.feeDemandId,
        amountPaise: input.amountPaise,
        razorpayOrderId,
        checkoutTokenHash: checkout.hash,
        checkoutExpiresAt: checkout.expiresAt,
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE_ONLINE_ORDER',
      entityType: 'OnlinePaymentOrder',
      entityId: order.id,
      meta: { amountPaise: input.amountPaise },
    });
    return this.orderResponse(order.id, razorpayOrderId, input.amountPaise, checkout.token);
  }

  async checkout(token: string) {
    if (!isCheckoutToken(token)) throw new NotFoundException('Checkout not found');
    const order = await this.prisma.onlinePaymentOrder.findFirst({
      where: { checkoutTokenHash: hashCheckoutToken(token) },
      include: { campus: true },
    });
    if (!order) throw new NotFoundException('Checkout not found');
    const expired = order.status === 'CREATED' && order.checkoutExpiresAt.getTime() <= Date.now();
    const status = expired ? 'EXPIRED' : order.status;
    if (status !== 'CREATED') {
      return {
        status,
        amountPaise: order.amountPaise,
        currency: 'INR' as const,
        campusName: order.campus.name,
      };
    }
    if (!appConfig.razorpayKeyId) {
      throw new ServiceUnavailableException('Online payments are not configured');
    }
    return {
      status,
      amountPaise: order.amountPaise,
      currency: 'INR' as const,
      campusName: order.campus.name,
      keyId: appConfig.razorpayKeyId,
      razorpayOrderId: order.razorpayOrderId,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!appConfig.razorpayWebhookSecret) {
      throw new ServiceUnavailableException('Payment webhooks are not configured');
    }
    if (!verifyRazorpaySignature(rawBody, signature, appConfig.razorpayWebhookSecret)) {
      throw new BadRequestException('Invalid payment signature');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid payment payload');
    }
    const captured = capturedPaymentFromWebhook(parsed);
    if (!captured) return { received: true, ignored: true };

    const order = await this.prisma.onlinePaymentOrder.findFirst({
      where: { razorpayOrderId: captured.orderId },
    });
    if (!order) return { received: true, unknown: true };
    if (order.status === 'PAID') return { received: true, duplicate: true };
    if (captured.amountPaise !== order.amountPaise) {
      await this.prisma.onlinePaymentOrder.update({
        where: { id: order.id },
        data: { status: 'FAILED', failureReason: 'AMOUNT_MISMATCH' },
      });
      await this.audit.log({
        organizationId: order.organizationId,
        action: 'ONLINE_PAYMENT_AMOUNT_MISMATCH',
        entityType: 'OnlinePaymentOrder',
        entityId: order.id,
      });
      return { received: true, failed: true };
    }

    const paymentId = await this.settle(order.id, captured.paymentId);
    if (!paymentId) return { received: true, duplicate: true };
    let invoiceWarning: string | null = null;
    try {
      await this.issueForPayment(order.organizationId, order.campusId, paymentId);
    } catch (error) {
      invoiceWarning = error instanceof BadRequestException ? error.message : 'Invoice was not issued';
    }
    return { received: true, invoiceWarning };
  }

  private async settle(orderId: string, razorpayPaymentId: string): Promise<string | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.onlinePaymentOrder.updateMany({
            where: { id: orderId, status: 'CREATED' },
            data: { status: 'PAID', razorpayPaymentId },
          });
          if (claimed.count !== 1) return null;
          const order = await tx.onlinePaymentOrder.findFirst({ where: { id: orderId } });
          if (!order) return null;
          const count = await tx.payment.count({ where: { organizationId: order.organizationId } });
          const receiptNo = `RCPT-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
          const payment = await tx.payment.create({
            data: {
              organizationId: order.organizationId,
              feeDemandId: order.feeDemandId,
              amountPaise: order.amountPaise,
              method: 'RAZORPAY',
              reference: razorpayPaymentId,
              receiptNo,
            },
          });
          await tx.onlinePaymentOrder.update({
            where: { id: order.id },
            data: { paymentId: payment.id },
          });
          await tx.auditLog.create({
            data: {
              organizationId: order.organizationId,
              action: 'RAZORPAY_PAYMENT',
              entityType: 'Payment',
              entityId: payment.id,
              meta: { amountPaise: order.amountPaise },
            },
          });
          return payment.id;
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || attempt === 1) {
          throw error;
        }
      }
    }
    return null;
  }

  private orderResponse(orderId: string, razorpayOrderId: string, amountPaise: number, token: string) {
    return {
      orderId,
      razorpayOrderId,
      amountPaise,
      currency: 'INR' as const,
      keyId: appConfig.razorpayKeyId,
      checkoutToken: token,
      checkoutPath: `/checkout?token=${token}`,
    };
  }
}
