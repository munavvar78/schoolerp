import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canAllocateBed,
  canAssignSeat,
  canIssueLoan,
  canRequestLeave,
  computePayroll,
  erasureDisposition,
  gateOutboundMessage,
  nextStock,
  validateApaar,
} from '@school-erp/shared';
import { appConfig } from '../config.js';
import { studentIdsForUser } from '../common/family.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { deliverMessage, providerReady, statusAfterDelivery } from './messaging.js';

type Actor = { role: string; userId: string };

@Injectable()
export class CampusOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async setApaar(organizationId: string, campusId: string, input: ApaarUpdateInput) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, organizationId, campusId },
    });
    if (!student) throw new NotFoundException('Student not found');
    const apaar = validateApaar(input.status, input.apaarId);
    if (!apaar.ok) throw new BadRequestException(apaar.message);
    return this.prisma.student.update({
      where: { id: student.id },
      data: { apaarStatus: input.status, apaarId: apaar.apaarId },
      select: { id: true, firstName: true, lastName: true, apaarStatus: true, apaarId: true },
    });
  }

  async listBooks(organizationId: string, campusId: string) {
    return this.prisma.libraryBook.findMany({
      where: { organizationId, campusId },
      include: { copies: { include: { loans: { where: { returnedAt: null }, select: { id: true } } } } },
      orderBy: { title: 'asc' },
    });
  }

  async addBook(
    organizationId: string,
    campusId: string,
    input: { title: string; author?: string; barcode: string },
  ) {
    return this.prisma.libraryBook.create({
      data: {
        organizationId,
        campusId,
        title: input.title,
        author: input.author,
        copies: { create: { organizationId, campusId, barcode: input.barcode } },
      },
      include: { copies: true },
    });
  }

  async loanCopy(organizationId: string, campusId: string, input: LibraryLoanInput) {
    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: input.copyId, organizationId, campusId },
      include: { loans: { where: { returnedAt: null } } },
    });
    if (!copy) throw new NotFoundException('Copy not found');
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, organizationId, campusId },
    });
    if (!student) throw new NotFoundException('Student not found');
    const overdue = await this.prisma.libraryLoan.count({
      where: {
        organizationId,
        studentId: input.studentId,
        returnedAt: null,
        dueOn: { lt: new Date() },
      },
    });
    const decision = canIssueLoan({
      copyOnLoan: copy.loans.length > 0,
      overdueLoans: overdue,
    });
    if (!decision.ok) throw new BadRequestException(decision.message);
    return this.prisma.libraryLoan.create({
      data: {
        organizationId,
        campusId,
        copyId: copy.id,
        studentId: student.id,
        dueOn: new Date(input.dueOn),
      },
    });
  }

  async returnLoan(organizationId: string, campusId: string, loanId: string) {
    const loan = await this.prisma.libraryLoan.findFirst({
      where: { id: loanId, organizationId, campusId, returnedAt: null },
    });
    if (!loan) throw new NotFoundException('Open loan not found');
    return this.prisma.libraryLoan.update({
      where: { id: loan.id },
      data: { returnedAt: new Date() },
    });
  }

  async listRoutes(organizationId: string, campusId: string, actor: Actor) {
    const family =
      actor.role === 'PARENT' || actor.role === 'STUDENT'
        ? await studentIdsForUser(this.prisma, organizationId, actor.userId)
        : null;
    return this.prisma.transportRoute.findMany({
      where: {
        organizationId,
        campusId,
        ...(family
          ? { assignments: { some: { active: true, studentId: { in: family } } } }
          : {}),
      },
      include: {
        assignments: {
          where: {
            active: true,
            ...(family ? { studentId: { in: family } } : {}),
          },
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async addRoute(organizationId: string, campusId: string, input: { name: string; capacity: number }) {
    return this.prisma.transportRoute.create({
      data: { organizationId, campusId, name: input.name, capacity: input.capacity },
    });
  }

  async assignSeat(organizationId: string, campusId: string, input: TransportAssignInput) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: input.routeId, organizationId, campusId },
      include: { assignments: { where: { active: true } } },
    });
    if (!route) throw new NotFoundException('Route not found');
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, organizationId, campusId },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (route.assignments.some((row) => row.studentId === student.id)) {
      throw new BadRequestException('Student is already on this route');
    }
    const decision = canAssignSeat(route.assignments.length, route.capacity);
    if (!decision.ok) throw new BadRequestException(decision.message);
    return this.prisma.transportAssignment.upsert({
      where: { routeId_studentId: { routeId: route.id, studentId: input.studentId } },
      create: { organizationId, campusId, routeId: route.id, studentId: input.studentId, active: true },
      update: { active: true },
    });
  }

  async listInventory(organizationId: string, campusId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { organizationId, campusId },
      orderBy: { name: 'asc' },
    });
  }

  async addItem(organizationId: string, campusId: string, input: { sku: string; name: string }) {
    return this.prisma.inventoryItem.create({
      data: { organizationId, campusId, sku: input.sku, name: input.name, onHand: 0 },
    });
  }

  async moveStock(organizationId: string, campusId: string, input: InventoryMoveInput) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: input.itemId, organizationId, campusId },
      });
      if (!item) throw new NotFoundException('Item not found');
      const stock = nextStock(item.onHand, input.quantityDelta);
      if (!stock.ok) throw new BadRequestException(stock.message);
      await tx.inventoryMovement.create({
        data: {
          organizationId,
          campusId,
          itemId: item.id,
          quantityDelta: input.quantityDelta,
          reason: input.reason,
        },
      });
      return tx.inventoryItem.update({
        where: { id: item.id },
        data: { onHand: stock.onHand },
      });
    });
  }

  async listRooms(organizationId: string, campusId: string) {
    return this.prisma.hostelRoom.findMany({
      where: { organizationId, campusId },
      include: { allocations: { where: { active: true }, select: { id: true, studentId: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async addRoom(organizationId: string, campusId: string, input: { name: string; beds: number }) {
    return this.prisma.hostelRoom.create({
      data: { organizationId, campusId, name: input.name, beds: input.beds },
    });
  }

  async assignBed(organizationId: string, campusId: string, input: HostelAssignInput) {
    const room = await this.prisma.hostelRoom.findFirst({
      where: { id: input.roomId, organizationId, campusId },
      include: { allocations: { where: { active: true } } },
    });
    if (!room) throw new NotFoundException('Room not found');
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, organizationId, campusId },
    });
    if (!student) throw new NotFoundException('Student not found');
    const elsewhere = await this.prisma.hostelAllocation.findFirst({
      where: { organizationId, studentId: student.id, active: true },
    });
    if (elsewhere) throw new BadRequestException('Student already has a bed');
    const decision = canAllocateBed(room.allocations.length, room.beds);
    if (!decision.ok) throw new BadRequestException(decision.message);
    return this.prisma.hostelAllocation.create({
      data: { organizationId, campusId, roomId: room.id, studentId: student.id, active: true },
    });
  }

  async listStaff(organizationId: string, campusId: string) {
    return this.prisma.staffProfile.findMany({
      where: { organizationId, campusId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { employeeCode: 'asc' },
    });
  }

  async addStaff(organizationId: string, campusId: string, input: StaffProfileInput) {
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, organizationId },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.staffProfile.create({
      data: {
        organizationId,
        campusId,
        userId: user.id,
        employeeCode: input.employeeCode,
        basicPaise: input.basicPaise,
        hraPaise: input.hraPaise,
      },
    });
  }

  async listLeave(organizationId: string, campusId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { organizationId, campusId },
      include: { staff: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async requestLeave(organizationId: string, campusId: string, input: LeaveRequestInput) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: input.staffId, organizationId, campusId },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    const decision = canRequestLeave(staff.leaveBalance, input.days);
    if (!decision.ok) throw new BadRequestException(decision.message);
    return this.prisma.leaveRequest.create({
      data: {
        organizationId,
        campusId,
        staffId: staff.id,
        days: input.days,
        startDate: new Date(input.startDate),
      },
    });
  }

  async decideLeave(organizationId: string, campusId: string, id: string, approve: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findFirst({
        where: { id, organizationId, campusId, status: 'PENDING' },
      });
      if (!request) throw new NotFoundException('Pending leave not found');
      if (!approve) {
        return tx.leaveRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
      }
      const staff = await tx.staffProfile.findFirst({
        where: { id: request.staffId, organizationId },
      });
      if (!staff) throw new NotFoundException('Staff profile not found');
      const decision = canRequestLeave(staff.leaveBalance, request.days);
      if (!decision.ok) throw new BadRequestException(decision.message);
      await tx.staffProfile.update({
        where: { id: staff.id },
        data: { leaveBalance: staff.leaveBalance - request.days },
      });
      return tx.leaveRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } });
    });
  }

  async listPayroll(organizationId: string, campusId: string) {
    return this.prisma.payrollSlip.findMany({
      where: { organizationId, campusId },
      include: { staff: { include: { user: { select: { name: true } } } } },
      orderBy: { periodLabel: 'desc' },
    });
  }

  async computeSlip(organizationId: string, campusId: string, input: PayrollRunInput) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: input.staffId, organizationId, campusId },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    const slip = computePayroll({ basicPaise: staff.basicPaise, hraPaise: staff.hraPaise });
    try {
      return await this.prisma.payrollSlip.create({
        data: {
          organizationId,
          campusId,
          staffId: staff.id,
          periodLabel: input.periodLabel,
          basicPaise: slip.basicPaise,
          hraPaise: slip.hraPaise,
          pfPaise: slip.pfPaise,
          grossPaise: slip.grossPaise,
          netPaise: slip.netPaise,
        },
      });
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new BadRequestException('A slip already exists for that month');
      }
      throw error;
    }
  }

  async queueMessage(organizationId: string, campusId: string, input: OutboundMessageInput) {
    const configured = providerReady(input.channel, appConfig);
    const gate = gateOutboundMessage({ consent: input.consent, configured });
    const row = await this.prisma.messageDispatch.create({
      data: {
        organizationId,
        campusId,
        channel: input.channel,
        recipient: input.recipient,
        body: input.body,
        consent: input.consent,
        status: gate.status === 'READY' ? 'READY' : gate.status,
      },
    });
    if (gate.status !== 'READY') return row;
    try {
      const result = await deliverMessage({
        channel: input.channel,
        recipient: input.recipient,
        body: input.body,
        config: appConfig,
      });
      return this.prisma.messageDispatch.update({
        where: { id: row.id },
        data: { status: statusAfterDelivery(result.delivered) },
      });
    } catch {
      return this.prisma.messageDispatch.update({
        where: { id: row.id },
        data: { status: 'FAILED' },
      });
    }
  }

  async listMessages(organizationId: string, campusId: string) {
    return this.prisma.messageDispatch.findMany({
      where: { organizationId, campusId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        channel: true,
        recipient: true,
        body: true,
        consent: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async requestPrivacy(organizationId: string, userId: string, kind: 'EXPORT' | 'ERASURE') {
    if (kind === 'EXPORT') {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, organizationId },
        select: {
          id: true,
          email: true,
          name: true,
          memberships: { select: { role: true, campusId: true } },
          guardian: { select: { name: true, phone: true, email: true } },
        },
      });
      if (!user) throw new NotFoundException('User not found');
      const request = await this.prisma.privacyRequest.create({
        data: {
          organizationId,
          userId,
          kind: 'EXPORT',
          status: 'FULFILLED',
          reason: 'Export of account profile',
        },
      });
      return { request, export: user };
    }
    const disposition = erasureDisposition();
    const request = await this.prisma.privacyRequest.create({
      data: {
        organizationId,
        userId,
        kind: 'ERASURE',
        status: disposition.status,
        reason: disposition.reason,
      },
    });
    return { request, retained: ['FeeDemand', 'Payment', 'TaxInvoice', 'PayrollSlip'] };
  }
}

type ApaarUpdateInput = { studentId: string; status: 'MISSING' | 'ISSUED' | 'REFUSED' | 'NOGEN'; apaarId?: string };
type LibraryLoanInput = { copyId: string; studentId: string; dueOn: string };
type TransportAssignInput = { routeId: string; studentId: string };
type InventoryMoveInput = { itemId: string; quantityDelta: number; reason: string };
type HostelAssignInput = { roomId: string; studentId: string };
type StaffProfileInput = { userId: string; employeeCode: string; basicPaise: number; hraPaise: number };
type LeaveRequestInput = { staffId: string; days: number; startDate: string };
type PayrollRunInput = { staffId: string; periodLabel: string };
type OutboundMessageInput = { channel: 'SMS' | 'WHATSAPP'; recipient: string; body: string; consent: boolean };
