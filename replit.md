# Warehouse Appointment Management System

## Overview
This full-stack warehouse appointment scheduling system manages delivery appointments with real-time resource capacity validation. It prevents overbooking by validating appointments minute-by-minute against available resources (workers, forklifts, and docks), ensuring resource demands do not exceed capacity. The project aims to optimize warehouse operations and functions as a fully functional MVP. It includes a public chat interface for conversational appointment booking via an AI agent.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React 18 with Vite, shadcn/ui (Radix UI + Tailwind CSS) following Microsoft Fluent Design, and supports light/dark modes. FullCalendar provides dynamic scheduling, TanStack React Query manages server state, and Wouter handles routing. It features a fixed sidebar navigation with role-based access control. The platform is fully localized in Spanish.

### Backend Architecture
The backend is built with Node.js 20 and Express.js, using Prisma Client for PostgreSQL. Authentication is JWT-based with bcrypt and RBAC. API documentation is via Swagger/OpenAPI 3.0 at `/docs`. Zod schemas validate requests and responses. A Capacity Validation Service discretizes time minute-by-minute to validate resource consumption against available capacity, returning conflict details. A public `/chat` interface allows unauthenticated users to book appointments conversationally via an AI agent.

### Data Models
-   **Users**: Email-based authentication with `ADMIN`, `PLANNER`, and `BASIC_READONLY` roles.
-   **Providers**: Delivery service providers.
-   **Appointments**: Core entity with time, resource needs, and provider link.
-   **Capacity Shifts**: Define available resources for specific time windows.

### Key Architectural Decisions
-   **Minute-by-Minute Validation**: Precise resource allocation.
-   **Uniform Resource Distribution**: Constant work rate and consistent usage for validation.
-   **Shift Overlap Resolution**: Prioritizes specific capacity shifts.
-   **Shared Type Definitions**: Zod schemas ensure type consistency across the stack.
-   **Default Capacity Values**: Environment variables provide fallback capacity.
-   **Public vs Protected Routes**: Management platform requires authentication; `/chat` is public.

### Public Endpoints & AI Integration
The `/chat` interface provides a public, unauthenticated React UI with real-time SSE streaming. It uses a self-hosted AI orchestrator with Claude Sonnet 4.5 (Replit AI) as the main agent and GPT-4.1 (Replit AI) as a calculator subagent. Conversation history is PostgreSQL-backed. Tools include `calendar-availability`, `calendar-book`, and `calculator`.

Public integration API endpoints (`/api/integration/calendar/parse`, `/api/integration/calendar/availability`, `/api/integration/calendar/book`) allow external systems to parse queries, check availability, and book appointments. The booking endpoint includes retry logic for capacity conflicts.

## External Dependencies

**Database**: PostgreSQL (via Neon serverless driver) with Prisma ORM.

**UI/UX Libraries**:
-   Radix UI, FullCalendar, Lucide React
-   date-fns & date-fns-tz

**Build & Development Tools**:
-   Vite, esbuild, TypeScript, Tailwind CSS, PostCSS
-   Replit-specific plugins

**Authentication & Validation**:
-   bcryptjs, jsonwebtoken, Zod

**API Documentation**:
-   swagger-jsdoc, swagger-ui-express

**AI Integration Services**:
-   Replit AI Anthropic Integration (Claude Sonnet 4.5)
-   Replit AI OpenAI Integration (GPT-4.1)
-   Self-hosted agentic orchestrator

**Required Environment Variables**:
-   `DATABASE_URL`, `JWT_SECRET`
-   `DEFAULT_WORKERS`, `DEFAULT_FORKLIFTS`, `DEFAULT_DOCKS` (optional)
-   `NODE_ENV`