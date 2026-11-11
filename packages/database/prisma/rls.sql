-- Defense-in-depth RLS. Application still scopes every query by organizationId.
-- Apply after prisma db push. Policies use session GUC app.organization_id.

ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeDemand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Exam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Guardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeStructure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademicSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Grade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiQueryLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_tenant ON "Student";
CREATE POLICY student_tenant ON "Student"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS fee_demand_tenant ON "FeeDemand";
CREATE POLICY fee_demand_tenant ON "FeeDemand"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS payment_tenant ON "Payment";
CREATE POLICY payment_tenant ON "Payment"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS exam_tenant ON "Exam";
CREATE POLICY exam_tenant ON "Exam"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS guardian_tenant ON "Guardian";
CREATE POLICY guardian_tenant ON "Guardian"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS fee_structure_tenant ON "FeeStructure";
CREATE POLICY fee_structure_tenant ON "FeeStructure"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS session_tenant ON "AcademicSession";
CREATE POLICY session_tenant ON "AcademicSession"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS grade_tenant ON "Grade";
CREATE POLICY grade_tenant ON "Grade"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS audit_tenant ON "AuditLog";
CREATE POLICY audit_tenant ON "AuditLog"
  USING (
    "organizationId" IS NULL
    OR "organizationId" = current_setting('app.organization_id', true)
  );

DROP POLICY IF EXISTS ai_query_tenant ON "AiQueryLog";
CREATE POLICY ai_query_tenant ON "AiQueryLog"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "AdmissionApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PeriodSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Homework" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notice" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admission_tenant ON "AdmissionApplication";
CREATE POLICY admission_tenant ON "AdmissionApplication"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS period_slot_tenant ON "PeriodSlot";
CREATE POLICY period_slot_tenant ON "PeriodSlot"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS timetable_tenant ON "TimetableEntry";
CREATE POLICY timetable_tenant ON "TimetableEntry"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS homework_tenant ON "Homework";
CREATE POLICY homework_tenant ON "Homework"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS notice_tenant ON "Notice";
CREATE POLICY notice_tenant ON "Notice"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "CampusGstProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnlinePaymentOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gst_profile_tenant ON "CampusGstProfile";
CREATE POLICY gst_profile_tenant ON "CampusGstProfile"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS tax_invoice_tenant ON "TaxInvoice";
CREATE POLICY tax_invoice_tenant ON "TaxInvoice"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS online_payment_tenant ON "OnlinePaymentOrder";
CREATE POLICY online_payment_tenant ON "OnlinePaymentOrder"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS certificate_tenant ON "Certificate";
CREATE POLICY certificate_tenant ON "Certificate"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "LibraryBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryCopy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryLoan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransportRoute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransportAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HostelRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HostelAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollSlip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageDispatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrivacyRequest" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_book_tenant ON "LibraryBook";
CREATE POLICY library_book_tenant ON "LibraryBook"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS library_copy_tenant ON "LibraryCopy";
CREATE POLICY library_copy_tenant ON "LibraryCopy"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS library_loan_tenant ON "LibraryLoan";
CREATE POLICY library_loan_tenant ON "LibraryLoan"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS transport_route_tenant ON "TransportRoute";
CREATE POLICY transport_route_tenant ON "TransportRoute"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS transport_assignment_tenant ON "TransportAssignment";
CREATE POLICY transport_assignment_tenant ON "TransportAssignment"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS inventory_item_tenant ON "InventoryItem";
CREATE POLICY inventory_item_tenant ON "InventoryItem"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS inventory_movement_tenant ON "InventoryMovement";
CREATE POLICY inventory_movement_tenant ON "InventoryMovement"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS hostel_room_tenant ON "HostelRoom";
CREATE POLICY hostel_room_tenant ON "HostelRoom"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS hostel_allocation_tenant ON "HostelAllocation";
CREATE POLICY hostel_allocation_tenant ON "HostelAllocation"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS staff_profile_tenant ON "StaffProfile";
CREATE POLICY staff_profile_tenant ON "StaffProfile"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS leave_request_tenant ON "LeaveRequest";
CREATE POLICY leave_request_tenant ON "LeaveRequest"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS payroll_slip_tenant ON "PayrollSlip";
CREATE POLICY payroll_slip_tenant ON "PayrollSlip"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS message_dispatch_tenant ON "MessageDispatch";
CREATE POLICY message_dispatch_tenant ON "MessageDispatch"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS privacy_request_tenant ON "PrivacyRequest";
CREATE POLICY privacy_request_tenant ON "PrivacyRequest"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));
