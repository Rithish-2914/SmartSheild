# Safe Path — Road Safety Dashboard

A real-time road safety intelligence dashboard for India. Tracks driver behavior, predicts accident risk based on location/time/weather, shows hazard zones on a live map, and can trigger emergency alerts with nearest hospital lookup.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/road-safety run dev` — run the frontend (port 24668)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `GEMINI_API_KEY` — for AI safety analysis feature

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v3, Leaflet (maps), wouter (routing)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod
- Build: esbuild (CJS bundle for api-server)

## Where things live

- `artifacts/road-safety/` — React/Vite frontend (cyberpunk-themed dashboard)
- `artifacts/api-server/` — Express backend with road safety routes
- `artifacts/api-server/src/routes/road-safety.ts` — all road safety API routes
- `lib/db/src/schema/index.ts` — DB schema (accident zones, behavior logs, emergency alerts, hazard reports, road ratings)

## Architecture decisions

- Tailwind v3 used in road-safety frontend (backup used v3 patterns); vite.config uses postcss inline config
- API routes directly imported via Express Router from a single `road-safety.ts` file
- Emergency alert lookup uses Overpass API (OpenStreetMap) to find real hospitals
- AI analysis powered by Gemini 2.5 Flash (requires GEMINI_API_KEY)

## Product

- Live map showing accident risk zones across India with color-coded risk levels
- Real-time risk score prediction based on coordinates, time of day, and weather
- Driver behavior tracking (sudden braking, speeding, crash events) with safety score
- Emergency SOS with nearest hospital lookup using OpenStreetMap data
- Hazard reporting by clicking on the map
- AI-powered safety briefing (requires Gemini API key)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The road-safety artifact uses Tailwind v3 (not v4) — the vite.config uses postcss inline, not @tailwindcss/vite
- Leaflet requires `leaflet/dist/leaflet.css` import and icon path fix (done in RiskMap.tsx)
- The migration backup is at `.migration-backup/` — do not modify those files

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
