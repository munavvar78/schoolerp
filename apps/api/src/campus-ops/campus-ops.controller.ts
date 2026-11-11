import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  apaarUpdateSchema,
  hostelAssignSchema,
  hostelRoomSchema,
  inventoryItemSchema,
  inventoryMoveSchema,
  leaveRequestSchema,
  libraryBookSchema,
  libraryLoanSchema,
  outboundMessageSchema,
  payrollRunSchema,
  privacyRequestSchema,
  staffProfileSchema,
  transportAssignSchema,
  transportRouteSchema,
} from '@school-erp/shared';
import { Ctx, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { CampusOpsService } from './campus-ops.service.js';

const STAFF = ['ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR'] as const;
const PAYROLL = ['ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT', 'PLATFORM_OPERATOR'] as const;

@Controller('students')
export class ApaarController {
  constructor(private readonly ops: CampusOpsService) {}

  @Roles(...STAFF)
  @Post('apaar')
  setApaar(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(apaarUpdateSchema)) body: { studentId: string; status: 'MISSING' | 'ISSUED' | 'REFUSED' | 'NOGEN'; apaarId?: string },
  ) {
    return this.ops.setApaar(ctx.organizationId, ctx.campusId, body);
  }
}

@RequireModule('library')
@Controller('library')
export class LibraryController {
  constructor(private readonly ops: CampusOpsService) {}

  @Roles(...STAFF)
  @Get('books')
  books(@Ctx() ctx: RequestContext) {
    return this.ops.listBooks(ctx.organizationId, ctx.campusId);
  }

  @Roles(...STAFF)
  @Post('books')
  addBook(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(libraryBookSchema)) body: { title: string; author?: string; barcode: string },
  ) {
    return this.ops.addBook(ctx.organizationId, ctx.campusId, body);
  }

  @Roles(...STAFF)
  @Post('loans')
  loan(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(libraryLoanSchema)) body: { copyId: string; studentId: string; dueOn: string },
  ) {
    return this.ops.loanCopy(ctx.organizationId, ctx.campusId, body);
  }

  @Roles(...STAFF)
  @Post('loans/:id/return')
  returnLoan(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.ops.returnLoan(ctx.organizationId, ctx.campusId, id);
  }
}

@RequireModule('transport')
@Controller('transport')
export class TransportController {
  constructor(private readonly ops: CampusOpsService) {}

  @Get('routes')
  routes(@Ctx() ctx: RequestContext) {
    return this.ops.listRoutes(ctx.organizationId, ctx.campusId, { role: ctx.role, userId: ctx.user.id });
  }

  @Roles(...STAFF)
  @Post('routes')
  addRoute(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(transportRouteSchema)) body: { name: string; capacity: number },
  ) {
    return this.ops.addRoute(ctx.organizationId, ctx.campusId, body);
  }

  @Roles(...STAFF)
  @Post('assignments')
  assign(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(transportAssignSchema)) body: { routeId: string; studentId: string },
  ) {
    return this.ops.assignSeat(ctx.organizationId, ctx.campusId, body);
  }
}

@RequireModule('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly ops: CampusOpsService) {}

  @Roles(...PAYROLL)
  @Get('items')
  items(@Ctx() ctx: RequestContext) {
    return this.ops.listInventory(ctx.organizationId, ctx.campusId);
  }

  @Roles(...PAYROLL)
  @Post('items')
  addItem(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(inventoryItemSchema)) body: { sku: string; name: string },
  ) {
    return this.ops.addItem(ctx.organizationId, ctx.campusId, body);
  }

  @Roles(...PAYROLL)
  @Post('movements')
  move(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(inventoryMoveSchema)) body: { itemId: string; quantityDelta: number; reason: string },
  ) {
    return this.ops.moveStock(ctx.organizationId, ctx.campusId, body);
  }
}

@RequireModule('hostel')
@Controller('hostel')
export class HostelController {
  constructor(private readonly ops: CampusOpsService) {}

  @Roles(...STAFF)
  @Get('rooms')
  rooms(@Ctx() ctx: RequestContext) {
    return this.ops.listRooms(ctx.organizationId, ctx.campusId);
  }

  @Roles(...STAFF)
  @Post('rooms')
  addRoom(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(hostelRoomSchema)) body: { name: string; beds: number },
  ) {
    return this.ops.addRoom(ctx.organizationId, ctx.campusId, body);
  }

  @Roles(...STAFF)
  @Post('allocations')
  assign(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(hostelAssignSchema)) body: { roomId: string; studentId: string },
  ) {
    return this.ops.assignBed(ctx.organizationId, ctx.campusId, body);
  }
}

@RequireModule('hr')
@Controller('hr')
export class HrController {
  constructor(private readonly ops: CampusOpsService) {}

  @Roles(...STAFF)
  @Get('staff')
  staff(@Ctx() ctx: RequestContext) {
    return this.ops.listStaff(ctx.organizationId, ctx.campusId);
  }

  @Roles(...STAFF)
  @Post('staff')
  addStaff(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(staffProfileSchema))
    body: { userId: string; employeeCode: string; basicPaise: number; hraPaise: number },
  ) {
    return this.ops.addStaff(ctx.organizationId, ctx.campusId, body);
  }

  @Roles(...STAFF)
  @Get('leave')
  leave(@Ctx() ctx: RequestContext) {
    return this.ops.listLeave(ctx.organizationId, ctx.campusId);
  }

  @Roles(...STAFF)
  @Post('leave')
  requestLeave(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(leaveRequestSchema)) body: { staffId: string; days: number; startDate: string },
  ) {
    return this.ops.requestLeave(ctx.organizationId, ctx.campusId, body);
  }

  @Roles(...STAFF)
  @Post('leave/:id/approve')
  approve(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.ops.decideLeave(ctx.organizationId, ctx.campusId, id, true);
  }

  @Roles(...STAFF)
  @Post('leave/:id/reject')
  reject(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.ops.decideLeave(ctx.organizationId, ctx.campusId, id, false);
  }
}

@RequireModule('payroll')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly ops: CampusOpsService) {}

  @Roles(...PAYROLL)
  @Get('slips')
  slips(@Ctx() ctx: RequestContext) {
    return this.ops.listPayroll(ctx.organizationId, ctx.campusId);
  }

  @Roles(...PAYROLL)
  @Post('slips')
  compute(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(payrollRunSchema)) body: { staffId: string; periodLabel: string },
  ) {
    return this.ops.computeSlip(ctx.organizationId, ctx.campusId, body);
  }
}

@RequireModule('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly ops: CampusOpsService) {}

  @Roles(...STAFF)
  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.ops.listMessages(ctx.organizationId, ctx.campusId);
  }

  @Roles(...STAFF)
  @Post()
  send(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(outboundMessageSchema))
    body: { channel: 'SMS' | 'WHATSAPP'; recipient: string; body: string; consent: boolean },
  ) {
    return this.ops.queueMessage(ctx.organizationId, ctx.campusId, body);
  }
}

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly ops: CampusOpsService) {}

  @Post('requests')
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(privacyRequestSchema)) body: { kind: 'EXPORT' | 'ERASURE' },
  ) {
    return this.ops.requestPrivacy(ctx.organizationId, ctx.user.id, body.kind);
  }
}
