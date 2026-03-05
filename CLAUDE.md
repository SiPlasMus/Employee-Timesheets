# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build (outputs to dist/)
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

No test framework is configured in this project.

To sync the web build to Android after `npm run build`:
```bash
npx cap sync android
```

## Architecture

This is a React 19 + Vite SPA wrapped with Capacitor for Android deployment. It connects to a SAP HANA backend via a REST API.

### Key files

- `src/api.js` — Axios instance. Base URL comes from `VITE_API_URL` env var. Token is auto-attached from `localStorage` (`et_token`) on startup.
- `src/auth.js` — Token helpers (`getToken`, `setToken`, `clearToken`, `isAuthed`). Token key: `et_token`. Employee ID key: `et_empId`.
- `src/components/activityTypes.js` — Hardcoded list of activity type IDs and their Russian names used across Timesheet, AddLine, and Analysis pages.
- `src/ui/ui.js` — Exports `cn()` utility (clsx + tailwind-merge).

### Routing (`src/App.jsx`)

All routes except `/login` are wrapped in `ProtectedRoute` (checks `isAuthed()`). Unmatched routes redirect to `/timesheet`.

| Route | Page |
|---|---|
| `/login` | Login with EmpID + PIN |
| `/timesheet` | View/filter/edit/delete timesheet entries |
| `/add` | Add a new timesheet entry |
| `/analysis` | Monthly summary by activity type, cost center, and day |
| `/profile` | Employee info + change PIN |

### SAP/HANA data conventions

Times are stored as integers in SAP format: `800` = 08:00, `1530` = 15:30. Helper functions `sapIntToMinutes` and `hhmmFromSapInt` handle conversion. They are duplicated across `Timesheet.jsx` and `Analysis.jsx` (not shared).

Break durations from HANA can arrive as `"HH:MM:SS"` strings or numeric HHMM integers — the `breakToMinutes()` function handles both cases.

Date strings from HANA look like `"2025-12-01 00:00:00.000000000"` — sliced to first 10 chars to get `YYYY-MM-DD`.

### API endpoints used

- `POST /auth/login` — login, returns `{ token }`
- `POST /auth/change-pin`
- `GET /me` — current employee profile
- `GET /hana/timesheets/lines/:empId?month=YYYY-MM` — timesheet entries
- `GET /hana/cost-centers` — list of cost centers `{ code, name }`
- `POST /timesheet/line` — create entry
- `PATCH /timesheet/line/:lineId` — update entry
- `DELETE /timesheet/line/:lineId?month=YYYY-MM` — delete entry

### UI components (`src/ui/`)

Minimal custom components: `Button`, `Input`, `Card`/`CardHeader`/`CardContent`, `Badge`, `Select`. All use Tailwind CSS. Use `cn()` from `src/ui/ui.js` for conditional class merging.

The Navbar renders as a sticky top bar + fixed bottom tab bar. It hides itself when unauthenticated (`isAuthed()` returns false).

### Environment

`.env` must define `VITE_API_URL`. The `vite.config.js` sets `base: './'` for Capacitor compatibility.
