# ANALISIS COMPLETO DEL PROYECTO - Sistema de Gestion de Citas de Almacen

**Proyecto:** Warehouse Appointment Management System v2.0
**Organizacion:** Centro Hogar Sanchez (CHS)
**Fecha de analisis:** 2026-02-23
**Analista:** Claude Code (Opus 4.6)

---

## INDICE

1. [Estructura del proyecto](#1-estructura-del-proyecto)
2. [Stack tecnologico](#2-stack-tecnologico)
3. [Base de datos (Prisma)](#3-base-de-datos---schema-prisma-completo)
4. [API - Todos los endpoints](#4-api---todos-los-endpoints)
5. [Frontend](#5-frontend)
6. [Agente IA](#6-agente-ia---orquestador)
7. [Calculadora de recursos](#7-calculadora-de-recursos)
8. [Sistema de capacidad](#8-sistema-de-validacion-de-capacidad)
9. [Autenticacion](#9-autenticacion)
10. [Variables de entorno](#10-variables-de-entorno)
11. [Problemas detectados](#11-problemas-detectados)
12. [Docker](#12-docker)

---

## 1. ESTRUCTURA DEL PROYECTO

```
/config/workspace/eliasortega/
|
|-- .env.example                          # Template de variables de entorno
|-- build.sh                              # Script de build para produccion
|-- components.json                       # Configuracion shadcn/ui
|-- Dockerfile                            # Build multi-stage Docker
|-- docker-compose.yml                    # Docker Compose
|-- drizzle.config.ts                     # Configuracion Drizzle ORM (NO USADO ACTIVAMENTE)
|-- package.json                          # Dependencias NPM y scripts
|-- package-lock.json                     # Lock de dependencias
|-- postcss.config.js                     # Configuracion PostCSS
|-- tsconfig.json                         # Configuracion TypeScript
|-- tailwind.config.ts                    # Tema y configuracion Tailwind CSS
|-- vite.config.ts                        # Bundler Vite
|-- design_guidelines.md                  # Guia de diseno Fluent Design
|-- INFORME_TECNICO_Y_USUARIO.md          # Documentacion tecnica y de usuario (espanol)
|-- replit.md                             # Instrucciones para despliegue Replit
|-- seed-production.js                    # Script de seed para produccion
|-- Calendar_Manager_Fixed.json           # Referencia de configuracion del calendario
|
|-- attached_assets/                      # Materiales de referencia del proyecto
|   |-- CALCULATOR AGENT (2)_*.json       # Configuracion del agente calculador
|   |-- Calendar_Manager (6)_*.json       # Configuracion del calendario
|   |-- Master_Almacen_Telegram_v3_*.json # Referencia bot Telegram
|   |-- index_*.html                      # HTML de referencia
|   |-- logo_sanchez_*.png                # Logos
|   |-- Pasted-*.txt                      # Notas de desarrollo
|   |-- tutorial-video.mp4               # Video tutorial para chat publico
|   `-- *.png                             # Capturas de pantalla
|
|-- client/                               # FRONTEND - React
|   |-- index.html                        # HTML entry point
|   |-- public/                           # Assets estaticos
|   |   |-- chat.html                     # Pagina publica del chat
|   |   |-- favicon.png
|   |   |-- logo-sanchez.png
|   |   `-- tutorial-video.mp4
|   |
|   `-- src/                              # Codigo fuente React
|       |-- main.tsx                      # Entry point React
|       |-- App.tsx                       # Router principal con logica de auth
|       |-- index.css                     # Estilos globales Tailwind
|       |
|       |-- lib/                          # Librerias utilitarias
|       |   |-- api.ts                    # Cliente API con Axios + JWT refresh
|       |   |-- queryClient.ts            # Configuracion TanStack React Query
|       |   `-- utils.ts                  # Helpers CSS (cn)
|       |
|       |-- hooks/                        # Custom React hooks
|       |   |-- use-mobile.tsx            # Deteccion de dispositivo movil
|       |   `-- use-toast.ts              # Hook de notificaciones toast
|       |
|       |-- components/                   # Componentes React
|       |   |-- app-sidebar.tsx           # Sidebar de navegacion principal
|       |   |-- appointment-dialog.tsx    # Modal crear/editar citas
|       |   |-- calendar-view.tsx         # Integracion FullCalendar
|       |   |-- capacity-indicators.tsx   # Barras de capacidad en tiempo real
|       |   |-- capacity-windows-table.tsx # Tabla de gestion de turnos (legacy)
|       |   |-- conflict-error-dialog.tsx # Dialogo de errores de capacidad
|       |   |-- confirm-dialog.tsx        # Modal de confirmacion generico
|       |   |-- providers-table.tsx       # Lista y gestion de proveedores
|       |   |-- role-badge.tsx            # Badge de rol de usuario
|       |   |-- theme-toggle.tsx          # Toggle modo oscuro/claro
|       |   |-- users-table.tsx           # Tabla de gestion de usuarios
|       |   |
|       |   `-- ui/                       # Libreria de componentes shadcn/ui (47 archivos)
|       |       |-- accordion.tsx, alert.tsx, alert-dialog.tsx, aspect-ratio.tsx,
|       |       |-- avatar.tsx, badge.tsx, breadcrumb.tsx, button.tsx,
|       |       |-- calendar.tsx, card.tsx, carousel.tsx, chart.tsx,
|       |       |-- checkbox.tsx, collapsible.tsx, command.tsx, context-menu.tsx,
|       |       |-- dialog.tsx, drawer.tsx, dropdown-menu.tsx, form.tsx,
|       |       |-- hover-card.tsx, input.tsx, input-otp.tsx, label.tsx,
|       |       |-- menubar.tsx, navigation-menu.tsx, pagination.tsx, popover.tsx,
|       |       |-- progress.tsx, radio-group.tsx, resizable.tsx, scroll-area.tsx,
|       |       |-- select.tsx, separator.tsx, sheet.tsx, sidebar.tsx,
|       |       |-- skeleton.tsx, slider.tsx, switch.tsx, table.tsx,
|       |       |-- tabs.tsx, textarea.tsx, toast.tsx, toaster.tsx,
|       |       |-- toggle.tsx, toggle-group.tsx, tooltip.tsx
|       |
|       `-- pages/                        # Paginas
|           |-- login.tsx                 # Pagina de autenticacion
|           |-- calendar-page.tsx         # Vista calendario principal
|           |-- appointments-page.tsx     # Lista de citas
|           |-- capacity-page.tsx         # Templates de slots y overrides
|           |-- providers-page.tsx        # Gestion de proveedores
|           |-- users-page.tsx            # Gestion de usuarios (solo admin)
|           |-- notifications-page.tsx    # Notificaciones email (solo admin)
|           |-- audit-page.tsx            # Visor de logs de auditoria
|           |-- chat-public.tsx           # Chat publico con IA
|           `-- not-found.tsx             # Pagina 404
|
|-- server/                               # BACKEND - Express.js
|   |-- index.ts                          # Setup Express, middleware, error handling
|   |-- routes.ts                         # Todos los endpoints API (~1700 lineas)
|   |-- swagger.ts                        # Documentacion Swagger/OpenAPI
|   |-- storage.ts                        # Configuracion de almacenamiento (NO USADO)
|   |-- vite.ts                           # Integracion Vite dev server
|   |
|   |-- db/                               # Conexion a base de datos
|   |   `-- client.ts                     # Singleton Prisma client
|   |
|   |-- middleware/                        # Middleware Express
|   |   `-- auth.ts                       # JWT auth + control de acceso basado en roles
|   |
|   |-- services/                         # Servicios de logica de negocio
|   |   |-- audit-service.ts              # Logging de auditoria con diffs JSON
|   |   |-- capacity-validator.ts         # Validacion legacy minuto a minuto
|   |   |-- email-service.ts             # Servicio de envio SMTP
|   |   |-- email-cron.ts                # Scheduler de resumen diario
|   |   |-- email-templates.ts           # Generador de templates HTML email
|   |   `-- slot-validator.ts             # Validacion de capacidad por slots con cache
|   |
|   |-- agent/                            # Agente de chat IA
|   |   |-- orchestrator.ts              # Orquestador principal (Claude Haiku)
|   |   |-- calculator.ts               # Logica de calculo de recursos
|   |   |-- memory.ts                    # Memoria de conversacion PostgreSQL
|   |   |-- prompts.ts                   # System prompts del agente (espanol)
|   |   |-- tools.ts                     # Tools del agente (calculator, calendar, booking)
|   |   `-- llm-clients.ts              # Inicializacion clientes LLM (Anthropic/OpenAI)
|   |
|   `-- utils/                            # Utilidades
|       `-- timezone.ts                   # Helpers timezone Europe/Madrid
|
|-- shared/                               # Codigo compartido (client + server)
|   |-- types.ts                          # Zod schemas y TypeScript types (~200 lineas)
|   |-- schema.ts                         # Definiciones de schema DB (Drizzle, NO USADO)
|   `-- schema-drizzle.ts                # Schema Drizzle ORM (alternativo, NO USADO)
|
`-- prisma/                               # Configuracion Prisma ORM
    |-- schema.prisma                     # Schema completo de base de datos
    |-- seed.ts                           # Script de seeding de desarrollo
    `-- migrations/                       # Migraciones
        |-- 20251028223225_init/
        |   `-- migration.sql
        `-- migration_lock.toml
```

---

## 2. STACK TECNOLOGICO

### Frontend

| Tecnologia | Version | Proposito |
|---|---|---|
| React | 18.3.1 | Framework UI |
| Vite | 5.4.20 | Bundler y dev server |
| TypeScript | 5.6.3 | Tipado estatico |
| TanStack React Query | 5.60.5 | Data fetching y cache |
| Wouter | 3.3.5 | Routing (alternativa ligera a React Router) |
| shadcn/ui (Radix UI) | Multiple | Componentes UI accesibles |
| Tailwind CSS | 3.4.17 | Utility-first CSS |
| FullCalendar | 6.1.15 | Vista de calendario interactiva |
| Recharts | 2.15.0 | Graficos y visualizaciones |
| Axios | (via api.ts) | Cliente HTTP |
| date-fns | 4.1.0 | Manipulacion de fechas |
| Zod | 3.23.8 | Validacion de schemas |
| React Hook Form | 7.53.2 | Formularios |

### Backend

| Tecnologia | Version | Proposito |
|---|---|---|
| Express.js | 4.21.1 | Framework HTTP server |
| Prisma ORM | 6.1.0 | ORM y migraciones |
| PostgreSQL | (via Prisma) | Base de datos relacional |
| jsonwebtoken | 9.0.2 | JWT tokens |
| bcryptjs | 2.4.3 | Hash de passwords |
| Nodemailer | 6.9.16 | Envio de emails SMTP |
| node-cron | 3.0.3 | Scheduler de tareas |
| Helmet | 8.0.0 | Seguridad HTTP headers |
| express-rate-limit | 7.4.1 | Rate limiting |
| Anthropic SDK | 0.39.0 | Cliente Claude AI |
| OpenAI SDK | 4.77.3 | Cliente OpenAI (fallback) |
| Swagger UI Express | 5.0.1 | Documentacion API |

### Build y Dev

| Tecnologia | Version | Proposito |
|---|---|---|
| esbuild | 0.25.0 | Bundle del server |
| tsx | 4.19.2 | TypeScript execution (dev) |
| PostCSS | 8.4.49 | Procesamiento CSS |
| Autoprefixer | 10.4.20 | Vendor prefixes CSS |
| Drizzle Kit | 0.31.4 | (configurado pero NO usado activamente) |

### Scripts NPM

```json
{
  "dev": "NODE_ENV=development tsx server/index.ts",
  "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc",
  "db:push": "drizzle-kit push"
}
```

---

## 3. BASE DE DATOS - SCHEMA PRISMA COMPLETO

**Archivo:** `prisma/schema.prisma`
**Proveedor:** PostgreSQL
**ORM:** Prisma Client JS
**Binary Targets:** native, debian-openssl-1.1.x, debian-openssl-3.0.x

### Enums

```prisma
enum UserRole {
  ADMIN
  PLANNER
  BASIC_READONLY
}

enum AppointmentSize {
  S    // Small: <=30 min, 1 punto
  M    // Medium: 31-90 min, 2 puntos
  L    // Large: >90 min, 3 puntos
}

enum EmailType {
  DAILY_SUMMARY
  ALERT
}

enum EmailStatus {
  SENT
  FAILED
  RETRYING
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
}

enum ActorType {
  USER
  CHAT_AGENT
  INTEGRATION
  SYSTEM
}

enum MessageRole {
  user
  assistant
  system
  tool
}
```

### Modelo: User

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  passwordHash        String    @map("password_hash")          // bcrypt hash
  role                UserRole  @default(BASIC_READONLY)
  refreshToken        String?   @map("refresh_token")          // Token de refresco
  refreshTokenExpires DateTime? @map("refresh_token_expires")  // Expiracion del refresh
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  @@map("users")
}
```

**Indices:** `email` (unique)
**Relaciones:** Ninguna directa

### Modelo: Provider

```prisma
model Provider {
  id           String        @id @default(cuid())
  name         String        @unique
  notes        String?
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  appointments Appointment[]

  @@map("providers")
}
```

**Indices:** `name` (unique)
**Relaciones:** 1:N con Appointment

### Modelo: CapacityShift (LEGACY)

```prisma
model CapacityShift {
  id        String   @id @default(cuid())
  startUtc  DateTime @map("start_utc")
  endUtc    DateTime @map("end_utc")
  workers   Int      @default(0)
  forklifts Int      @default(0)
  docks     Int?     @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([startUtc, endUtc])
  @@map("capacity_shifts")
}
```

**Indices:** Compuesto `[startUtc, endUtc]`
**Nota:** Sistema legacy de validacion minuto a minuto

### Modelo: SlotTemplate (v2.0 - SISTEMA PRINCIPAL)

```prisma
model SlotTemplate {
  id        String   @id @default(cuid())
  dayOfWeek Int      @map("day_of_week")    // 0=Domingo, 6=Sabado
  startTime String   @map("start_time")     // Formato "HH:mm"
  endTime   String   @map("end_time")       // Formato "HH:mm"
  maxPoints Int      @default(6) @map("max_points")
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([dayOfWeek])
  @@map("slot_templates")
}
```

**Indices:** `dayOfWeek`
**Uso:** Plantillas semanales recurrentes de slots de 2h

### Modelo: SlotOverride (v2.0 - EXCEPCIONES)

```prisma
model SlotOverride {
  id        String   @id @default(cuid())
  date      DateTime                          // Fecha especifica
  startTime String?  @map("start_time")       // Opcional: hora inicio
  endTime   String?  @map("end_time")         // Opcional: hora fin
  maxPoints Int      @default(0) @map("max_points")
  reason    String?                           // Motivo (festivo, etc.)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([date])
  @@map("slot_overrides")
}
```

**Indices:** `date`
**Uso:** Excepciones de capacidad para fechas especificas (festivos, eventos especiales)

### Modelo: Appointment

```prisma
model Appointment {
  id                 String           @id @default(cuid())
  providerId         String?          @map("provider_id")
  provider           Provider?        @relation(fields: [providerId], references: [id], onDelete: SetNull)
  providerName       String           @map("provider_name")
  startUtc           DateTime         @map("start_utc")
  endUtc             DateTime         @map("end_utc")
  workMinutesNeeded  Int              @map("work_minutes_needed")
  forkliftsNeeded    Int              @map("forklifts_needed")
  goodsType          String?          @map("goods_type")
  units              Int?
  lines              Int?
  deliveryNotesCount Int?             @map("delivery_notes_count")
  externalRef        String?          @unique @map("external_ref")
  size               AppointmentSize?
  pointsUsed         Int?             @map("points_used")
  slotDate           DateTime?        @map("slot_date")
  slotStartTime      String?          @map("slot_start_time")
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")

  @@index([startUtc])
  @@index([endUtc])
  @@index([providerName])
  @@index([slotDate, slotStartTime])
  @@map("appointments")
}
```

**Indices:** `startUtc`, `endUtc`, `providerName`, compuesto `[slotDate, slotStartTime]`, unique `externalRef`
**Relaciones:** N:1 con Provider (onDelete: SetNull)

### Modelo: EmailRecipient

```prisma
model EmailRecipient {
  id                   String   @id @default(cuid())
  email                String   @unique
  name                 String
  receivesDailySummary Boolean  @default(true) @map("receives_daily_summary")
  receivesAlerts       Boolean  @default(true) @map("receives_alerts")
  receivesUrgent       Boolean  @default(true) @map("receives_urgent")
  active               Boolean  @default(true)
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  @@map("email_recipients")
}
```

**Indices:** `email` (unique)

### Modelo: EmailLog

```prisma
model EmailLog {
  id             String      @id @default(cuid())
  recipientEmail String      @map("recipient_email")
  type           EmailType
  subject        String
  status         EmailStatus @default(SENT)
  sentAt         DateTime?   @map("sent_at")
  error          String?
  createdAt      DateTime    @default(now()) @map("created_at")

  @@index([createdAt])
  @@index([recipientEmail])
  @@map("email_log")
}
```

**Indices:** `createdAt`, `recipientEmail`

### Modelo: AuditLog

```prisma
model AuditLog {
  id         String      @id @default(cuid())
  entityType String      @map("entity_type")
  entityId   String      @map("entity_id")
  action     AuditAction
  actorType  ActorType   @map("actor_type")
  actorId    String?     @map("actor_id")
  changes    Json?
  createdAt  DateTime    @default(now()) @map("created_at")

  @@index([entityType, entityId])
  @@index([createdAt])
  @@index([actorType])
  @@map("audit_log")
}
```

**Indices:** compuesto `[entityType, entityId]`, `createdAt`, `actorType`

### Modelo: Conversation

```prisma
model Conversation {
  id        String    @id @default(cuid())
  sessionId String    @unique @map("session_id")
  metadata  Json?
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  messages  Message[]

  @@index([sessionId])
  @@map("conversations")
}
```

**Indices:** `sessionId` (unique + index)
**Relaciones:** 1:N con Message

### Modelo: Message

```prisma
model Message {
  id             String       @id @default(cuid())
  conversationId String       @map("conversation_id")
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           MessageRole
  content        String
  metadata       Json?
  createdAt      DateTime     @default(now()) @map("created_at")

  @@index([conversationId])
  @@index([createdAt])
  @@map("messages")
}
```

**Indices:** `conversationId`, `createdAt`
**Relaciones:** N:1 con Conversation (onDelete: Cascade)

### Diagrama de relaciones

```
User (independiente)

Provider --1:N--> Appointment (onDelete: SetNull)

SlotTemplate (independiente, plantillas semanales)
SlotOverride (independiente, excepciones por fecha)
CapacityShift (independiente, legacy)

Conversation --1:N--> Message (onDelete: Cascade)

EmailRecipient (independiente)
EmailLog (independiente)
AuditLog (independiente)
```

---

## 4. API - TODOS LOS ENDPOINTS

### 4.1 Health y Assets

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| `GET` | `/api/health` | Ninguna | Health check - prueba conexion DB, retorna `{ status, database, timestamp }` |
| `GET` | `/logo-sanchez.png` | Ninguna | Sirve el logo desde `client/public` |
| `GET` | `/docs` | Ninguna | Documentacion Swagger UI |
| `GET` | `/api-json` | Ninguna | Spec OpenAPI en JSON |

### 4.2 Autenticacion

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | Ninguna | `{ email, password }` | Login: compara bcrypt, genera JWT (24h) y refresh token (7d). Retorna `{ token, user, refreshToken }` |
| `GET` | `/api/auth/me` | JWT | - | Retorna datos del usuario autenticado `{ id, email, role }` |
| `POST` | `/api/auth/refresh` | Ninguna | `{ refreshToken }` | Valida refresh token no expirado, genera nuevo JWT. Retorna `{ token, refreshToken }` |

> **NOTA:** No existe endpoint de logout. Ver seccion de problemas.

### 4.3 Proveedores

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/providers` | JWT | - | Lista todos los proveedores ordenados por nombre |
| `POST` | `/api/providers` | JWT + ADMIN/PLANNER | `{ name, notes? }` | Crea proveedor, registra audit log |
| `PUT` | `/api/providers/:id` | JWT + ADMIN/PLANNER | `{ name?, notes? }` | Actualiza proveedor, registra cambios en audit |
| `DELETE` | `/api/providers/:id` | JWT + ADMIN/PLANNER | - | Elimina proveedor, registra en audit |

### 4.4 Capacity Shifts (Legacy)

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/capacity-shifts` | JWT | Query: `from?`, `to?` | Lista turnos filtrados por rango de fechas |
| `POST` | `/api/capacity-shifts` | JWT + ADMIN/PLANNER | `{ start, end, workers, forklifts, docks? }` | Crea turno de capacidad |
| `PUT` | `/api/capacity-shifts/:id` | JWT + ADMIN/PLANNER | Campos parciales | Actualiza turno |
| `DELETE` | `/api/capacity-shifts/:id` | JWT + ADMIN/PLANNER | - | Elimina turno |

### 4.5 Slot Templates (v2.0)

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/slot-templates` | JWT | - | Lista plantillas ordenadas por dia y hora |
| `POST` | `/api/slot-templates` | JWT + ADMIN/PLANNER | `{ dayOfWeek, startTime, endTime, maxPoints? }` | Crea plantilla de slot recurrente |
| `PUT` | `/api/slot-templates/:id` | JWT + ADMIN/PLANNER | Campos parciales | Actualiza plantilla |
| `DELETE` | `/api/slot-templates/:id` | JWT + ADMIN/PLANNER | - | Elimina plantilla |

### 4.6 Slot Overrides (v2.0)

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/slot-overrides` | JWT | Query: `from?`, `to?` | Lista excepciones filtradas por rango |
| `POST` | `/api/slot-overrides` | JWT + ADMIN/PLANNER | `{ date, startTime?, endTime?, maxPoints, reason? }` | Crea excepcion de capacidad para fecha |
| `PUT` | `/api/slot-overrides/:id` | JWT + ADMIN/PLANNER | Campos parciales | Actualiza excepcion |
| `DELETE` | `/api/slot-overrides/:id` | JWT + ADMIN/PLANNER | - | Elimina excepcion |

### 4.7 Disponibilidad de Slots

| Metodo | Ruta | Auth | Query Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/slots/availability` | JWT | `date` (requerido), `points?` (default 1) | Retorna slots disponibles para una fecha con `{ startTime, endTime, maxPoints, pointsUsed, pointsAvailable, isOverride, reason, hasCapacity }` |
| `GET` | `/api/slots/usage` | JWT | `from` (requerido), `to` (requerido) | Uso de slots por dia en rango `{ date, slots: [] }` |

### 4.8 Citas (Appointments)

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/appointments` | JWT | Query: `from?`, `to?`, `providerId?` | Lista citas filtradas, ordenadas por startUtc |
| `POST` | `/api/appointments` | JWT + ADMIN/PLANNER | `{ providerId?, providerName, start, end, workMinutesNeeded, forkliftsNeeded, goodsType?, units?, lines?, deliveryNotesCount?, externalRef? }` | Crea cita con validacion de capacidad (transaccion Serializable), calcula size/points, envia alerta email, registra audit. Retorna 409 si conflicto |
| `PUT` | `/api/appointments/:id` | JWT + ADMIN/PLANNER | Campos parciales | Actualiza cita, revalida capacidad, recalcula size/points |
| `DELETE` | `/api/appointments/:id` | JWT + ADMIN/PLANNER | - | Elimina cita, envia alerta, registra audit |

### 4.9 Capacidad Analitica

| Metodo | Ruta | Auth | Query Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/capacity/at-minute` | JWT | `minute` (ISO date, requerido) | Capacidad en tiempo real para un minuto especifico |
| `GET` | `/api/capacity/utilization` | JWT | `startDate`, `endDate` (requeridos) | Porcentaje de utilizacion del almacen en rango |

### 4.10 Chat Publico

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `POST` | `/api/chat/message` | Ninguna | `{ sessionId, message }` | Envia mensaje al agente IA, retorna SSE (Server-Sent Events) con chunks en streaming |
| `GET` | `/api/chat/history/:sessionId` | Ninguna | Param: sessionId | Carga historial de conversacion |
| `GET` | `/chat` | Ninguna | - | Pagina publica del chat (HTML) |

**Rate limiting chat:** 20 peticiones/minuto

### 4.11 Integracion Externa

**Todas requieren header `X-API-Key`** (excepto upsert que usa JWT). Rate limit: 50 req/min.

| Metodo | Ruta | Auth | Body | Descripcion |
|---|---|---|---|---|
| `POST` | `/api/integration/appointments/upsert` | JWT (!) | `{ externalRef, providerId?, providerName, start, end, workMinutesNeeded, forkliftsNeeded, ... }` | Crea o actualiza cita por externalRef. Retorna `{ action: "created"/"updated", appointment }` |
| `POST` | `/api/integration/calendar/parse` | API Key | `{ query }` (string u objeto) | Parsea consulta de calendario a formato normalizado |
| `POST` | `/api/integration/calendar/availability` | API Key | `{ from, to, duration_minutes }` | Busca slots disponibles en rango, convierte duracion a puntos. Retorna hasta 3 slots |
| `POST` | `/api/integration/calendar/book` | API Key | `{ start, end, providerName, goodsType?, units?, lines?, workMinutesNeeded?, forkliftsNeeded? }` | Reserva cita con auto-retry (3 intentos +30min). Retorna confirmacion HTML o 409 |
| `GET` | `/api/integration/appointments/by-external-ref/:externalRef` | JWT | - | Busca cita por referencia externa |

### 4.12 Usuarios (Solo ADMIN)

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/users` | JWT + ADMIN | - | Lista usuarios (email, role, timestamps) sin passwordHash |
| `POST` | `/api/users` | JWT + ADMIN | `{ email, password, role }` | Crea usuario (bcrypt cost 10), registra audit. 409 si email duplicado |
| `PUT` | `/api/users/:id` | JWT + ADMIN | `{ email?, role? }` | Actualiza usuario |
| `DELETE` | `/api/users/:id` | JWT + ADMIN | - | Elimina usuario |

### 4.13 Notificaciones Email (Solo ADMIN)

| Metodo | Ruta | Auth | Body/Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/email-recipients` | JWT + ADMIN | - | Lista destinatarios de email |
| `POST` | `/api/email-recipients` | JWT + ADMIN | `{ email, name, receivesDailySummary?, receivesAlerts?, receivesUrgent? }` | Suscribe destinatario |
| `PUT` | `/api/email-recipients/:id` | JWT + ADMIN | Campos parciales | Actualiza preferencias |
| `DELETE` | `/api/email-recipients/:id` | JWT + ADMIN | - | Elimina destinatario |
| `GET` | `/api/email-log` | JWT + ADMIN | Query: `limit?` (max 200), `offset?` | Logs de emails enviados paginados |
| `POST` | `/api/email/test` | JWT + ADMIN | `{ to }` | Envia email de prueba para verificar SMTP |

### 4.14 Auditoria (ADMIN/PLANNER)

| Metodo | Ruta | Auth | Query Params | Descripcion |
|---|---|---|---|---|
| `GET` | `/api/audit-log` | JWT + ADMIN/PLANNER | `entityType?`, `action?`, `actorType?`, `from?`, `to?`, `limit?` (max 200), `offset?` | Logs de auditoria con filtros multiples, paginado |

### Resumen de Rate Limiting

| Grupo | Limite | Ventana |
|---|---|---|
| Login | 10 peticiones | 15 minutos |
| Chat | 20 peticiones | 1 minuto |
| API general | 200 peticiones | 1 minuto |
| Integracion | 50 peticiones | 1 minuto |

---

## 5. FRONTEND

### 5.1 Routing (App.tsx)

```typescript
// Rutas protegidas (requieren JWT)
"/"              -> CalendarPage         // Todos los roles
"/appointments"  -> AppointmentsPage     // Todos los roles
"/capacity"      -> CapacityPage         // ADMIN, PLANNER
"/providers"     -> ProvidersPage        // ADMIN, PLANNER
"/users"         -> UsersPage            // Solo ADMIN
"/notifications" -> NotificationsPage    // Solo ADMIN
"/audit"         -> AuditPage            // ADMIN, PLANNER

// Rutas publicas
"/login"         -> LoginPage
"/chat"          -> ChatPublicPage       // Sin autenticacion
"*"              -> NotFoundPage
```

### 5.2 Flujo de autenticacion en el frontend

1. App.tsx monta y busca token en `localStorage("authToken")`
2. Si existe token -> llama `GET /api/auth/me` para validar
3. Si valido -> carga rutas protegidas filtradas por rol
4. Si 401 -> intenta refresh con `POST /api/auth/refresh`
5. Si refresh falla -> limpia tokens, redirige a `/login`
6. Logout -> limpia `authToken` y `refreshToken` de localStorage

### 5.3 Cliente API (lib/api.ts)

```typescript
// Namespaces del cliente API:
authApi           // login, me, logout
providersApi      // CRUD proveedores
capacityShiftsApi // CRUD turnos de capacidad (legacy)
appointmentsApi   // CRUD citas + checks de capacidad
capacityApi       // Datos de utilizacion
usersApi          // CRUD usuarios con roles
slotTemplatesApi  // CRUD plantillas de slots
slotOverridesApi  // CRUD excepciones de slots
slotsApi          // Disponibilidad y uso
emailRecipientsApi // CRUD destinatarios email
emailApi          // Log y envio de pruebas
auditApi          // Consulta logs de auditoria
```

**Interceptor de errores:**
- En respuesta 401 -> intenta auto-refresh del token
- Si refresh falla -> `window.location.href = "/login"`
- Tokens almacenados en `localStorage`

### 5.4 Paginas detalladas

#### Login (`/login` - login.tsx)
- Formulario email/password
- Credenciales por defecto: `admin@admin.com` / `admin123`
- Almacena tokens en localStorage al login exitoso
- Sesiones de 7 dias (refresh token)

#### Calendario (`/` - calendar-page.tsx + calendar-view.tsx)
- Integracion FullCalendar (vistas dia/semana)
- Indicadores de capacidad en tiempo real (capacity-indicators.tsx)
- Arrastrar para reprogramar citas
- Click para crear/editar
- Modo solo lectura para BASIC_READONLY (oculta acciones)
- Colores por talla: S=azul, M=naranja, L=rojo

#### Citas (`/appointments` - appointments-page.tsx)
- Tabla ordenable y filtrable
- Busqueda por proveedor
- Edicion/eliminacion inline con confirmacion
- Boton de crear nueva cita
- Muestra dialogo de conflicto si error de capacidad

#### Gestion de Capacidad (`/capacity` - capacity-page.tsx)
Dos pestanas:

**Tab 1 - Slot Templates:**
- Matriz semanal de slots con puntos maximos por dia
- Crear plantillas de slots para Lun-Sab
- Toggle de estado activo y edicion de puntos maximos
- Eliminar filas completas de slots

**Tab 2 - Slot Overrides:**
- Excepciones por fecha con hora y motivo opcionales
- Crear/eliminar excepciones
- Campos: fecha, hora inicio (opc.), hora fin (opc.), puntos maximos, motivo

#### Proveedores (`/providers` - providers-page.tsx)
- Tabla con nombre y notas
- Edicion inline
- Botones agregar/eliminar

#### Usuarios (`/users` - users-page.tsx)
- Solo visible para ADMIN
- Tabla con email, rol, acciones
- Formulario de creacion
- Editar email/rol
- Eliminacion con confirmacion

#### Notificaciones (`/notifications` - notifications-page.tsx)
- Solo visible para ADMIN
- Gestion de destinatarios email
- Preferencias de suscripcion (resumen diario, alertas, urgente)
- Log de envio de emails con estado
- Boton de email de prueba

#### Auditoria (`/audit` - audit-page.tsx)
- Visible para ADMIN y PLANNER
- Trail de auditoria filtrable
- Filtros: tipo entidad, accion, tipo actor, rango de fechas
- Display de diff JSON para updates

#### Chat Publico (`/chat` - chat-public.tsx)
- Sin autenticacion requerida
- Interfaz conversacional con IA (Elias Ortega)
- Seccion de video tutorial
- Streaming de mensajes via SSE
- Reserva de citas via chat
- Historial de conversacion respaldado en PostgreSQL

### 5.5 Componentes clave

| Componente | Archivo | Proposito |
|---|---|---|
| AppSidebar | `app-sidebar.tsx` | Navegacion principal con filtrado por rol |
| AppointmentDialog | `appointment-dialog.tsx` | Modal crear/editar citas con validacion |
| CalendarView | `calendar-view.tsx` | Wrapper de FullCalendar con configuracion |
| CapacityIndicators | `capacity-indicators.tsx` | Barras de utilizacion con codigos de color |
| CapacityWindowsTable | `capacity-windows-table.tsx` | Tabla editable de turnos (legacy) |
| ConflictErrorDialog | `conflict-error-dialog.tsx` | Display detallado de errores de capacidad |
| ConfirmDialog | `confirm-dialog.tsx` | Modal de confirmacion reutilizable |
| ProvidersTable | `providers-table.tsx` | Tabla CRUD de proveedores |
| RoleBadge | `role-badge.tsx` | Badge visual de rol de usuario |
| ThemeToggle | `theme-toggle.tsx` | Switch modo oscuro/claro |
| UsersTable | `users-table.tsx` | Tabla CRUD de usuarios |

### 5.6 Design System

- **Framework:** Microsoft Fluent Design
- **Colores:** Primary blue #0B6DD9, status colors (green/amber/red/gray)
- **Tipografia:** Segoe UI (principal), SF Mono/Consolas (monospace)
- **Modo oscuro:** Soporte completo via clases CSS
- **Componentes:** 47 componentes shadcn/ui (Radix UI + Tailwind)
- **Animaciones:** fadeIn, slideUp, slideIn (minimalistas)
- **Responsive:** Mobile stack, tablet side-by-side, desktop full

---

## 6. AGENTE IA - ORQUESTADOR

### 6.1 Arquitectura general

```
Usuario (chat publico)
    |
    v
POST /api/chat/message  (SSE streaming)
    |
    v
AgentOrchestrator (orchestrator.ts)
    |-- Modelo: claude-haiku-4-5-20250514 (Anthropic)
    |-- Max tokens: 2048
    |-- System prompt: prompts.ts (espanol)
    |-- Memory: ConversationMemory (PostgreSQL)
    |
    |-- Tool: calculator -> calculator.ts
    |-- Tool: calendar_availability -> POST /api/integration/calendar/availability
    |-- Tool: calendar_book -> POST /api/integration/calendar/book
```

### 6.2 Modelo LLM

**Principal:**
- Modelo: `claude-haiku-4-5-20250514`
- SDK: `@anthropic-ai/sdk` v0.39.0
- Max tokens: 2048
- Streaming habilitado

**Fallback (solo para calculadora):**
- Modelo: `gpt-4.1` (OpenAI)
- Max tokens: 500
- Temperature: 0.1
- Response format: JSON object

### 6.3 System Prompt completo

```
Eres Elias Ortega, Agente de Citas del almacen Centro Hogar Sanchez.
Hablas siempre en espanol, profesional y conciso.

Hoy: {{ NOW }} (Europe/Madrid)

Franjas horarias (sistema de puntos):
- Lun-Vie: 08:00-10:00, 10:00-12:00, 12:00-14:00 (6 pts cada una)
- Sab: 08:00-11:00, 11:00-14:00 (4 pts cada una)
- Dom: cerrado

Tallas de cita: S (<=30min, 1pt), M (31-90min, 2pts), L (>90min, 3pts)

FLUJO:
1. DATOS: Pregunta empresa, tipo mercancia, unidades, lineas, albaranes
2. CALCULO: Usa calculator con los datos recopilados. Muestra resultado al usuario.
3. BUSQUEDA: Pregunta fecha preferida. Usa calendar_availability para buscar
   franjas con puntos libres.
4. RESERVA: Presenta opciones, usuario elige. Usa calendar_book para confirmar.

REGLAS:
- No preguntes fecha antes del calculo
- Rechaza domingos y fechas pasadas
- Si no hay espacio, ofrece siguiente disponible
- Si el usuario modifica datos, recalcula
- Confirma todo antes de reservar
```

La variable `{{ NOW }}` se reemplaza en runtime con la fecha/hora actual en Europe/Madrid.

### 6.4 Tools del agente

#### Tool 1: `calculator`
```json
{
  "name": "calculator",
  "description": "Calcula los recursos necesarios (tiempo, carretillas, operarios)
    para una entrega basandose en el tipo de mercancia, unidades, lineas y albaranes.",
  "input_schema": {
    "providerName": "string (opcional)",
    "goodsType": "string (REQUERIDO) - ej: Colchones, Sofas, Electrodomesticos...",
    "units": "number (REQUERIDO) - unidades/bultos",
    "lines": "number (REQUERIDO) - lineas/referencias",
    "albaranes": "number (REQUERIDO) - documentos de entrega"
  }
}
```

#### Tool 2: `calendar_availability`
```json
{
  "name": "calendar_availability",
  "description": "Busca slots de citas disponibles en el calendario del almacen.",
  "input_schema": {
    "from": "ISO 8601 (REQUERIDO) - inicio busqueda",
    "to": "ISO 8601 (REQUERIDO) - fin busqueda",
    "duration_minutes": "number (REQUERIDO) - duracion estimada",
    "providerName": "string (REQUERIDO)",
    "goodsType": "string (REQUERIDO)",
    "units": "number (REQUERIDO)",
    "lines": "number (REQUERIDO)",
    "albaranes": "number (REQUERIDO)",
    "workMinutesNeeded": "number (REQUERIDO)",
    "forkliftsNeeded": "number (REQUERIDO)"
  }
}
```

Implementacion: hace POST a `/api/integration/calendar/availability` con header `X-API-Key`.

#### Tool 3: `calendar_book`
```json
{
  "name": "calendar_book",
  "description": "Reserva una cita en el calendario del almacen.",
  "input_schema": {
    "start": "ISO 8601 (REQUERIDO) - inicio cita",
    "end": "ISO 8601 (REQUERIDO) - fin cita",
    "providerName": "string (REQUERIDO)",
    "goodsType": "string (REQUERIDO)",
    "units": "number (REQUERIDO)",
    "lines": "number (REQUERIDO)",
    "albaranes": "number (REQUERIDO)",
    "workMinutesNeeded": "number (REQUERIDO)",
    "forkliftsNeeded": "number (REQUERIDO)"
  }
}
```

Implementacion: hace POST a `/api/integration/calendar/book` con header `X-API-Key`.

### 6.5 Flujo del orquestador

```
1. Usuario envia mensaje
   |
2. Guarda mensaje en memoria (PostgreSQL)
   |
3. Recupera historial (max 30 mensajes, usa ultimos 20)
   |-- Trunca mensajes >2000 chars a 1900 + "[truncado por tamano]"
   |-- Convierte a formato Anthropic MessageParam
   |
4. LOOP (max 5 iteraciones):
   |
   |-- Llama Claude Haiku con streaming
   |   |-- system: getMainAgentPrompt(now)
   |   |-- messages: historial + mensajes acumulados
   |   |-- tools: AGENT_TOOLS
   |
   |-- Procesa stream:
   |   |-- content_block_delta (text) -> yield "text" chunk
   |   |-- content_block_start (tool_use) -> yield "tool_use" chunk
   |   |-- message_delta (stop_reason) -> marca continuar/parar
   |
   |-- Si stop_reason == "tool_use":
   |   |-- Para cada tool_use encontrado:
   |   |   |-- yield "thinking" chunk
   |   |   |-- Ejecuta executeToolCall(name, input)
   |   |   |-- yield "tool_result" chunk
   |   |-- Agrega assistant message + tool results al historial
   |   |-- Continua al siguiente LOOP
   |
   |-- Si stop_reason == "end_turn" o "max_tokens":
   |   |-- Sale del loop
   |
5. Guarda respuesta final en memoria
   |
6. yield "done" chunk con respuesta completa
```

### 6.6 Streaming SSE

El endpoint `POST /api/chat/message` usa Server-Sent Events:

```typescript
// Headers SSE
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.flushHeaders();

// Tipos de chunks enviados:
"text"        // Texto incremental del asistente
"thinking"    // "Procesando {toolName}..."
"tool_use"    // Notificacion de uso de herramienta
"tool_result" // Resultado de la herramienta
"done"        // Respuesta final completa
"error"       // Error (si ocurre)

// Terminacion
res.write("data: [DONE]\n\n");
res.end();
```

### 6.7 Memoria de conversacion (memory.ts)

- **Almacenamiento:** PostgreSQL via Prisma (tablas `conversations` y `messages`)
- **Identificador:** `sessionId` (unico por sesion de chat)
- **Limite:** 30 mensajes por conversacion (configurable)
- **Operaciones:**
  - `getOrCreateConversation()` - Busca o crea conversacion
  - `getHistory()` - Ultimos N mensajes en orden cronologico
  - `addUserMessage(content)` - Guarda mensaje del usuario
  - `addAssistantMessage(content)` - Guarda respuesta del asistente
  - `clear()` - Elimina todos los mensajes de la conversacion

---

## 7. CALCULADORA DE RECURSOS

### 7.1 Categorias y coeficientes

| Categoria | TD (fijo) | TA (por albaran) | TL (por linea) | TU (por unidad) | Carretilla |
|---|---|---|---|---|---|
| Asientos | 48.88 | 5.49 | 0.00 | 1.06 | Si |
| Bano | 3.11 | 11.29 | 0.61 | 0.00 | No |
| Cocina | 10.67 | 0.00 | 4.95 | 0.04 | No |
| Colchoneria | 14.83 | 0.00 | 4.95 | 0.12 | Si |
| Electro | 33.49 | 0.81 | 0.00 | 0.31 | Si |
| Mobiliario | 23.20 | 0.00 | 2.54 | 0.25 | Si |
| PAE | 6.67 | 8.33 | 0.00 | 0.00 | No |
| Tapiceria | 34.74 | 0.00 | 2.25 | 0.10 | Si |

### 7.2 Formula de calculo de tiempo

**Para la categoria "Asientos"** (caso especial, sin TD):
```
rawMinutes = (units * TU) + (albaranes * TA) + (lines * TL)
```

**Para todas las demas categorias:**
```
rawMinutes = (units === 0 ? 0 : TD) + (units * TU) + (albaranes * TA) + (lines * TL)
```

Donde:
- `TD` = Tiempo fijo por descarga (solo se aplica si hay unidades > 0)
- `TA` = Tiempo por albaran
- `TL` = Tiempo por linea
- `TU` = Tiempo por unidad

### 7.3 Redondeo "humano"

```typescript
function humanRound(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 15;              // Minimo 15 minutos
  if (minutes <= 44) return Math.floor(minutes / 10) * 10;   // Redondea hacia abajo a 10
  if (minutes <= 94) return Math.round(minutes / 5) * 5;     // Redondea al 5 mas cercano
  return Math.ceil(minutes / 10) * 10;                        // Redondea hacia arriba a 10
}
```

### 7.4 Calculo de carretillas

```typescript
if (!coeff.usesForklift) {
  forkliftsNeeded = 0;                  // Bano, Cocina, PAE no necesitan
} else if (workMinutes >= 90) {
  forkliftsNeeded = 2;                  // Trabajos largos: 2 carretillas
} else {
  forkliftsNeeded = 1;                  // Normal: 1 carretilla
}
```

### 7.5 Calculo de operarios

```typescript
let workersNeeded: number;
if (workMinutes <= 30) workersNeeded = 1;        // Trabajos cortos
else if (workMinutes <= 90) workersNeeded = 2;   // Trabajos medios
else workersNeeded = 3;                           // Trabajos largos

// Especialista adicional para tapiceria/asientos
if (category === "Tapiceria" || category === "Asientos") {
  workersNeeded += 1;
}

workersNeeded = Math.min(workersNeeded, 4);       // Maximo 4 operarios
```

### 7.6 Sinonimos de categorias

El sistema reconoce mas de 60 sinonimos para mapear al nombre de categoria correcto:

```
"sillas", "banquetas", "taburetes"           -> Asientos
"bano", "sanitario", "grifo", "plato ducha"  -> Bano
"cocina", "horno", "campana"                 -> Cocina
"colchon", "colchones", "descanso"           -> Colchoneria
"electro", "electrodomesticos", "lavadora"   -> Electro
"mobiliario", "canape", "muebles", "estante" -> Mobiliario
"pae", "pequeno electrodomestico"            -> PAE
"sofa", "sillones", "chaiselongue"           -> Tapiceria
```

### 7.7 Cadena de fallback

```
1. Intenta calculo DETERMINISTICO con normalizeCategory()
   |
   |-- Exito -> retorna resultado calculado
   |-- Fallo -> categoria no reconocida
   |
2. Intenta calculo con LLM (OpenAI gpt-4.1)
   |-- System prompt con tabla de coeficientes
   |-- Temperature 0.1, max_tokens 500
   |-- Response format: JSON
   |-- Exito -> retorna resultado del LLM
   |-- Fallo -> API error o respuesta invalida
   |
3. Retorna FALLBACK HARDCODED:
   {
     "categoria_elegida": "Mobiliario",
     "work_minutes_needed": 60,
     "forklifts_needed": 1,
     "workers_needed": 2,
     "duration_min": 60
   }
```

---

## 8. SISTEMA DE VALIDACION DE CAPACIDAD

### 8.1 Sistema v2.0 - Slots basados en puntos (slot-validator.ts)

**Concepto:** El almacen se divide en franjas horarias (slots) de 2 horas. Cada slot tiene un numero maximo de "puntos" que representan la capacidad de trabajo simultaneo.

**Tallas y puntos:**
```
S (Small):  <= 30 minutos = 1 punto
M (Medium): 31-90 minutos = 2 puntos
L (Large):  > 90 minutos  = 3 puntos
```

**Slots por defecto (definidos en system prompt):**
```
Lunes a Viernes:
  08:00-10:00  (6 puntos max)
  10:00-12:00  (6 puntos max)
  12:00-14:00  (6 puntos max)

Sabado:
  08:00-11:00  (4 puntos max)
  11:00-14:00  (4 puntos max)

Domingo: CERRADO
```

**Flujo de validacion:**

```
1. getSlotsForDate(date):
   |-- Obtiene dia de la semana
   |-- Busca SlotTemplates para ese dia (con cache 5min TTL)
   |-- Busca SlotOverrides para esa fecha exacta
   |-- Si hay override con startTime/endTime -> reemplaza el slot original
   |-- Si hay override sin horario (solo maxPoints=0) -> bloquea todo el dia
   |-- Retorna lista de slots activos con su configuracion

2. getSlotUsage(date, startTime):
   |-- Busca citas existentes para ese slot (slotDate + slotStartTime)
   |-- Suma pointsUsed de todas las citas
   |-- Retorna total de puntos usados

3. validateSlotCapacity(date, startTime, pointsNeeded, excludeId?):
   |-- Obtiene slots para la fecha
   |-- Encuentra el slot que coincide con startTime
   |-- Calcula puntos usados (excluye excludeId para ediciones)
   |-- Compara: puntosUsados + puntosNecesarios <= maxPoints
   |-- Retorna { valid, available, used, max } o error
```

**Cache:**
- Templates cacheados por dayOfWeek
- TTL: 5 minutos
- Se invalida automaticamente al expirar

### 8.2 Sistema legacy - Validacion minuto a minuto (capacity-validator.ts)

**Concepto:** Valida 3 recursos (operarios, carretillas, muelles) minuto a minuto durante la duracion de la cita.

**Capacidad por defecto:**
```typescript
Lunes-Viernes: { workers: 3, forklifts: 2, docks: 3, start: "08:00", end: "19:00" }
Sabado:        { workers: 2, forklifts: 1, docks: 2, start: "08:00", end: "14:00" }
Domingo:       { workers: 0, forklifts: 0, docks: 0 } // Cerrado
```

Estos valores se pueden sobreescribir con variables de entorno: `DEFAULT_WORKERS`, `DEFAULT_FORKLIFTS`, `DEFAULT_DOCKS`.

**Flujo de validacion:**

```
1. validateAppointment(start, end, workMinutes, forklifts, excludeId?):
   |
   |-- Calcula work rate: workMinutesNeeded / duracionEnMinutos
   |-- Para CADA MINUTO del rango [start, end):
   |   |-- Obtiene capacidad disponible (CapacityShift o defaults)
   |   |-- Suma uso de TODAS las citas que se solapan en ese minuto
   |   |-- Comprueba:
   |   |   - workRate + workUsed <= workers disponibles
   |   |   - forkliftsNeeded + forkliftsUsed <= forklifts disponibles
   |   |   - 1 + docksUsed <= docks disponibles (1 muelle por cita)
   |   |-- Si falla -> retorna CapacityConflictError con:
   |   |   - Minuto exacto (UTC y Madrid)
   |   |   - Recursos usados/disponibles
   |   |   - Regla que fallo (work/forklifts/docks)
   |
   |-- Si todo pasa -> retorna null (sin conflicto)
```

**Funciones adicionales:**
- `getCapacityAtMinute(minute)` - Snapshot de capacidad en tiempo real para UI
- `calculateUtilization(startDate, endDate)` - Porcentaje de uso en rango

### 8.3 Como interactuan ambos sistemas

En `routes.ts`, al crear/actualizar una cita:

```typescript
// 1. Se calcula talla y puntos (slot system)
const durationMinutes = differenceInMinutes(endDate, startDate);
let size: "S" | "M" | "L";
let pointsUsed: number;
if (durationMinutes <= 30) { size = "S"; pointsUsed = 1; }
else if (durationMinutes <= 90) { size = "M"; pointsUsed = 2; }
else { size = "L"; pointsUsed = 3; }

// 2. Se valida con el sistema legacy (minuto a minuto)
const conflict = await capacityValidator.validateAppointment(
  startDate, endDate, workMinutesNeeded, forkliftsNeeded, excludeId
);
if (conflict) return res.status(409).json(conflict);

// 3. Se crea la cita con los datos de ambos sistemas
const appointment = await prisma.appointment.create({
  data: {
    ...otherFields,
    size,
    pointsUsed,
    slotDate: startDate,           // Fecha del slot
    slotStartTime: formatTime(startDate) // Hora inicio "HH:mm"
  }
});
```

**Nota importante:** El sistema de slots (v2.0) calcula `size` y `pointsUsed` pero la validacion de capacidad real la hace el sistema legacy (minuto a minuto). No hay cross-validation entre ambos sistemas.

---

## 9. AUTENTICACION

### 9.1 Configuracion JWT

```typescript
// server/middleware/auth.ts
const JWT_SECRET = process.env.JWT_SECRET;  // OBLIGATORIO - process.exit(1) si no existe
const ACCESS_TOKEN_EXPIRY = "24h";           // Token de acceso: 24 horas
const REFRESH_TOKEN_EXPIRY_DAYS = 7;         // Refresh token: 7 dias
```

### 9.2 Flujo de login

```
1. POST /api/auth/login { email, password }
   |
2. Valida con Zod (loginSchema)
   |
3. Busca usuario por email en DB
   |
4. Compara password con bcrypt.compare(password, user.passwordHash)
   |
5. Si valido:
   |-- Genera JWT con { userId, email, role }
   |-- Genera refresh token (40 bytes random hex)
   |-- Guarda refresh token en DB con fecha de expiracion (+7 dias)
   |-- Retorna { token, user: { id, email, role }, refreshToken }
   |
6. Si invalido:
   |-- Retorna 401 "Invalid credentials"
```

### 9.3 Middleware de autenticacion

```typescript
function authenticateToken(req, res, next) {
  // 1. Extrae token de "Authorization: Bearer <token>"
  // 2. Verifica con jwt.verify(token, JWT_SECRET)
  // 3. Decodifica payload { userId, email, role }
  // 4. Adjunta a req.user
  // 5. Si falla -> 401 o 403
}
```

### 9.4 Control de acceso basado en roles

```typescript
function requireRole(...allowedRoles: UserRole[]) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Uso en rutas:
router.get("/api/users", authenticateToken, requireRole("ADMIN"), handler);
router.post("/api/appointments", authenticateToken, requireRole("ADMIN", "PLANNER"), handler);
```

### 9.5 Roles y permisos

| Recurso | ADMIN | PLANNER | BASIC_READONLY |
|---|---|---|---|
| Ver calendario | Si | Si | Si |
| Ver citas | Si | Si | Si |
| Crear/editar/eliminar citas | Si | Si | No |
| Gestionar proveedores | Si | Si | No |
| Gestionar capacidad | Si | Si | No |
| Gestionar usuarios | Si | No | No |
| Gestionar notificaciones email | Si | No | No |
| Ver audit log | Si | Si | No |
| Chat publico | Si (sin auth) | Si (sin auth) | Si (sin auth) |

### 9.6 Refresh token

```
1. POST /api/auth/refresh { refreshToken }
   |
2. Busca usuario por refreshToken en DB
   |
3. Verifica que refreshTokenExpires > now()
   |
4. Si valido:
   |-- Genera nuevo JWT
   |-- Retorna { token, refreshToken } (mismo refresh token)
   |
5. Si invalido/expirado:
   |-- Retorna 401 "Invalid or expired refresh token"
```

**Nota:** El refresh token NO se rota en cada uso. El mismo refresh token se reutiliza hasta que expira.

### 9.7 Cliente frontend (auto-refresh)

```typescript
// client/src/lib/api.ts
// Interceptor en cada respuesta 401:
1. Detecta error 401
2. Obtiene refreshToken de localStorage
3. Llama POST /api/auth/refresh
4. Si exito -> actualiza authToken en localStorage, reintenta request original
5. Si falla -> window.location.href = "/login"
```

### 9.8 Autenticacion de integracion

```typescript
// Para endpoints /api/integration/*
function authenticateIntegration(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (!process.env.INTEGRATION_API_KEY) {
    return res.status(503).json({ error: "Integration API not configured" });
  }
  if (apiKey !== process.env.INTEGRATION_API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}
```

---

## 10. VARIABLES DE ENTORNO

### Obligatorias

| Variable | Descripcion | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Clave secreta para firmar JWT (32+ chars recomendado) | `mi-super-secreto-jwt-32chars+` |

### AI / LLM

| Variable | Descripcion | Ejemplo |
|---|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic (Claude) | `sk-ant-api03-...` |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Alternativa (Replit integrations) | `sk-ant-api03-...` |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Base URL custom para Anthropic | `https://api.anthropic.com` |
| `OPENAI_API_KEY` | API key de OpenAI (fallback calculadora) | `sk-...` |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Alternativa (Replit integrations) | `sk-...` |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Base URL custom para OpenAI | `https://api.openai.com/v1` |

### Email SMTP (Opcionales)

| Variable | Descripcion | Default |
|---|---|---|
| `SMTP_HOST` | Servidor SMTP | (deshabilitado si no se configura) |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_USER` | Usuario SMTP | - |
| `SMTP_PASS` | Password SMTP | - |
| `SMTP_FROM` | Direccion remitente | - |
| `DAILY_SUMMARY_HOUR` | Hora del resumen diario (Europe/Madrid) | `7` |
| `DAILY_SUMMARY_MINUTE` | Minuto del resumen diario | `0` |

### Integracion (Opcional)

| Variable | Descripcion | Default |
|---|---|---|
| `INTEGRATION_API_KEY` | API key para endpoints de integracion | (vacio = API cerrada) |

### Server

| Variable | Descripcion | Default |
|---|---|---|
| `PORT` | Puerto del servidor | `5000` |
| `NODE_ENV` | Entorno (development/production) | `development` |

### Capacidad (Opcionales)

| Variable | Descripcion | Default |
|---|---|---|
| `DEFAULT_WORKERS` | Operarios por defecto | `3` |
| `DEFAULT_FORKLIFTS` | Carretillas por defecto | `2` |
| `DEFAULT_DOCKS` | Muelles por defecto | `3` |

---

## 11. PROBLEMAS DETECTADOS

### CRITICO

#### P1: `localhost` hardcoded en produccion
**Archivo:** `server/routes.ts:192`
```typescript
const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
```
**Problema:** El agente de chat hace llamadas HTTP a `localhost` para usar los endpoints de integracion. En produccion con Docker/Coolify, esto puede fallar si el contenedor no resuelve `localhost` correctamente o si hay proxies intermedios.

**Solucion:** Usar variable de entorno `BASE_URL` o construir la URL desde el request (`req.protocol + '://' + req.get('host')`).

---

#### P2: Endpoint de integracion con auth inconsistente
**Archivo:** `server/routes.ts:1084`
```typescript
router.post("/api/integration/appointments/upsert", authenticateToken, async (...) => {
```
**Problema:** Este endpoint usa `authenticateToken` (JWT) mientras que los demas endpoints de integracion (`/parse`, `/availability`, `/book`) usan `authenticateIntegration` (API Key). Esto rompe la consistencia y significa que este endpoint requiere que un usuario real este logueado para funcionar via integracion externa.

**Solucion:** Cambiar a `authenticateIntegration` o usar middleware hibrido.

---

#### P3: No existe endpoint de logout
**Archivo:** `server/routes.ts` (ausencia)
```typescript
// clearRefreshToken se importa en linea 24 pero NUNCA se usa
import { ..., clearRefreshToken } from "./middleware/auth";
```
**Problema:** No hay endpoint `POST /api/auth/logout` para invalidar el refresh token. Los usuarios no pueden cerrar sesion de forma segura - el token permanece valido hasta que expira.

**Solucion:** Agregar endpoint que llame `clearRefreshToken(userId)`.

---

#### P4: Race condition en error handling del chat SSE
**Archivo:** `server/routes.ts:184-223`
```typescript
res.flushHeaders();  // Linea 200 - headers ya enviados

// ... si error ocurre despues ...
if (!res.headersSent) {  // Linea 212 - SIEMPRE false
  res.status(500).json({ error: "..." });
}
```
**Problema:** Los headers se envian con `flushHeaders()` antes de procesar el stream. Si ocurre un error despues, el check `res.headersSent` siempre sera `true`, haciendo inutil el bloque de error HTTP. El error solo se loguea por consola pero el cliente no recibe notificacion adecuada del error.

**Solucion:** Enviar el error como un chunk SSE en lugar de intentar cambiar el status HTTP.

---

### ALTO

#### P5: Conflicto Drizzle/Prisma
**Archivos:** `drizzle.config.ts`, `shared/schema.ts`, `shared/schema-drizzle.ts`
```typescript
// drizzle.config.ts:9
schema: "./shared/schema.ts",  // APUNTA AL ARCHIVO EQUIVOCADO
```
**Problema:**
1. `drizzle.config.ts` referencia `schema.ts` como fuente, pero ese archivo contiene validaciones Zod, NO schema Drizzle
2. `schema-drizzle.ts` tiene el schema Drizzle real pero no es referenciado
3. El script `npm run db:push` (drizzle-kit push) probablemente falla por esto
4. El proyecto usa Prisma activamente, Drizzle esta abandonado a medias

**Solucion:** Eliminar Drizzle completamente o corregir la configuracion.

---

#### P6: Email daily summary envia para MANANA en vez de HOY
**Archivo:** `server/services/email-service.ts:94`
```typescript
const date = targetDate || addDays(new Date(), 1);  // +1 dia!
```
**Problema:** Cuando el cron job llama `sendDailySummary()` sin argumentos, envia el resumen de las citas de MANANA, no de hoy. Esto puede ser intencionado (preparar para el dia siguiente) pero no esta documentado y puede confundir.

---

#### P7: Dos sistemas de capacidad independientes
**Archivos:** `server/services/capacity-validator.ts`, `server/services/slot-validator.ts`
**Problema:** Coexisten dos sistemas de validacion que NO se comunican entre si:
- Legacy: valida minuto a minuto (workers, forklifts, docks)
- v2.0: calcula puntos por slot pero NO valida activamente al crear citas desde el panel

Al crear una cita desde el panel web, solo se usa el validador legacy. Los puntos se calculan pero no se validan contra los maxPoints de los slots. Una cita podria exceder los puntos maximos de un slot sin que se detecte.

---

#### P8: Docker `prisma db push` en cada inicio
**Archivo:** `Dockerfile:31`
```dockerfile
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
```
**Problema:**
- `prisma db push` modifica el schema de la DB en cada inicio de contenedor
- En multi-instancia, puede causar race conditions
- Sin `--accept-data-loss`, puede fallar si hay cambios destructivos
- Deberia usar `prisma migrate deploy` para produccion

---

#### P9: Falta validacion de schema en email recipients
**Archivo:** `server/routes.ts:1576-1599`
```typescript
// POST /api/email-recipients - NO usa schema validation
const { email, name, receivesDailySummary, receivesAlerts, receivesUrgent } = req.body;
```
**Problema:** Los datos se extraen directamente de `req.body` sin validar con Zod. Podria crear registros con datos invalidos (email malformado, name vacio).

---

### MEDIO

#### P10: Import no utilizado
**Archivo:** `server/routes.ts:24`
```typescript
import { ..., clearRefreshToken } from "./middleware/auth";
```
`clearRefreshToken` se importa pero nunca se usa (relacionado con P3).

---

#### P11: Modulo `storage.ts` obsoleto
**Archivo:** `server/storage.ts`
**Problema:** Importa tipos de `@shared/schema` que no existen. No se usa en ningun lugar del proyecto. Es codigo legacy que deberia eliminarse.

---

#### P12: Refresh token no se rota
**Archivo:** `server/routes.ts:275-296`
**Problema:** Al hacer refresh, se genera nuevo JWT pero se reutiliza el mismo refresh token. Best practice de seguridad es rotar el refresh token en cada uso para prevenir replay attacks.

---

#### P13: Errores inconsistentes en endpoints de integracion
**Archivo:** `server/routes.ts`
**Problema:** Diferentes formatos de error:
- Algunos: `{ success: false, error: "...", details: "..." }`
- Otros: `{ error: "...", details: [...] }`
- Otros: `{ error: "..." }` (sin details)

Dificulta el manejo de errores en el cliente.

---

#### P14: Sin manejo de errores en inicio de email cron
**Archivo:** `server/index.ts:128-129`
```typescript
const { startEmailCron } = await import("./services/email-cron");
startEmailCron();  // Sin try-catch
```
**Problema:** Si el cron falla al iniciar, el servidor entero podria caerse. Deberia estar envuelto en try-catch con logging.

---

#### P15: Credenciales hardcoded en seeds
**Archivos:** `prisma/seed.ts`, `seed-production.js`
```typescript
// seed.ts
{ email: "admin@example.com", password: "admin123", role: "ADMIN" }
{ email: "planner@example.com", password: "planner123", role: "PLANNER" }
{ email: "viewer@example.com", password: "viewer123", role: "BASIC_READONLY" }
```
**Problema:** Passwords por defecto en produccion. Sin endpoint de cambio de password.

---

#### P16: Sin endpoint de cambio de password
**Problema:** No existe un endpoint para que los usuarios cambien su password. El unico modo es que un ADMIN elimine y recree el usuario.

---

### BAJO

#### P17: `schema-drizzle.ts` incompleto
**Archivo:** `shared/schema-drizzle.ts:114`
**Problema:** Falta `export * from "./types"` que si existe en `schema.ts:115`.

---

#### P18: Archivo `seed-slots.ts` huerfano
**Archivo:** `server/seed-slots.ts` (si existe)
**Problema:** No importado ni referenciado en ningun lugar.

---

#### P19: Sin validacion de PORT como numero
**Archivo:** `server/index.ts`
```typescript
const port = process.env.PORT || 5000;
```
**Problema:** Si PORT es un string no numerico, Express fallara silenciosamente.

---

### Resumen de problemas por severidad

| Severidad | Cantidad | IDs |
|---|---|---|
| CRITICO | 4 | P1, P2, P3, P4 |
| ALTO | 5 | P5, P6, P7, P8, P9 |
| MEDIO | 7 | P10-P16 |
| BAJO | 3 | P17-P19 |
| **TOTAL** | **19** | |

---

## 12. DOCKER

### 12.1 Dockerfile

```dockerfile
# STAGE 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                                    # Instalacion limpia de dependencias
COPY . .
RUN npx prisma generate                       # Genera Prisma Client
RUN npm run build                             # Vite build + esbuild

# STAGE 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copia solo lo necesario
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Startup: sincroniza schema y ejecuta
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
```

**Observaciones:**
- Build multi-stage reduce tamano de imagen (solo dist + node_modules + prisma)
- Node 20 Alpine para imagen minimal
- Health check bien configurado con start-period de 40s
- `prisma db push` en CMD es problematico en produccion (ver P8)
- No copia `client/public/` - los assets estaticos estan en `dist/public/` post-build

### 12.2 docker-compose.yml

```yaml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${PORT:-5000}:5000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM}
      - DAILY_SUMMARY_HOUR=${DAILY_SUMMARY_HOUR}
      - DAILY_SUMMARY_MINUTE=${DAILY_SUMMARY_MINUTE}
      - INTEGRATION_API_KEY=${INTEGRATION_API_KEY}
      - PORT=5000
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
    restart: unless-stopped
```

**Observaciones:**
- Servicio unico (sin base de datos incluida - PostgreSQL externo, ej. Neon)
- Puerto configurable via env con default 5000
- Todas las variables de entorno pasadas correctamente
- Health check duplicado (ya esta en Dockerfile)
- Restart policy `unless-stopped` - apropiado para produccion
- No incluye volumen para persistencia (no necesario ya que la DB es externa)
- No incluye red personalizada (usa default bridge)

### 12.3 Script de build (build.sh)

```bash
#!/bin/bash
# Build y despliegue
npm ci
npx prisma generate
npm run build
```

---

## ESTADISTICAS DEL PROYECTO

| Metrica | Valor |
|---|---|
| Archivos TypeScript/TSX | ~103 |
| Componentes UI (shadcn/ui) | 47 |
| Paginas | 10 |
| Componentes custom | 12 |
| Servicios backend | 6 |
| Archivos del agente IA | 6 |
| Archivos de configuracion | 10 |
| Tipos compartidos | 3 |
| Endpoints API | ~45 |
| Modelos Prisma | 11 |
| Enums | 7 |
| Dependencias produccion | 48 |
| Dependencias desarrollo | 17 |
| Problemas detectados | 19 (4 criticos, 5 altos, 7 medios, 3 bajos) |

---

*Informe generado automaticamente por Claude Code (Opus 4.6) el 2026-02-23*
