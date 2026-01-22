# Safe Path - Road Safety Platform

## Overview

Safe Path is an AI-powered road safety platform built for a hackathon focused on accident prevention, road safety awareness, and safer mobility practices. The application provides three core features:

1. **Accident Risk Prediction** - Predicts accident risk based on location, time, and weather conditions, displaying risk zones on an interactive map
2. **Driver Behavior Monitoring** - Tracks driving events (braking, speeding, swerving) and maintains a driver safety score
3. **Emergency Response** - Triggers emergency alerts with hospital coordination when accidents occur

The platform uses a cyberpunk/futuristic UI theme with neon colors and smooth animations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS with custom cyberpunk theme (neon colors, dark mode default)
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Maps**: Leaflet with react-leaflet for interactive risk zone visualization
- **Charts**: Recharts for driver score gauge and data visualization
- **Animations**: Framer Motion for smooth transitions and alerts
- **Build Tool**: Vite with HMR support

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod schema validation
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Development**: tsx for TypeScript execution, Vite dev server integration

### Data Storage
- **Database**: PostgreSQL (requires DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` using Drizzle table definitions
- **Tables**:
  - `accident_zones` - Historical accident data with risk levels and coordinates
  - `behavior_logs` - Driver behavior events with score deductions
  - `emergency_alerts` - Emergency incidents with hospital assignments

### API Structure
All API routes are typed and defined in `shared/routes.ts`:
- `GET /api/risk/predict` - Calculate risk score based on location, time, weather
- `GET /api/risk/zones` - Retrieve all accident-prone zones
- `GET /api/driver/score` - Get current driver score and behavior logs
- `POST /api/driver/log` - Log a driving behavior event
- `POST /api/driver/reset` - Reset driver score
- `POST /api/emergency/trigger` - Initiate emergency alert

### Project Structure
```
client/           # React frontend application
  src/
    components/   # UI components including CyberCard, RiskMap, DriverGauge
    hooks/        # Custom React hooks for API calls
    pages/        # Page components (Dashboard, not-found)
    lib/          # Utilities and query client setup
server/           # Express backend
  routes.ts       # API route handlers
  storage.ts      # Database operations layer
  db.ts           # Database connection
shared/           # Shared types and schemas
  schema.ts       # Drizzle database schema
  routes.ts       # API route definitions with Zod validation
```

## External Dependencies

### Database
- **PostgreSQL** - Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM** - Database migrations stored in `./migrations` directory
- **Schema Push**: Run `npm run db:push` to sync schema to database

### Maps
- **Leaflet** - Interactive map library for risk zone visualization
- **CartoDB Dark Tiles** - Dark-themed map tiles from CartoDB basemaps

### Key NPM Packages
- `@tanstack/react-query` - Server state management
- `drizzle-orm` / `drizzle-zod` - Database ORM and schema validation
- `framer-motion` - Animation library
- `recharts` - Chart visualization
- `react-leaflet` - React bindings for Leaflet maps
- `zod` - Runtime type validation for API contracts

### Development Tools
- `vite` - Frontend build tool with HMR
- `tsx` - TypeScript execution for server
- `drizzle-kit` - Database migration tooling