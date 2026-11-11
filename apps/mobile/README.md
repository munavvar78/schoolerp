# BharatVidya mobile

Native Expo app for the SchoolERP API. It uses the same login, roles, and `@school-erp/shared` schemas as the web app. Navigation is Expo Router (bottom tabs plus a native stack), not a web view.

## Run

From the repo root, with the API already listening on port 4000:

```bash
pnpm --filter @school-erp/shared build
pnpm --filter @school-erp/mobile start
```

Then press `w` to open it in the browser, `a` for Android, or scan the QR code with Expo Go. iOS needs a Mac.

`EXPO_PUBLIC_API_URL` defaults to `http://localhost:4000/api`. The app reads it from the repo root `.env` or `apps/mobile/.env`.

| Device | API URL |
| --- | --- |
| iOS simulator | `http://localhost:4000/api` |
| Android emulator | `http://10.0.2.2:4000/api` |
| Physical phone | `http://<your-computer-lan-ip>:4000/api` |

Demo password is `Password123!` (`admin@`, `teacher@`, `accounts@`, `parent@bharatvidya.edu`).

Cleartext HTTP is allowed so a phone can reach the local API. Point the URL at HTTPS before a store build.

## Screens

Tabs follow the signed-in role and enabled modules.

- **Home** — campus snapshot for staff (strength, fees, attendance, subject averages, optional AI ask). Parents and students see linked children, dues, notices, and homework.
- **Students / Children** — searchable directory, or linked children. Detail shows class, guardians, and attendance rate.
- **Attendance** — class roster, present / absent / late, save. Shown to owners, admins, and teachers.
- **Fees** — outstanding demands. Accounts, admins, and owners can record a payment. Parents see their child’s dues.
- **Notices** — inbox, mark read, and campus notices for staff.
- **Homework** — list, and a new-assignment form for teachers.
- **Timetable** — your periods, or a class. Parents see their child’s section.
- **Exams** — list and published results.
- **Admissions** — application list. Admins can move status using the shared transition rules.
- **Online exams** — staff status and join codes. The proctored attempt stays in the browser.
- **Profile** — campus, API host, sign out.

Academic setup, bulk student import, fee-structure editing, exam score entry, and converting an admission into a student stay on the web app.
