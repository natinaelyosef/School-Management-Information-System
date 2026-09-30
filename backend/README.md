# SMIS Backend (Laravel 12)

School Management & Information System API.

## Stack
- Laravel 12, PHP 8.2
- Sanctum v4 (API tokens), Spatie Permission v6 (roles/permissions)
- MySQL (XAMPP default) with SQLite fallback for dev
- Queue + Cache: `database`

## Requirements
- PHP 8.2+, Composer, MySQL (XAMPP) or SQLite
- Node 18+ (only for Vite assets, optional for API)

## Setup

```bash
cd "C:\xampp\htdocs\School Management & Information System\backend"
composer install
cp .env.example .env
php artisan key:generate
```

### Database — MySQL (XAMPP default)
`.env.example` is pre-configured for XAMPP:
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=smis
DB_USERNAME=root
DB_PASSWORD=
```
Create DB first:
```sql
CREATE DATABASE smis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Then:
```bash
php artisan migrate --seed
```

### Database — SQLite fallback (dev, no MySQL)
```bash
# in .env:
DB_CONNECTION=sqlite
# comment out DB_HOST/DB_PORT/DB_DATABASE/DB_USERNAME/DB_PASSWORD
php artisan migrate --seed
```
SQLite file: `database/database.sqlite`.

`QUEUE_CONNECTION=database`, `CACHE_STORE=database` are already set — run:
```bash
php artisan queue:table  # already in base migrations (jobs table)
php artisan migrate
```

## Run

```bash
php artisan serve            # http://127.0.0.1:8000
php artisan queue:work       # jobs: CheckOverduePayments, SendPaymentReminder
```

Verify:
```bash
php artisan migrate --force        # must pass on sqlite
php artisan migrate:fresh --seed   # reset + seed roles + super admin
php artisan route:list --path=api  # 58 routes under /api/v1
```

## Default accounts (seeded)
- Super Admin: `admin@school.local` / `password` (role `super_admin`, all permissions)

Roles: `super_admin, school_admin, principal, academic_coordinator, registrar, teacher, accountant, librarian, nurse, parent, student`

## Auth
- `POST /api/v1/auth/login` `{email,password}` → `{user, token}`
- `POST /api/v1/auth/register` parent self-registration → `{user, token}`
- `GET /api/v1/me` (Bearer token)
- `POST /api/v1/auth/logout`

Use: `Authorization: Bearer <token>`.

Spatie middleware aliases registered in `bootstrap/app.php`:
`role`, `permission`, `role_or_permission` + custom `audit.log`.

## API (prefix `/api/v1`, `auth:sanctum`)
- Users: `GET/POST /users`, `GET/PATCH/DELETE /users/{user}`, `POST /users/{user}/{activate|suspend|reset-password}`
- Structure: `{levels|grades|sections|years|terms}` → `GET/POST /structure/{resource}`, `GET/PATCH/DELETE /structure/{resource}/{id}`
- Students: `/students` CRUD + `POST /students/{student}/promote`
- Attendance: `/attendances` (store accepts `{grade_id,section_id,date,records:[{student_id,status,remark}]}`)
- Finance: `/invoices`, `/payments`, `/payments/{payment}/proofs`, `/payments/{payment}/verify`
- Messaging: `/conversations`, `/conversations/{id}/messages`, `/messages/{message}/read`
- Announcements: `/announcements` + `/publish`
- Applications: `/applications` (auto `APP-YYYY-XXXXX`), `/documents`, `/decide`

## Services / Jobs / Notifications
- `App\Services\PaymentVerificationService` — verify/reject payment, update invoice balances, log verification.
- `App\Services\NotificationService` — `send*()` + `notification_logs` entries.
- `App\Services\MessagingService` — conversations/messages/read receipts.
- `App\Jobs\CheckOverduePayments` — mark overdue + queue reminders.
- `App\Jobs\SendPaymentReminder` — per-invoice reminder.
- Notifications: `StudentAbsentNotification`, `PaymentReminderNotification`, `AssignmentPostedNotification` (mail+database).

## Audit
- `App\Traits\LogsActivity::logActivity()` used in User/Student/Application controllers.
- `App\Http\Middleware\AuditLogMiddleware` (`audit.log`) auto-logs POST/PUT/PATCH/DELETE on `api/v1/*` to `audit_logs`.

## Config notes
- Sanctum: `config/sanctum.php` published; stateful domains via `SANCTUM_STATEFUL_DOMAINS`.
- Permissions: `config/permission.php` published; cache store `default` (database).
- `User` uses `HasApiTokens, HasRoles, SoftDeletes` (+ `phone,status,is_active` via `150005` migration).
