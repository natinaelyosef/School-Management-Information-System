# SMIS Frontend — School Management & Information System

React + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack Query + axios.

## Requirements

- Node.js 18+
- Backend API running at `http://localhost:8000/api/v1` (Laravel Sanctum)

## Run

```bash
cd "C:\xampp\htdocs\School Management & Information System\frontend"
npm install
cp .env.example .env   # or set VITE_API_URL manually
npm run dev
```

Open http://localhost:5173

## Config

- `VITE_API_URL` — backend base URL (default `http://localhost:8000/api/v1`)
- Auth uses Sanctum bearer token stored in `localStorage` (`smis_token`, `smis_user`, `smis_role`)
- axios client: `src/api/client.ts` (token request interceptor + 401 cleanup)
- React Query provider: `src/main.tsx`

## Scripts

- `npm run dev` — dev server
- `npm run build` — type-check (`tsc -b`) + production build
- `npm run preview` — preview built app
- `npm run lint` — oxlint

## Demo logins (work even when backend is offline)

| Role | Email | Password |
|---|---|---|
| super_admin | admin@school.et | password |
| principal | principal@school.et | password |
| teacher | teacher@school.et | password |
| parent | parent@school.et | password |

## Routes

- Public: `/`, `/about`, `/programs`, `/preschool`, `/middle`, `/high`, `/teachers`, `/news`, `/events`, `/contact`, `/apply`, `/track`
- Auth: `/login`
- Dashboard: `/dashboard/*` — `admin`, `principal`, `academic`, `registrar`, `teacher`, `accountant`, `parent`, `student`, plus `students`, `attendance`, `finance`, `messages`, `applications`, `settings`
