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

**Public Routes**: The system includes a public chat interface at `/chat` that does not require authentication, allowing delivery providers to interact with an n8n-powered AI assistant to book appointments without accessing the management platform.

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

**Integration Services**:
-   n8n webhook integration for AI-powered chat assistant (embedded at `/chat`)

**Required Environment Variables**:
-   `DATABASE_URL`
-   `JWT_SECRET`
-   `DEFAULT_WORKERS` (optional)
-   `DEFAULT_FORKLIFTS` (optional)
-   `DEFAULT_DOCKS` (optional)
-   `NODE_ENV`

## Public Endpoints

### Chat Interface (`/chat`)
A customer-facing public page that embeds the n8n AI chat assistant for appointment booking. This page:
- Does not require authentication
- Displays the Centro Hogar Sanchez branding (logo)
- Includes video instructions for users
- Connects to n8n webhook for conversational appointment scheduling
- Located at: `client/public/chat.html`
- Accessible via custom domain: `https://citaschs.com/chat`