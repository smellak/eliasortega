# Warehouse Appointment Management System

## Overview
This is a full-stack warehouse appointment scheduling system designed to manage delivery appointments with sophisticated resource capacity validation. Its core purpose is to schedule and manage warehouse delivery appointments while enforcing real-time capacity constraints based on configurable shift windows. The application prevents overbooking by validating appointments minute-by-minute against available resources (workers, forklifts, and docks). Each appointment consumes resources uniformly over its duration, with the system calculating a "work rate" and ensuring that resource demands do not exceed available capacity at any given minute. The project aims to optimize warehouse operations and is a fully functional MVP.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18, utilizing Vite for tooling. The UI is developed with shadcn/ui (Radix UI + Tailwind CSS) following Microsoft Fluent Design principles, supporting both light and dark modes. FullCalendar is integrated for dynamic appointment scheduling, and TanStack React Query manages server state. Wouter handles client-side routing, and custom Tailwind configurations provide semantic design tokens. The layout features a fixed sidebar navigation with role-based access control for menu items.

### Backend Architecture
The backend runs on Node.js 20 with Express.js. Prisma Client provides type-safe database access, targeting PostgreSQL. Authentication is JWT-based with bcrypt for password hashing and role-based access control (RBAC) enforced via middleware. API documentation is provided via Swagger/OpenAPI 3.0 at `/docs`. Zod schemas ensure request/response validation across client and server. Timezone handling converts UTC database timestamps to `Europe/Madrid` for display. A core Capacity Validation Service discretizes time into minute-by-minute intervals to validate resource consumption against available capacity, returning detailed conflict information.

**Public Routes**: The system includes a public chat interface at `/chat` that does not require authentication, allowing delivery providers to interact with a self-hosted AI agent (Claude Sonnet 4) to book appointments conversationally without accessing the management platform.

### Data Models
-   **Users**: Email-based authentication with `ADMIN`, `PLANNER`, and `BASIC_READONLY` roles.
-   **Providers**: Delivery service providers.
-   **Appointments**: Core entity with start/end timestamps, work minutes, forklift needs, and optional metadata, linked to a Provider.
-   **Capacity Shifts**: Define available resources (workers, forklifts, docks) for specific time windows.

### Key Architectural Decisions
-   **Minute-by-Minute Validation**: Ensures precise resource allocation by validating each minute of an appointment's duration.
-   **Uniform Resource Distribution**: Simplifies validation by applying a constant work rate and consistent forklift/dock usage throughout an appointment.
-   **Shift Overlap Resolution**: Prioritizes the most specific (shortest duration) capacity shift when multiple overlap, allowing for flexible capacity adjustments.
-   **Shared Type Definitions**: Zod schemas in `shared/types.ts` provide a single source of truth for type consistency and validation across the stack.
-   **Default Capacity Values**: Environment variables (`DEFAULT_WORKERS`, `DEFAULT_FORKLIFTS`, `DEFAULT_DOCKS`) provide fallback capacity if no specific shifts are defined.
-   **Public vs Protected Routes**: Management platform requires JWT authentication, while the `/chat` endpoint is publicly accessible for customer-facing appointment booking via AI assistant.

## External Dependencies

**Database**: PostgreSQL (via Neon serverless driver) managed with Prisma ORM.

**UI/UX Libraries**:
-   Radix UI
-   FullCalendar
-   Lucide React (icons)
-   date-fns & date-fns-tz (date manipulation)

**Build & Development Tools**:
-   Vite (frontend build, dev server)
-   esbuild (backend bundling)
-   TypeScript
-   Tailwind CSS + PostCSS
-   Replit-specific plugins (`@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`)

**Authentication & Validation**:
-   bcryptjs (password hashing)
-   jsonwebtoken (JWT)
-   Zod (schema validation)

**API Documentation**:
-   swagger-jsdoc
-   swagger-ui-express

**AI Integration Services**:
-   Replit AI Anthropic Integration (Claude Sonnet 4.5) - Main conversational agent
-   Replit AI OpenAI Integration (GPT-4.1) - Calculator subagent for complex computations
-   Self-hosted agentic orchestrator with SSE streaming, conversation memory, and tool execution

**Required Environment Variables**:
-   `DATABASE_URL`
-   `JWT_SECRET`
-   `DEFAULT_WORKERS` (optional)
-   `DEFAULT_FORKLIFTS` (optional)
-   `DEFAULT_DOCKS` (optional)
-   `NODE_ENV`

## Public Endpoints

### Chat Interface (`/chat`)
A customer-facing public page with a modern React chat UI powered by a self-hosted AI agent. This page:
- Does not require authentication
- Displays the Centro Hogar Sanchez branding (logo)
- Real-time SSE streaming for responsive conversational experience
- Self-hosted AI orchestrator using Claude Sonnet 4.5 as main agent
- Accessible via custom domain: `https://citaschs.com/chat`

**Agent Architecture**:
- **Main Agent**: Claude Sonnet 4.5 via Replit AI (no personal API keys required)
- **Calculator Subagent**: GPT-4.1 via Replit AI for complex mathematical operations
- **Orchestrator**: Custom TypeScript implementation with SSE streaming
- **Memory**: PostgreSQL-backed conversation persistence
- **Tools**: calendar-availability, calendar-book, calculator (with delegation to GPT-4.1)

**Token Management**:
- History limited to 20 most recent messages to prevent context overflow
- Tool results truncated to 2000 characters max
- Stop reason detection prevents infinite loops (checks `end_turn`)
- Robust error handling with graceful degradation

**Conversation Flow**:
1. User sends message via POST `/api/chat/message`
2. Orchestrator loads conversation history (limited to 20 messages)
3. Claude Sonnet 4 processes message with available tools
4. Responses stream via Server-Sent Events (SSE)
5. Tool calls execute and results feed back to Claude
6. Final response saved to conversation memory

### Integration API Endpoints (Public - No Authentication Required)

**`POST /api/integration/calendar/parse`**
- Parses and normalizes calendar queries from external integrations
- Accepts flexible input: query wrapper (JSON string/object) or direct object
- Uses `rawCalendarQuerySchema` for validation with type coercion (strings → numbers)
- Returns normalized `NormalizedCalendarQuery` with defaults for all optional fields

**`POST /api/integration/calendar/availability`**
- Returns available appointment slots based on date range and duration
- Operating hours: 08:00-14:00 Europe/Madrid (weekdays only)
- Returns up to 3 available slots with both UTC and local timestamps
- Validates capacity (workers, forklifts, docks) for each slot
- Searches up to 3 days from start date if needed

**`POST /api/integration/calendar/book`**
- Books appointments with automatic retry logic
- Implements 3 retry attempts with +30 minute increments on capacity conflicts
- Generates deterministic `externalRef` for idempotent operations
- Returns HTML confirmation message with appointment details
- All timestamps converted to Europe/Madrid timezone for user-facing display

**Design Pattern**: All calendar endpoints accept multiple input formats and use shared Zod schemas for consistent validation and normalization.