# School Management & Information System

Full-stack multi-level school platform: Preschool / Middle / High School with shared core (users, students, parents, attendance, finance, messaging, admin) + level-specific academics.

```
PUBLIC WEBSITE → ONLINE APPLICATION → ADMISSION REVIEW → ENROLLMENT
→ LEVEL/GRADE/SECTION → TEACHER → ATTENDANCE → ASSIGNMENTS → EXAMS
→ RESULTS → REPORT CARD → PROMOTION → NEXT YEAR
```

## Monorepo

```
backend/  - Laravel 12 REST API, Sanctum, Spatie Permissions, Queues
frontend/ - React + TS + Vite + Tailwind v4 + Router + TanStack Query + Axios
```

## Quick Start

### Backend (Laravel 12, PHP 8.2, XAMPP MySQL)
```powershell
cd backend
composer install
cp .env.example .env
php artisan key:generate
# MySQL (XAMPP): CREATE DATABASE smis;
# .env: DB_CONNECTION=mysql, DB_HOST=127.0.0.1, DB_PORT=3306, DB_DATABASE=smis, DB_USERNAME=root, DB_PASSWORD=
php artisan migrate --seed
php artisan serve          # http://localhost:8000
php artisan queue:work     # payment reminders / notifications
```
SQLite fallback for dev: `DB_CONNECTION=sqlite`, `php artisan migrate --seed`.

Default logins (password `password`): `admin@school.et` (super_admin), `principal@school.et`, `academic@school.et`,
`registrar@school.et`, `teacher@school.et`, `accountant@school.et`, `librarian@school.et`, `nurse@school.et`,
`parent@school.et`, `student@school.et`. Seeded by `DemoDataSeeder` (skips if already present).

Key API: `GET /api/health`, `POST /api/v1/auth/login|register`, `GET /api/v1/me`,
CRUD `/api/v1/users|students|attendances|applications|announcements`,
`/api/v1/structure/{levels,grades,sections,years,terms}`,
Finance `/api/v1/invoices|payments|payments/queue|payment-proofs|payment-proofs/{id}/file`,
Messaging `/api/v1/messages|messages/inbox|messages/sent`,
`/api/v1/notifications|notifications/unread-count`, `/api/v1/settings|settings/payment`.

Core tables: users/roles/permissions, school_levels→grades→sections, academic_years→terms→enrollments (history-preserving, never overwrite grade), applications (APP-YYYY-XXXXX → STD-YYYY-XXXXX), attendance+records, assignments, exams+results+preschool_assessments+report_cards, invoices+payments+proofs+verifications+reminders, library/health/transport, conversations/messages/attachments, announcements/notification_logs, audit_logs, school_settings.

Payment flow: Invoice → Parent bank transfer (settings-configured, not hard-coded) → Upload proof → UNDER_VERIFICATION → Accountant Approve/Reject/RequestInfo → VERIFIED → Receipt → Parent notified. Escalation job: Day0 due → Day1/2 reminders → Day5 CONTACT_PARENT task → configurable Final Warning → Admin review (never auto-block child).

### Frontend (React 19 + Vite 6)
```powershell
cd frontend
npm install
npm run dev   # http://localhost:5173
```
Set `VITE_API_URL=http://localhost:8000/api/v1` in `.env`.

Includes: Public homepage (Hero, Programs, Stats, Teachers, News/Events, Contact), Apply Now 4-step + Track (APP-...), Login with demo fallback, DashboardLayout + My Tasks, 8 role dashboards, Students list, Attendance grid, Finance + proof upload, Messages (Inbox/Sent/Starred, context-aware), Applications pipeline.

## Roles
super_admin, school_admin, principal, academic_coordinator, registrar, teacher, accountant, librarian, nurse, parent, student — unlimited accounts per role, permission-based (`students.view`, `attendance.mark`, `grades.publish`, `payments.approve`, etc.).
## Status / Next
Done: Library borrowing, Health visits, Transport routes, Timetable conflict-check (teacher/section/room),
report card generation + print + PDF download (`GET /api/v1/report-cards/{id}/pdf`, dompdf),
CSV **and** XLSX report export (`/api/v1/reports/export.csv|.xlsx`, OpenSpout), payment proof verification
workflow, notifications, school settings, role-aware messaging, Telegram/SMS delivery channels,
PWA install + offline shell.

### User accounts
Any number of accounts can exist per role — there is no cap. Super Admin/Principal manage them at
`/dashboard/users`:

- `GET /api/v1/roles` — every role with its permission count.
- `POST /api/v1/users` — create one; `POST /api/v1/users/bulk` — create up to 200 per call (all-or-nothing
  inside a transaction, so a single bad row creates nothing). Call it repeatedly for larger intakes.
- Edit, suspend/activate, reset password, soft delete.
- **Safety:** the last active `super_admin` cannot be suspended, deleted, or demoted (HTTP 422) — otherwise
  nobody could administer accounts. Promote a second super admin first to make changes.

Report cards and PDFs are ownership-scoped: staff see all, students/parents only their own.

### Notification channels
`database` (in-app feed) is always on. `telegram` and `sms` are pluggable drivers
(`app/Services/Notifications/`) driven by `config/notifications.php` + env vars, disabled by default.
A delivery that cannot happen is recorded as `failed` on `notification_logs` rather than thrown, so a
provider outage never breaks the request that triggered it. Users manage opt-ins at
`GET/PUT /api/v1/notifications/{channels,preferences}`; staff set credentials in `.env`
(`TELEGRAM_*`, `SMS_*`).

### Dark mode
Every screen supports light/dark. The toggle in the dashboard header and public navbar switches
immediately; Settings → Appearance offers Light / Dark / System. The choice persists in
`localStorage` (`smis_theme`) and follows the OS when set to System, applied by a small inline
script in `index.html` so there is no flash of the light theme on load. Implemented with Tailwind's
class-based `@custom-variant dark` plus a `dark:` counterpart on every color utility. Printed pages
and report cards always render on white regardless of theme.

### PWA / offline
Installable via `public/manifest.webmanifest`; `public/sw.js` precaches the app shell and build assets
(cache-first) with network-first navigations. **API/auth/dashboard routes are never cached** — stale
attendance, grades, or fee data is worse than an error — and a banner plus header pill warn when offline.
The service worker only registers in production builds.

Not started: websocket realtime (Reverb). Notifications currently use ~15s polling + refetch on
focus/reconnect; a broker would make it push-based.

## Tooling
```powershell
# backend
php artisan test
php vendor\bin\pint            # formats; pint --test to check
# frontend  (npm run build is broken on this path — the folder name contains a space and '&')
node ".\node_modules\typescript\bin\tsc" -b
node ".\node_modules\oxlint\bin\oxlint" src
node ".\node_modules\vite\bin\vite.js" build
```
The backend is Pint-clean (Laravel preset). The two remaining frontend oxlint warnings are the
intentional `Provider` + `useX()` export pattern in `stores/`, which only affects hot reload.
"# School-Management-Information-System" 
