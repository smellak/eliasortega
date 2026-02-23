# Warehouse Appointment Management System v2.0

## Overview
Full-stack warehouse appointment scheduling system with slot-based capacity management (S/M/L appointment sizes with point system), email notifications, audit logging, and an AI-powered public chat interface. Spanish-localized management platform with role-based access control.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 + Vite + TypeScript
- **UI**: shadcn/ui (Radix UI + Tailwind CSS), premium blue gradient design system, glass-morphism effects, animations, light/dark mode
- **Calendar**: FullCalendar with date-range-filtered data fetching
- **State**: TanStack React Query v5 (object form only)
- **Routing**: Wouter
- **Chat**: ReactMarkdown for AI response rendering, SSE streaming
- **Error Handling**: React ErrorBoundary, token validation with auto-refresh
- **Localization**: Fully Spanish

### Backend Architecture
- **Runtime**: Node.js 20 + Express.js
- **Database**: PostgreSQL (Neon) via Prisma ORM (singleton client in `server/db/client.ts`)
- **Auth**: JWT (24h access tokens) + refresh tokens + bcrypt with RBAC (ADMIN, PLANNER, BASIC_READONLY)
- **Security**:
  - Helmet middleware (security headers)
  - Rate limiting: login (10/15min), chat (20/min), general API (200/min), integration (50/min)
  - Integration API: **closed by default** (403 if no `INTEGRATION_API_KEY` set)
  - `trust proxy` enabled for correct rate limiting behind reverse proxy
- **API Docs**: Swagger/OpenAPI 3.0 at `/docs`
- **Validation**: Zod schemas for all request/response payloads
- **Race Condition Protection**: Capacity validation + appointment writes wrapped in Prisma `$transaction`

### Capacity Model (v2.0 - Slot-Based Points)
- **Slot Templates**: Recurring weekly time blocks with max capacity points
  - Mon-Fri: 08:00-10:00, 10:00-12:00, 12:00-14:00 (6 points each)
  - Sat: 08:00-11:00, 11:00-14:00 (4 points each)
  - Sun: Closed
- **Slot Overrides**: Date-specific capacity changes (holidays, events)
- **Appointment Sizes**: S (≤30min, 1pt), M (31-90min, 2pts), L (>90min, 3pts)
- **Caching**: 5-minute in-memory TTL cache for slot templates
- **Legacy Support**: Old CapacityShift model retained for backward compatibility

### Data Models
- **Users**: Email-based auth with role-based access, refresh tokens
- **Providers**: Delivery service providers
- **Appointments**: Core entity with time, resource needs, provider link, size/points/slot assignment
- **Slot Templates**: Weekly recurring capacity slots (day of week, start/end time, max points)
- **Slot Overrides**: Date-specific capacity changes
- **Email Recipients**: Notification subscribers with per-type toggles
- **Email Log**: Send history with status tracking
- **Audit Log**: Full CRUD audit trail with actor type and JSON diffs
- **Conversations/Messages**: AI chat history (PostgreSQL-backed)

### Email Notification System
- **SMTP**: Configurable via env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
- **Daily Summary**: Cron job at configurable hour (default 7:00 Europe/Madrid)
- **Alerts**: Real-time on appointment create/update/delete
- **Graceful Degradation**: Logs failures if SMTP not configured, never crashes

### Audit System
- **Tracked Operations**: All CRUD on appointments, providers, slots, users, email recipients
- **Actor Types**: USER, CHAT_AGENT, INTEGRATION, SYSTEM
- **Change Tracking**: JSON diff of before/after states for updates
- **Filterable**: By entity type, action, actor type, date range

### AI Integration
- **Main Agent**: Claude Haiku 4.5 (Anthropic) - lightweight conversational orchestrator
- **Calculator**: Deterministic TypeScript formulas (Claude Haiku 4.5 fallback for edge cases)
- **Tools**: `calculator`, `calendar_availability`, `calendar_book`
- **Memory**: PostgreSQL-backed conversation history
- **Streaming**: SSE for real-time response delivery
- **Optimizations**: Reduced prompt (~400 tokens), max 5 tool iterations, 2048 max tokens

