# Warehouse Appointment Management System

## Overview

This is a full-stack warehouse appointment scheduling system that manages delivery appointments with sophisticated resource capacity validation. The application validates appointments minute-by-minute against available resources (workers, forklifts, and docks) to prevent overbooking and ensure efficient warehouse operations.

**Core Purpose**: Schedule and manage warehouse delivery appointments while enforcing real-time capacity constraints based on configurable shift windows.

**Key Business Logic**: Each appointment consumes resources uniformly over its duration. The system calculates a "work rate" (work_minutes_needed / duration) and validates that at every minute of the appointment, the sum of all active appointments' resource demands doesn't exceed the available capacity defined for that time period.

**Current Status**: ✅ Fully functional MVP with all core features implemented and tested.

## Recent Changes (October 28, 2025)

### Fixed Issues
1. **Zod Schema Compatibility**: Fixed `.partial()` and `.extend()` usage by creating base schemas first, then applying refinements. This resolved TypeScript errors where refined schemas couldn't be extended.
2. **Server Startup**: Fixed HTTP server creation to properly initialize with both Express app and HTTP server before passing to Vite middleware.
3. **Authentication Credentials**: Updated seed data to use consistent, simple passwords:
   - Admin: `admin@example.com` / `admin123`
   - Planner: `planner@example.com` / `planner123`
   - Viewer: `viewer@example.com` / `viewer123`
4. **JWT Secret**: Configured required `JWT_SECRET` environment variable for secure token generation.
5. **Critical Error Handling Fix**: Removed `throw err` from Express error handler that was causing Node.js process crashes. The server now logs errors and sends proper responses without terminating.

