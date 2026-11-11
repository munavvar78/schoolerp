# BharatVidya School ERP (Phase 1 + Phase 2)

Multi-school SaaS ERP for India: tenancy, dynamic academic setup, students, attendance, fees, exams, parent portal, chart dashboards, AI copilot v1, plus Phase 2 admissions, timetable, homework, and in-app notices.

## Stack

- **Monorepo:** pnpm + Turborepo
- **Web:** Next.js App Router, Tailwind, Recharts
- **API:** NestJS, Zod validation, JWT + httpOnly refresh cookie
- **Data:** PostgreSQL (Prisma), Redis available for later jobs
- **Tests:** Vitest (domain + tenant contract), Playwright (daily loop + Phase 2 ops)

## Quick start

```bash
docker compose up -d
pnpm install
pnpm --filter @school-erp/shared build
pnpm --filter @school-erp/database generate
pnpm --filter @school-erp/database push
pnpm --filter @school-erp/database seed
# optional RLS (Postgres is published on host port 5434):
Get-Content packages/database/prisma/rls.sql | docker exec -i school-erp-postgres-1 psql -U schoolerp -d schoolerp
pnpm --filter @school-erp/api dev
pnpm --filter @school-erp/web dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/health
- Postgres: `127.0.0.1:5434` (avoids local Postgres on 5432)

### Demo users (password `Password123!`)

| Email | Role |
|-------|------|
| admin@bharatvidya.edu | Campus admin |
| teacher@bharatvidya.edu | Class teacher |
| accounts@bharatvidya.edu | Accountant |
| parent@bharatvidya.edu | Parent (linked to Aarav Sharma) |
| master@bharatvidya.edu | Master admin |

## Quality gate

```bash
pnpm --filter @school-erp/shared test
pnpm --filter @school-erp/api test
pnpm test:tenant
pnpm test:daily
pnpm --filter @school-erp/web build
pnpm --filter @school-erp/web exec next start -p 3000 -H 127.0.0.1
pnpm test:e2e
```

## Phase map

1. **Done:** daily academic loop + AI v1
2. **Done:** admissions, timetable, homework, notices (feature-flagged modules)
3. **In code, schema applied locally:** Razorpay checkout and signed webhooks, GST invoices, certificates on web and mobile. A parent sees outstanding dues and Pay online. Fee-head, fee-structure, and manual receipt forms stay with the accountant roles on the web.
4. **In code, schema applied locally:** HR, payroll, library, transport, inventory, and hostel. Web and mobile call the same API. A parent or student can see their own transport seats and cannot add a route or assign a seat. Mobile can approve or reject leave. Payroll computes a slip and does not pay a bank. Seed was not run, so these lists start empty until a campus admin adds rows.
5. **Partial:** WhatsApp and SMS stay fail-closed without consent and provider credentials. Web and mobile can queue either channel. When a provider accepts the message, the row is stored as `SENT`. A rejection or a provider error is stored as `FAILED`. Without credentials the row stays `BLOCKED_UNCONFIGURED` and nothing is sent. The copilot requires the `ai` module on the API and on both apps, so a parent or student login cannot read campus-wide facts. An answer only includes figures from modules that login can already open, so a teacher does not receive fee, library, transport, hostel, HR, or inventory totals. Answers still come only from stored campus figures. No model key is configured.
6. **Partial:** A signed-in user can export their profile or file an erasure request. The erasure request stays `OPEN` and does not delete fee, invoice, or payroll rows. Inviting a login stays with the organization owner and the campus admin. A campus admin can invite only onto their own campus, and cannot grant the owner or master-admin role. An email that already belongs to another school is refused. A parent or student dashboard shows only linked students: their fees, attendance, and scores. Open applications and draft notices stay off that dashboard. A student login, which has no fees module, does not show fee totals. Campus admissions and unpublished notices stay at zero for those logins. Homework, notices, and exams hide assign, publish, and score forms for those logins. Notices load the family inbox. Teachers, class teachers, the organization owner, the campus admin, and the master admin see drafts and published notices. The master admin cannot publish. Marking a notice read stays on the inbox. Exam results and subject averages return only linked students. Those averages count published exams only, and unpublished results stay hidden. The exam list for those logins contains only published exams for their grade and session. The students page hides create, enroll, and bulk import unless the role can perform that action. The sample sheet download and the Excel parse route also require an organization owner or campus admin access token. Mobile does not import spreadsheets. A signed-in user who opens a web or mobile address outside their menu is sent home before that screen loads. The GST profile, fee heads, and fee structures stay with the accountant roles. A parent or student transport list contains only routes where that student has a seat. Grade scales, custom field definitions, and campus rules are limited to an organization owner, campus admin, or master admin. Setup forms stay with the organization owner and campus admin. Class lists, sessions, and subjects stay with staff who teach or keep accounts. Attendance status setup stays with the organization owner, campus admin, and master admin. A family invoice list is loaded only for the linked student. Marking a notice read requires that the notice is already visible to that login. A parent or student profile opens only a linked student. Child lists, fee dues, exam results, attendance sheets, and invoices leave out the APAAR id, APAAR status, and custom student fields. The student directory includes those fields only for an organization owner, campus admin, or master admin. For every other staff login, guardian rows keep the name, relation, phone, and email, and leave out the login id and custom guardian fields. APAAR in the web menu and in mobile More is limited to those same roles. Admission create, status changes, and convert-to-student stay with the organization owner and campus admin. Recording an admission fee stays with those roles and the accountant. Mobile can record that fee and does not convert an application into a student. Staff lists and leave lists stay with the organization owner, campus admin, and master admin. Unlocking a locked online exam stays with the organization owner, campus admin, and class teacher. Exam and attendance reads require those modules, so an accountant cannot open them. The dashboard requires the dashboard module. Library and hostel lists stay with the organization owner, campus admin, and master admin. The inventory list stays with those roles and the accountant. A student directory requires the students module, while a parent or student still sees only linked children. The Parent Portal page stays on the parent login. Other roles are sent home from that address, and the page does not load campus exam results for them. Mobile keeps children on Home and the Children tab. A parent or student opens attendance from More on mobile. The class timetable shows that student's section, and another section returns an empty list. Attendance for those logins shows only the linked student, including the day's marks. A local health load passed: 100 of 100 requests to `127.0.0.1:4000/api/health` in 537 ms. Replicas were not provisioned. No production deploy.
7. **In code, schema applied locally:** APAAR status on the student (12-digit ID, REFUSED, or NOGEN). Aadhaar numbers are not stored. Web `/apaar` and mobile More → APAAR.
8. **Done:** A payment cannot exceed the outstanding balance. Manual receipts and online orders both use the shared check. The shared test rejects 65001 paise against a 65000 paise balance.
9. **Done:** Score entry rejects marks above the component maximum, including 81 against a maximum of 80, and negative marks. The copilot answers only from stored campus facts.
10. **In code:** Master admin (`PLATFORM_OPERATOR`) can list every organization and turn modules on or off. Web route `/platform` and mobile More → Master. That role can read the admissions list. Create, status changes, convert, and the admission fee stay with the roles that already have them. Online exams stay off the master admin menu on web and mobile, because that API is limited to campus teaching roles. `pnpm --filter @school-erp/database exec tsx prisma/ensure-platform-admin.ts` was run on the local database. It does not delete school data.
11. **Pending:** The plan line was empty.
12. **Partial:** The project source was copied to `D:\SchoolERP` (284 files). `node_modules`, build caches, and `.env` were left out. GitHub push is blocked: this folder is not a git repository, and the GitHub CLI is not installed. 

## Execution log

- `pnpm --filter @school-erp/shared test`: 59 passed.
- `pnpm --filter @school-erp/shared build`: passed.
- `pnpm --filter @school-erp/database exec prisma validate`: passed.
- `pnpm --filter @school-erp/database exec prisma generate`: passed.
- `pnpm --filter @school-erp/database exec prisma db push`: passed against local Postgres on `127.0.0.1:5434`. No data-loss flag was used. Seed was not run.
- Local row-level security policies were applied, including the new campus tables.
- New module keys were appended on 3 local organizations. Existing keys were kept.
- `pnpm --filter @school-erp/api typecheck`: passed.
- `pnpm --filter @school-erp/api test`: 11 passed.
- `pnpm --filter @school-erp/api build`: passed.
- `pnpm --filter @school-erp/web typecheck`: passed.
- `pnpm --filter @school-erp/mobile typecheck`: passed, including the library return form.
- Compiled API smoke, campus admin: library list 200, SMS without consent `BLOCKED_NO_CONSENT`, WhatsApp with consent but no credentials `BLOCKED_UNCONFIGURED`, erasure request `OPEN`.
- The Next.js production build was not run. The web and mobile screens were not clicked in a browser.
- `pnpm --filter @school-erp/api test:load`: 100 of 100 local health checks passed in 537 ms (max 438 ms). The script refuses any host other than loopback. Replicas were not provisioned. No production database was touched and nothing was deployed.
- Source copy to `D:\SchoolERP` succeeded (284 files, about 1.6 MB). Secrets and dependency folders were not copied.
- GitHub push did not run. There is no `.git` directory and `gh` is not installed.
- `pnpm --filter @school-erp/api test`: 12 passed, including campus fact lines for library, transport, hostel, leave, and stock.
- `pnpm --filter @school-erp/api typecheck`: passed after the copilot fact extension.
- `pnpm --filter @school-erp/shared test`: 60 passed. Payment-above-balance and marks-above-maximum are covered.
- `pnpm --filter @school-erp/shared build`: passed.
- `pnpm --filter @school-erp/api typecheck`: passed after both payment paths call `paymentWithinOutstanding`.
- `pnpm --filter @school-erp/mobile typecheck`: passed after mobile leave approve/reject and a WhatsApp or SMS channel choice.
- `pnpm --filter @school-erp/shared exec vitest run src/roles.test.ts`: passed. Parent and student logins do not have the `ai` module.
- `pnpm --filter @school-erp/web typecheck`: passed after the dashboard hides Ask AI without that module.
- `pnpm --filter @school-erp/api typecheck`: passed after `POST /ai/ask` requires the `ai` module.
- `pnpm --filter @school-erp/api test`: 13 passed. Parent and student dashboards are marked as family scope.
- `pnpm --filter @school-erp/api typecheck`: passed after the family dashboard uses linked students only.
- `pnpm --filter @school-erp/shared exec vitest run src/roles.test.ts`: 2 passed. Parents and students cannot change transport.
- `pnpm --filter @school-erp/shared build`: passed.
- `pnpm --filter @school-erp/web typecheck`: passed after transport write forms are hidden for family logins.
- `pnpm --filter @school-erp/mobile typecheck`: passed with the same transport write gate.
- `pnpm --filter @school-erp/web typecheck`: passed after fee-head, fee-structure, and manual receipt forms are hidden unless the role can record fees.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/web typecheck`: passed after family logins use the notice inbox and no longer see homework, notice, or exam write actions. Exam results for those logins are limited to linked students. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck`, `pnpm --filter @school-erp/web typecheck`, and `pnpm --filter @school-erp/mobile typecheck`: passed after family timetable and attendance stay on the linked student. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/web typecheck`: passed after family exam lists omit drafts and other grades, and student create, enroll, and bulk import stay with the roles that can save them. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/web typecheck` and `pnpm --filter @school-erp/mobile typecheck`: passed after a login is sent home from a page that is not on that role's menu.
- `pnpm --filter @school-erp/api typecheck`, `pnpm --filter @school-erp/web typecheck`, and `pnpm --filter @school-erp/mobile typecheck`: passed after the GST profile is limited to accountant roles and mobile More opens attendance for a parent or student. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/web typecheck`: passed after fee heads and fee structures stay with accountant roles, and a family transport list returns only that student's routes. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/web typecheck`: passed after grade scales, field definitions, and campus rules stay with setup roles, and setup forms stay with the organization owner and campus admin. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/mobile typecheck`: passed after class lists, sessions, and subjects stay off parent and student logins. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/mobile typecheck`: passed after family invoices are queried for the linked student, a notice can be marked read only when it is visible, and a family student profile ignores any other cached student. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck`: passed after child lists, fee dues, exam results, attendance sheets, and invoices omit the APAAR id and custom student fields. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck`, `pnpm --filter @school-erp/web typecheck`, and `pnpm --filter @school-erp/mobile typecheck`: passed after the student directory and the APAAR menu stay with the organization owner, campus admin, and master admin. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/api typecheck`: passed after a teacher or accountant student directory omits guardian login ids and custom guardian fields. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/web typecheck` and `pnpm --filter @school-erp/mobile typecheck`: passed after admission create, status changes, and convert stay with the organization owner and campus admin, and the admission fee stays with those roles plus the accountant.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/api test`: passed after staff and leave lists use the same roles as the staff and leave writes. 13 passed.
- `pnpm --filter @school-erp/web typecheck` and `pnpm --filter @school-erp/mobile typecheck`: passed after unlocking a locked online exam stays with the organization owner, campus admin, and class teacher.
- `pnpm --filter @school-erp/shared exec vitest run src/roles.test.ts`: 3 passed. An accountant does not have the exams or attendance module. A parent still has both.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/api test`: passed after exam, attendance, and dashboard reads require their modules, and library, hostel, and inventory lists use the same roles as their writes. 13 passed.
- `pnpm --filter @school-erp/api typecheck`, `pnpm --filter @school-erp/web typecheck`, and `pnpm --filter @school-erp/mobile typecheck`: passed after a master admin can read admissions and no longer sees Online exams. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/web typecheck`: passed after the Parent Portal stays on the parent login.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/api test`: passed after a parent or student subject average counts published exams only. 13 passed.
- `pnpm --filter @school-erp/web typecheck`: passed after the family dashboard hides open applications, draft notices, and fee totals when that login has no fees module. Mobile family home already omits those campus cards.
- `pnpm --filter @school-erp/api typecheck`, `pnpm --filter @school-erp/web typecheck`, and `pnpm --filter @school-erp/mobile typecheck`: passed after teaching staff and the master admin can read drafts and published notices, and `/verify` redirects to the certificate check. `pnpm --filter @school-erp/api test`: 13 passed.
- `pnpm --filter @school-erp/web typecheck`: passed after the sample sheet download and Excel parse require an organization owner or campus admin token.
- `pnpm --filter @school-erp/api typecheck` and `pnpm --filter @school-erp/api test`: passed after the copilot omits figures from modules the login cannot open. 14 passed.
- `pnpm --filter @school-erp/database generate` and `pnpm --filter @school-erp/database push`: passed on local Postgres. `MessageStatus` gained `SENT`. No data-loss flag was used.
- `pnpm --filter @school-erp/api test` and `pnpm --filter @school-erp/api build`: passed after a provider acceptance is stored as `SENT`. 15 passed.
- `pnpm --filter @school-erp/shared exec vitest run src/roles.test.ts`: 4 passed. A campus admin cannot invite an owner, a master admin, or a user onto another campus.
- `pnpm --filter @school-erp/shared build`, `pnpm --filter @school-erp/api typecheck`, and `pnpm --filter @school-erp/api test`: passed after invite stays with the organization owner and campus admin. 15 passed.
