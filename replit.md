# Safe Path

A cyberpunk-themed road safety intelligence dashboard for India — predicts accident risk, tracks driver behavior, and provides emergency SOS response.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/road-safety run dev` — run the frontend (uses PORT env)
- `pnpm run typecheck:libs` — build shared lib types (run after schema changes)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite + React 18, Tailwind CSS v3, wouter, Leaflet + react-leaflet
- API: Express 5 (`artifacts/api-server/`)
- DB: PostgreSQL + Drizzle ORM (`lib/db/`)
- Validation: Zod

## Where things live

- `artifacts/road-safety/src/` — React frontend (single Dashboard page)
- `artifacts/road-safety/src/hooks/` — data fetching hooks (use-risk, use-driver, use-emergency)
- `artifacts/road-safety/src/components/` — RiskMap, DriverGauge, EmergencyModal, CyberCard
- `artifacts/road-safety/src/types/road-safety.ts` — shared TypeScript types for frontend
- `artifacts/api-server/src/routes/road-safety.ts` — all API routes
- `lib/db/src/schema/road-safety.ts` — Drizzle DB schema (5 tables)
- `artifacts/road-safety/public/logo.jpeg` — app logo

## Architecture decisions

- `@shared/` package from the original project replaced with inline types in `src/types/road-safety.ts` — avoids circular deps and keeps the frontend self-contained
- Logo copied to `public/` folder rather than using `@assets` alias — attached_assets dir is outside artifact root and caused Vite import resolution issues
- All driver behavior logs are currently global (no per-user scoping) — adding auth would scope them per user
- Tailwind v3 with PostCSS (not @tailwindcss/vite) — required because the copied CSS uses `@tailwind base/components/utilities` syntax

## Product

- **Live Risk Analysis**: Interactive India map with color-coded accident zones, real-time risk scoring based on GPS position, time of day, and weather
- **Route Safety Analysis**: Set a destination and compare alternative routes by risk score
- **Driver Profile**: 100-point safety score that deducts for harsh braking, speeding, swerving; badge system
- **Emergency SOS**: Hold button triggers hospital finder using OpenStreetMap Overpass API
- **System Logs**: Community hazard reports and road quality ratings

## User preferences

_Populate as you build._

## Gotchas

- Run `pnpm run typecheck:libs` before typechecking artifacts if you change `lib/db/src/schema/`
- The `react-day-picker` v8 calendar component has a minor TS incompatibility with the installed version — @ts-ignore applied in `ui/calendar.tsx`
- API server must be running for the dashboard data to load; the frontend falls back gracefully on network errors

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