### Routes & Access Control
- Management platform (`/`, `/appointments`, `/capacity`, `/providers`, `/notifications`, `/audit`, `/users`): JWT required
- Chat interface (`/chat`): Public, no auth
- Integration endpoints (`/api/integration/calendar/*`): API key required (closed by default)
- Health check (`/api/health`): Public
- Auth refresh (`/api/auth/refresh`): Public with valid refresh token

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - JWT signing secret (required)
- `INTEGRATION_API_KEY` - API key for integration endpoints (required for integration access)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` - Email config (optional)
- `DAILY_SUMMARY_HOUR`, `DAILY_SUMMARY_MINUTE` - Daily summary schedule (default: 7:00)
- `DEFAULT_WORKERS`, `DEFAULT_FORKLIFTS`, `DEFAULT_DOCKS` - Legacy capacity defaults
- `NODE_ENV` - Environment mode

## Design System
- **Primary color**: Blue (hsl(213 94% 46%)) with gradient variations
- **CSS utilities**: `.glass-card`, `.glass-header`, `.gradient-btn`, `.page-icon`, `.premium-table`, `.skeleton-shimmer`
- **Animations**: `animate-fadeIn`, `animate-slideUp`, `animate-float`, `animate-shimmer`

## Key Files
- `server/index.ts` - Express app setup with security middleware
- `server/routes.ts` - All API routes (slots, appointments, email, audit, auth)
- `server/services/slot-validator.ts` - Slot-based capacity validation with caching
- `server/services/capacity-validator.ts` - Legacy minute-by-minute capacity (backward compat)
- `server/services/email-service.ts` - SMTP email sending with logging
- `server/services/email-templates.ts` - HTML email templates (daily summary, alerts)
- `server/services/email-cron.ts` - Daily summary cron job
- `server/services/audit-service.ts` - Audit logging with JSON diff computation
- `server/agent/orchestrator.ts` - AI chat orchestrator (Claude Haiku 4.5)
- `server/agent/calculator.ts` - Deterministic resource calculator
- `server/agent/tools.ts` - AI tool definitions and execution
- `server/middleware/auth.ts` - JWT + refresh token authentication
- `server/db/client.ts` - Singleton Prisma client
- `server/seed-slots.ts` - Default slot template seeder
- `client/src/lib/api.ts` - Frontend API client with token refresh
- `client/src/App.tsx` - Main app with routes for all pages
- `client/src/pages/capacity-page.tsx` - Slot template/override management
- `client/src/pages/notifications-page.tsx` - Email recipient/log management
- `client/src/pages/audit-page.tsx` - Audit log viewer with filters
- `client/src/components/app-sidebar.tsx` - Sidebar with all navigation items
- `shared/types.ts` - Shared Zod schemas and TypeScript types
- `prisma/schema.prisma` - Database schema (all v2.0 models)

## Deployment (GitHub + Coolify Docker)

### Files
- `Dockerfile` — Multi-stage Node 20 Alpine build (builder + runner)
- `docker-compose.yml` — Single-service compose for Coolify or standalone Docker
- `.env.example` — All environment variables documented
- `.dockerignore` — Excludes Replit-specific files and dev artifacts

### Build Process
1. `npm ci` + `npx prisma generate` (builder stage)
2. `vite build` (frontend → `dist/public/`)
3. `esbuild` (server → `dist/index.js`)
4. Runner stage copies only `node_modules`, `dist/`, `prisma/`, `package.json`

### Startup
Container runs: `npx prisma db push --skip-generate && node dist/index.js`
- Syncs schema to database on boot (safe, non-destructive)
- Serves frontend + API on port 5000

### Coolify Setup
1. Push repo to GitHub
2. In Coolify: New Resource → Docker Compose → point to repo
3. Set environment variables (copy from `.env.example`)
4. Deploy — health check at `/api/health`

### Portability
- `vite.config.ts`: Replit plugins load only when `REPL_ID` is set (try/catch guarded)
- `llm-clients.ts`: Accepts both `AI_INTEGRATIONS_ANTHROPIC_*` (Replit) and standard `ANTHROPIC_API_KEY`
- No Replit-specific code in server or client source

## Dev Credentials
- Admin: admin@example.com / CHS-Admin-2026! (CAMBIAR TRAS PRIMER LOGIN)
- Port: 5000