### Verified Features
- ✅ User authentication with role-based access control
- ✅ FullCalendar integration with time grid view (Europe/Madrid timezone)
- ✅ Appointment creation dialog with capacity validation
- ✅ Provider management CRUD operations
- ✅ Capacity shift management
- ✅ Appointments list view
- ✅ Theme toggle (light/dark mode)
- ✅ Responsive Shadcn UI sidebar navigation
- ✅ API documentation at `/docs` (Swagger UI)
- ✅ Graceful error handling (server doesn't crash on API errors)
- ✅ End-to-end tested with Playwright automation

## Test Credentials

**Admin User** (Full Access):
- Email: `admin@example.com`
- Password: `admin123`

**Planner User** (Create/Edit):
- Email: `planner@example.com`
- Password: `planner123`

**Viewer User** (Read-Only):
- Email: `viewer@example.com`
- Password: `viewer123`

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with Vite for build tooling and hot module replacement.

**UI Component Library**: shadcn/ui built on Radix UI primitives with Tailwind CSS for styling. The design follows Microsoft Fluent Design principles emphasizing clarity, scannable information hierarchy, and enterprise-grade form controls.

**Calendar System**: FullCalendar with timeGrid and interaction plugins for drag-and-drop appointment scheduling with variable-duration events.

**State Management**: TanStack React Query for server state management with custom query client configured for credential-based requests. Local UI state managed with React hooks.

**Routing**: Wouter for lightweight client-side routing without the overhead of React Router.

**Design Tokens**: Custom Tailwind configuration extending the base theme with semantic color tokens (background, foreground, primary, secondary, etc.) supporting both light and dark modes. Uses HSL color values with CSS custom properties for dynamic theming.

**Layout Structure**: Sidebar navigation (fixed 20rem width) with main content area. Role-based navigation items filter based on user permissions (ADMIN, PLANNER, BASIC_READONLY).

### Backend Architecture

**Runtime**: Node.js 20 with Express.js for HTTP server.

**Database ORM**: Prisma Client for type-safe database access. The configuration suggests PostgreSQL as the target database (via `@neondatabase/serverless` and drizzle-kit config), though Prisma is the active ORM.

**Authentication**: JWT-based authentication with bcrypt for password hashing. Tokens are stored in localStorage on the client and sent via Authorization Bearer headers. Middleware validates tokens and enforces role-based access control (RBAC).

**API Documentation**: Swagger/OpenAPI 3.0 specification served at `/docs` endpoint with swagger-ui-express.

**Validation**: Zod schemas for request/response validation defined in `shared/types.ts` and consumed on both client and server for type safety.

**Timezone Handling**: All database timestamps stored in UTC. The system uses `Europe/Madrid` timezone for display and user input, with conversion logic in `server/utils/timezone.ts` using `date-fns-tz`.

**Capacity Validation Service**: Core business logic service (`server/services/capacity-validator.ts`) that:
- Discretizes appointment time ranges into minute-by-minute intervals
- Fetches overlapping capacity shifts from the database
- Calculates resource consumption per minute for all active appointments
- Validates that work rate, forklift usage, and dock occupancy don't exceed limits
- Returns detailed conflict information including the specific minute and resource that failed

### Data Models

**Users**: Email-based authentication with three roles:
- `ADMIN`: Full system access including user management
- `PLANNER`: Can create/edit appointments, providers, and capacity shifts
- `BASIC_READONLY`: View-only access to calendars and appointments

**Providers**: Delivery service providers with optional notes field.

**Appointments**: Core entity with:
- Start/end timestamps (UTC in database, Madrid for display)
- Work minutes needed (total labor required across appointment duration)
- Forklifts needed (simultaneous forklift count during appointment)
- Optional metadata: goods type, units, lines, delivery notes count, external reference
- Foreign key to Provider

**Capacity Shifts**: Define available resources for time windows:
- Start/end timestamps defining the shift period
- Workers available (equivalent to minutes of work per minute)
- Forklifts available
- Docks active (0-3, optional field)
- Can overlap; system uses most specific (shortest duration) shift when multiple apply

### Key Architectural Decisions

**Minute-by-Minute Validation**:
- **Problem**: Need to validate that appointment resource demands don't exceed capacity at any point during their duration.
- **Solution**: Discretize time into 1-minute intervals and validate each minute independently. This is simple to implement and sufficient for warehouse scheduling granularity.
- **Trade-off**: More CPU-intensive than interval-based approaches, but ensures complete accuracy and is easy to debug.

**Uniform Resource Distribution**:
- **Problem**: How to model resource consumption over appointment duration.
- **Solution**: Calculate a constant work rate (work_minutes / duration) applied uniformly across all minutes. Forklift and dock usage are binary (either needed or not) for the entire duration.
- **Rationale**: Simplifies validation logic and matches real-world warehouse operations where resources are allocated for the full appointment window.

**Shift Overlap Resolution**:
- **Problem**: Multiple capacity shifts may overlap for the same time period.
- **Solution**: Use the shift with the shortest duration (most specific).
- **Alternative Considered**: Sum capacities or throw error on overlap.
- **Rationale**: Allows for temporary capacity increases (e.g., extra workers on a specific day) to override weekly defaults without conflicts.

**JWT Storage in localStorage**:
- **Problem**: Need to persist authentication across page refreshes.
- **Solution**: Store JWT in localStorage and send via Authorization header.
- **Security Note**: Vulnerable to XSS attacks but acceptable for internal warehouse management systems. Production deployments should consider httpOnly cookies.

**Shared Type Definitions**:
- **Problem**: Maintain type consistency between client and server.
- **Solution**: Zod schemas in `shared/types.ts` compiled to TypeScript types and used for both runtime validation and compile-time type checking.
- **Benefit**: Single source of truth eliminates type drift and reduces bugs.

**Default Capacity Values**:
- **Problem**: What happens if no capacity shift is defined for an appointment's time range?
- **Solution**: Environment variables define defaults (DEFAULT_WORKERS=3, DEFAULT_FORKLIFTS=2, DEFAULT_DOCKS=3).
- **Rationale**: Allows system to function before capacity shifts are configured while encouraging explicit shift definition.

## External Dependencies

**Database**: PostgreSQL (via Neon serverless driver) with Prisma ORM for schema management and queries. Connection configured via `DATABASE_URL` environment variable.

**UI Component Libraries**:
- Radix UI: Unstyled, accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- FullCalendar: Calendar rendering and interaction library
- Lucide React: Icon library
- date-fns & date-fns-tz: Date manipulation and timezone conversion

**Build Tools**:
- Vite: Frontend build tool and dev server
- esbuild: Backend bundling for production
- TypeScript: Type checking (noEmit mode)
- Tailwind CSS + PostCSS: Styling and CSS processing

**Development Tools** (Replit-specific):
- @replit/vite-plugin-runtime-error-modal: Runtime error overlay
- @replit/vite-plugin-cartographer: Code visualization
- @replit/vite-plugin-dev-banner: Development environment banner

**Authentication**: bcryptjs for password hashing, jsonwebtoken for JWT generation and verification.

**Validation**: Zod for schema validation on both client and server.

**API Documentation**: swagger-jsdoc and swagger-ui-express for OpenAPI documentation generation and UI.

**Required Environment Variables**:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing (application fails to start if not set)
- `DEFAULT_WORKERS`: Default worker capacity (optional, defaults to 3)
- `DEFAULT_FORKLIFTS`: Default forklift capacity (optional, defaults to 2)
- `DEFAULT_DOCKS`: Default dock capacity (optional, defaults to 3)
- `NODE_ENV`: Environment mode (development/production)