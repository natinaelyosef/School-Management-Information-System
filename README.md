# School Management & Information System (SMIS)

A full-stack school management platform for preschool, middle school, and high school. SMIS brings admissions, academics, attendance, finance, communication, and administration together in one system.

## Project structure

```text
backend/   Laravel 12 REST API (PHP 8.2+, Sanctum, MySQL/SQLite)
frontend/  React 19 + TypeScript + Vite + Tailwind CSS
```

## Features

- **Admissions and enrollment:** public school information, online applications, application tracking, admission review, and student enrollment.
- **School structure and academics:** school levels, grades, sections, academic years, terms, enrollments, assignments, exams, results, and report cards.
- **Attendance:** record and manage student attendance.
- **Finance:** invoices, payments, payment-proof uploads and verification, and receipts.
- **Role-based access:** super administrators, school administrators, principals, academic coordinators, registrars, teachers, accountants, librarians, nurses, parents, and students.
- **Communication:** announcements, messaging, and notifications.
- **Additional tools:** library borrowing, health visits, transport routes, timetables, reports, dark mode, and an installable PWA with an offline app shell.

## Requirements

- PHP 8.2 or newer and Composer
- Node.js 18 or newer and npm
- MySQL (for example, through XAMPP) or SQLite

## Getting started

Run the backend and frontend in separate terminals.

### 1. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Configure the database in `backend/.env`. For MySQL, create a database first (the example configuration uses `smis`):

```sql
CREATE DATABASE smis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then migrate, seed, and start the API:

```bash
php artisan migrate --seed
php artisan serve
```

The API is available at `http://localhost:8000`. For SQLite development, set `DB_CONNECTION=sqlite` in `.env` and configure the SQLite database file as needed.

Some background tasks, such as queued reminders and notifications, require a worker:

```bash
php artisan queue:work
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_URL` in `frontend/.env` to the API base URL. The default is:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Open the development URL printed by Vite (typically `http://localhost:5173`).

## Development commands

Backend tests:

```bash
cd backend
php artisan test
```

Frontend scripts (run from `frontend/`):

```bash
npm run dev
npm run build
npm run lint
```

## API

API routes use the `/api/v1` prefix. Authentication is provided by Laravel Sanctum. Useful endpoints include:

- `GET /api/health` — health check
- `POST /api/v1/auth/login` — sign in
- `GET /api/v1/me` — current authenticated user
- `/api/v1/students`, `/api/v1/attendances`, and `/api/v1/applications`
- `/api/v1/invoices` and `/api/v1/payments`
- `/api/v1/messages`, `/api/v1/notifications`, and `/api/v1/announcements`

See the [backend README](backend/README.md) and [frontend README](frontend/README.md) for component-specific details.

## Security note

Use local development credentials only for local testing. Before deploying, configure secure credentials and environment variables, use HTTPS, and do not commit `.env` files or real user data.
