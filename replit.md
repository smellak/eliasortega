# Warehouse Appointment Management System

## Overview
Full-stack warehouse appointment scheduling system with real-time resource capacity validation. Prevents overbooking by validating appointments minute-by-minute against available resources (workers, forklifts, docks). Includes a Spanish-localized management platform with role-based access control and a public AI-powered chat interface for conversational appointment booking.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 + Vite + TypeScript
- **UI**: shadcn/ui (Radix UI + Tailwind CSS), Microsoft Fluent Design, light/dark mode
- **Calendar**: FullCalendar with date-range-filtered data fetching
- **State**: TanStack React Query v5 (object form only)
- **Routing**: Wouter
- **Chat**: ReactMarkdown for AI response rendering, SSE streaming
- **Error Handling**: React ErrorBoundary wrapping main router, token validation on app load
- **Confirmations**: Custom ConfirmDialog component (no window.confirm)
- **Form Validation**: Client-side validation in AppointmentDialog (provider required, date range checks, positive numbers)
- **Localization**: Fully Spanish

### Backend Architecture
- **Runtime**: Node.js 20 + Express.js
- **Database**: PostgreSQL (Neon) via Prisma ORM (singleton client pattern in `server/db/client.ts`)
- **Auth**: JWT + bcrypt with RBAC (ADMIN, PLANNER, BASIC_READONLY)
- **Security**:
  - Helmet middleware (security headers)
  - Rate limiting: login (10/15min), chat (20/min), general API (200/min)
  - API key authentication for integration endpoints (`INTEGRATION_API_KEY` env var, `X-API-Key` header)
  - `trust proxy` enabled for correct rate limiting behind reverse proxy
- **API Docs**: Swagger/OpenAPI 3.0 at `/docs`
- **Validation**: Zod schemas for all request/response payloads
- **Race Condition Protection**: Capacity validation + appointment writes wrapped in Prisma `$transaction` with Serializable isolation

### Data Models
- **Users**: Email-based auth with role-based access
- **Providers**: Delivery service providers
- **Appointments**: Core entity with time, resource needs, provider link
- **Capacity Shifts**: Available resources for specific time windows
- **Conversations/Messages**: AI chat history (PostgreSQL-backed)

### Key Architectural Decisions
- **Minute-by-Minute Validation**: Precise resource allocation per minute
- **Transaction-Safe Capacity Checks**: Serializable isolation prevents overbooking race conditions
- **Deterministic Calculator**: TypeScript implementation of resource formulas for 8 categories (Asientos, Baño, Cocina, Colchonería, Electro, Mobiliario, PAE, Tapicería). LLM fallback only for unrecognized goods types.
- **Event-Based Capacity Calculation**: Timeline algorithm for overlapping shifts
- **Day-of-Week Capacity**:
  - Weekdays (Mon-Fri): 08:00-19:00, 3 workers, 2 forklifts, 3 docks
  - Saturdays: 08:00-14:00, 2 workers, 1 forklift, 2 docks
  - Sundays: Closed

### AI Integration
- **Main Agent**: Claude Sonnet 4.5 (Anthropic) - conversational orchestrator
- **Calculator**: Deterministic TypeScript formulas (GPT-4.1 fallback for edge cases)
- **Tools**: `calculator`, `calendar_availability`, `calendar_book`
- **Memory**: PostgreSQL-backed conversation history
- **Streaming**: SSE for real-time response delivery

### Public vs Protected Routes
- Management platform (`/`, `/appointments`, `/capacity`, `/providers`, `/users`): JWT required
- Chat interface (`/chat`): Public, no auth
- Integration endpoints (`/api/integration/calendar/*`): API key required (if `INTEGRATION_API_KEY` set)
- Health check (`/api/health`): Public, includes DB connectivity check

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - JWT signing secret (required)
- `INTEGRATION_API_KEY` - API key for integration endpoints (optional, endpoints open if not set)
- `DEFAULT_WORKERS`, `DEFAULT_FORKLIFTS`, `DEFAULT_DOCKS` - Default capacity (optional, defaults: 3, 2, 3)
- `NODE_ENV` - Environment mode

## Key Files
- `server/index.ts` - Express app setup with security middleware
- `server/routes.ts` - All API routes
- `server/services/capacity-validator.ts` - Minute-by-minute capacity validation
- `server/agent/orchestrator.ts` - AI chat orchestrator
- `server/agent/calculator.ts` - Deterministic resource calculator
- `server/agent/tools.ts` - AI tool definitions and execution
- `server/db/client.ts` - Singleton Prisma client
- `server/middleware/auth.ts` - JWT authentication middleware
- `client/src/App.tsx` - Main app with ErrorBoundary and token validation
- `client/src/pages/chat-public.tsx` - Public AI chat with markdown rendering
- `client/src/components/confirm-dialog.tsx` - Reusable confirmation dialog
- `shared/types.ts` - Shared Zod schemas and TypeScript types
- `prisma/schema.prisma` - Database schema

## Dev Credentials
- Admin: admin@admin.com / admin123
- Port: 5000
