import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  createOnlineOrderSchema,
  feeHeadSchema,
  feeStructureSchema,
  generateDemandsSchema,
  gstProfileSchema,
  issueInvoiceSchema,
  recordPaymentSchema,
} from '@school-erp/shared';
import type { Request } from 'express';
import { Ctx, Public, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { BillingService } from './billing.service.js';
import { FeesService } from './fees.service.js';

@RequireModule('fees')
@Controller('fees')
export class FeesController {
  constructor(
    private readonly fees: FeesService,
    private readonly billing: BillingService,
  ) {}

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Get('heads')
  heads(@Ctx() ctx: RequestContext) {
    return this.fees.listHeads(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Post('heads')
  createHead(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(feeHeadSchema)) body: unknown,
  ) {
    return this.fees.createHead(ctx.organizationId, ctx.campusId, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Get('structures')
  structures(@Ctx() ctx: RequestContext) {
    return this.fees.listStructures(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Post('structures')
  createStructure(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(feeStructureSchema)) body: unknown,
  ) {
    return this.fees.createStructure(ctx.organizationId, ctx.campusId, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Post('demands/generate')
  generate(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(generateDemandsSchema)) body: unknown,
  ) {
    return this.fees.generateDemands(ctx.organizationId, ctx.user.id, body as never);
  }

  @Get('outstanding')
  outstanding(@Ctx() ctx: RequestContext) {
    return this.fees.outstanding(ctx.organizationId, ctx.campusId, {
      role: ctx.role,
      userId: ctx.user.id,
    });
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Post('payments')
  async payment(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: unknown,
  ) {
    const payment = await this.fees.recordPayment(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
    return this.withInvoice(ctx, payment.id, payment);
  }

  @Get('summary')
  summary(@Ctx() ctx: RequestContext) {
    return this.fees.collectionSummary(ctx.organizationId, ctx.campusId, {
      role: ctx.role,
      userId: ctx.user.id,
    });
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Get('gst-profile')
  gstProfile(@Ctx() ctx: RequestContext) {
    return this.billing.getProfile(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Post('gst-profile')
  saveGstProfile(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(gstProfileSchema)) body: unknown,
  ) {
    return this.billing.saveProfile(ctx.organizationId, ctx.campusId, ctx.user.id, body as never);
  }

  @Get('invoices')
  invoices(@Ctx() ctx: RequestContext) {
    return this.billing.listInvoices(ctx.organizationId, ctx.campusId, {
      role: ctx.role,
      userId: ctx.user.id,
    });
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Post('invoices')
  issueInvoice(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(issueInvoiceSchema)) body: { paymentId: string; buyerStateCode?: string },
  ) {
    return this.billing.issueForPayment(
      ctx.organizationId,
      ctx.campusId,
      body.paymentId,
      body.buyerStateCode,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT', 'PARENT')
  @Post('orders')
  createOrder(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(createOnlineOrderSchema)) body: unknown,
  ) {
    return this.billing.createOrder(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      ctx.role,
      body as never,
    );
  }

  @Public()
  @Get('checkout/:token')
  checkout(@Param('token') token: string) {
    return this.billing.checkout(token);
  }

  @Public()
  @Post('webhooks/razorpay')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('Missing raw body');
    return this.billing.handleWebhook(req.rawBody, signature);
  }

  private async withInvoice(ctx: RequestContext, paymentId: string, payment: { id: string }) {
    try {
      const invoice = await this.billing.issueForPayment(ctx.organizationId, ctx.campusId, paymentId);
      return { payment, invoice, invoiceWarning: null };
    } catch (error) {
      if (error instanceof BadRequestException) {
        const response = error.getResponse();
        const invoiceWarning =
          typeof response === 'string'
            ? response
            : response && typeof response === 'object' && 'message' in response
              ? String((response as { message: unknown }).message)
              : 'Invoice was not issued';
        return { payment, invoice: null, invoiceWarning };
      }
      return { payment, invoice: null, invoiceWarning: 'Invoice was not issued' };
    }
  }
}
