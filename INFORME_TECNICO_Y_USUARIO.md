> **NOTA (2026-02-24):** Este documento describe la version 1.0 del sistema.
> El sistema actual (v2.0) usa validacion por franjas horarias con puntos
> (SlotTemplates + SlotOverrides, tallas S/M/L) en lugar del modelo legacy
> de trabajadores/carretillas/muelles. La calculadora LLM usa Anthropic Claude
> Haiku en lugar de OpenAI GPT-4.1. Ver `ANALISIS-PROYECTO.md` y `replit.md`
> para la arquitectura actual.

# Informe Completo: Sistema de Gestión de Citas de Almacén
## Centro Hogar Sanchez (CHS)

---

# PARTE 1: INFORME DE USUARIO

## 1.1 Descripción General

El Sistema de Gestión de Citas de Almacén es una plataforma web diseñada para Centro Hogar Sanchez que permite gestionar de forma inteligente las citas de entrega de mercancía en el almacén. El sistema controla en tiempo real que no se sobrepase la capacidad del almacén (trabajadores, carretillas y muelles de descarga), evitando así la sobrecarga operativa.

La plataforma ofrece dos interfaces principales:
- **Panel de Gestión** (privado): Para administradores y planificadores del almacén
- **Chat con Asistente Virtual** (público): Para que los proveedores reserven citas de forma conversacional

Toda la interfaz está en español y está diseñada para funcionar tanto en escritorio como en dispositivos móviles.

---

## 1.2 Acceso al Sistema

### Panel de Gestión (Ruta: `/`)
- Requiere inicio de sesión con email y contraseña
- Credenciales de administrador por defecto: `admin@example.com` / `CHS-Admin-2026!` (CAMBIAR TRAS PRIMER LOGIN)
- El token de sesión dura 7 días

### Chat Público (Ruta: `/chat`)
- Acceso libre, sin necesidad de autenticación
- Destinado a proveedores que desean reservar citas de entrega

---

## 1.3 Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **ADMINISTRADOR** | Acceso total: crear/editar/eliminar citas, proveedores, turnos de capacidad y usuarios |
| **PLANIFICADOR** | Gestión operativa: crear/editar/eliminar citas, proveedores y turnos de capacidad. No puede gestionar usuarios |
| **SOLO LECTURA** | Solo visualización: puede ver el calendario, las citas y los datos, pero no puede crear ni modificar nada |

---

## 1.4 Módulos del Panel de Gestión

### 1.4.1 Calendario (Página principal)

La pantalla principal muestra un calendario interactivo con todas las citas programadas.

**Funcionalidades:**
- Vista por mes, semana o día (botones de alternancia en la parte superior)
- Navegación con botones anterior/siguiente y botón "Hoy"
- Clic en un evento para editarlo
- Selección de rango horario para crear una nueva cita
- Arrastrar y soltar eventos para reprogramar citas
- Indicadores de capacidad en tiempo real (trabajadores, carretillas, muelles)

**Indicadores de Capacidad:**
- Muestran el porcentaje de uso de cada recurso para el rango de fechas visible
- Barras de progreso con colores: azul (normal), amarillo (>75%), rojo (>90%)
- Identificación del recurso cuello de botella
- Día pico del período seleccionado
- Botón expandible para ver desglose detallado por recurso

### 1.4.2 Citas

Lista completa de todas las citas del almacén.

**Funcionalidades:**
- Buscador por nombre de proveedor
- Cada cita muestra: proveedor, tipo de mercancía, horario, minutos de trabajo, carretillas necesarias, unidades y líneas
- Botón editar y eliminar en cada cita (con confirmación antes de eliminar)
- Botón "Nueva Cita" para crear manualmente

**Creación/Edición de Cita:**
El formulario solicita:
- Proveedor (selector desplegable)
- Fecha y hora de inicio
- Fecha y hora de fin
- Minutos de trabajo necesarios
- Carretillas necesarias
- Tipo de mercancía (opcional)
- Unidades (opcional)
- Líneas (opcional)

El sistema valida automáticamente que:
- Se haya seleccionado un proveedor
- Las fechas sean coherentes (fin posterior al inicio)
- Los valores numéricos sean positivos
- **No se exceda la capacidad disponible** (validación minuto a minuto)

Si se detecta un conflicto de capacidad, se muestra un diálogo detallado indicando exactamente en qué minuto y qué recurso se excede.

### 1.4.3 Capacidad

Gestión de los turnos de capacidad del almacén.

**Funcionalidades:**
- Tabla con todos los turnos de capacidad configurados
- Cada turno define: fecha/hora inicio, fecha/hora fin, trabajadores disponibles, carretillas disponibles, muelles disponibles
- Crear, editar y eliminar turnos
- Los turnos definen cuántos recursos están disponibles en cada franja horaria

**Capacidad por defecto** (cuando no hay turno configurado):
- Lunes a viernes: 08:00-19:00, 3 trabajadores, 2 carretillas, 3 muelles
- Sábados: 08:00-14:00, 2 trabajadores, 1 carretilla, 2 muelles
- Domingos: cerrado (0 recursos)

### 1.4.4 Proveedores

Gestión del catálogo de proveedores de entrega.

**Funcionalidades:**
- Tabla con nombre y notas de cada proveedor
- Crear, editar y eliminar proveedores (edición en línea directamente en la tabla)
- Los proveedores se asocian a las citas

### 1.4.5 Usuarios (Solo Administradores)

Gestión de cuentas de acceso al sistema.

**Funcionalidades:**
- Tabla con email, rol y acciones por usuario
- Crear nuevos usuarios con email, contraseña y rol
- Editar email y rol de usuarios existentes
- Eliminar usuarios (con confirmación)

---

## 1.5 Chat con Asistente Virtual (Elías Ortega)

### Descripción
El chat público permite a los proveedores reservar citas de entrega de forma conversacional, sin necesidad de acceder al panel de gestión. El asistente virtual "Elías Ortega" guía al proveedor paso a paso.

### Flujo de Reserva
1. **Bienvenida**: Elías saluda y pregunta por los datos de la entrega
2. **Recopilación de datos**: El asistente solicita:
   - Nombre de la empresa/proveedor
   - Tipo de mercancía (colchones, sofás, electrodomésticos, muebles, etc.)
   - Número de unidades/bultos
   - Número de líneas/referencias
   - Número de albaranes
3. **Estimación de recursos**: El sistema calcula automáticamente cuánto tiempo, carretillas y personal se necesitan
4. **Búsqueda de disponibilidad**: Busca hasta 3 horarios disponibles que cumplan con la capacidad
5. **Confirmación**: El proveedor elige un horario y Elías realiza la reserva
6. **Confirmación final**: Se muestra un resumen con todos los detalles de la cita confirmada

### Características del Chat
- Respuestas en tiempo real con streaming (las palabras aparecen progresivamente)
- Indicador de "Elías está escribiendo..." con animación
- Soporte para Markdown en las respuestas (negritas, listas, código)
- Historial de conversación persistente por sesión
- Horarios del almacén para reservas: lunes a viernes, 08:00-14:00 (zona horaria Europe/Madrid)

---

## 1.6 Modo Oscuro

El sistema incluye soporte completo para modo oscuro. Se puede alternar entre modo claro y oscuro usando el botón de luna/sol en la cabecera del panel de gestión.

---

## 1.7 Documentación de la API

La documentación interactiva de la API está disponible en la ruta `/docs` (Swagger/OpenAPI). Permite explorar y probar todos los endpoints disponibles.

---

---

# PARTE 2: INFORME TÉCNICO

## 2.1 Arquitectura General

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                      │
│  React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Calendar  │  │Appointm. │  │ Capacity │  │Chat Pub. │ │
│  │  Page     │  │  Page    │  │  Page    │  │  (SSE)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │          TanStack React Query v5 (Cache)             │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP/SSE
┌────────────────────────▼─────────────────────────────────┐
│                  SERVIDOR (Express.js)                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │   Auth     │  │   Rate     │  │     Helmet         │  │
│  │ Middleware │  │  Limiting  │  │  (Security Headers) │  │
│  └────────────┘  └────────────┘  └────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │               API Routes (REST)                      │ │
│  │  /api/auth/* | /api/appointments/* | /api/providers/*│ │
│  │  /api/capacity-shifts/* | /api/users/*               │ │
│  │  /api/capacity/* | /api/chat/* | /api/integration/*  │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │            Capacity Validator Service                │ │
│  │      (Validación minuto a minuto de recursos)        │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │               AI Agent System                        │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐ │ │
│  │  │Orchestrator│  │ Calculator │  │    Memory       │ │ │
│  │  │(Claude 4.5)│  │(Determin.+ │  │  (PostgreSQL)  │ │ │
│  │  │            │  │  GPT-4.1)  │  │                │ │ │
│  │  └────────────┘  └────────────┘  └────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────┘
                         │ Prisma ORM
┌────────────────────────▼─────────────────────────────────┐
│              PostgreSQL (Neon - Cloud)                    │
│  Tables: users, providers, appointments,                 │
│          capacity_shifts, conversations, messages         │
└──────────────────────────────────────────────────────────┘
```

---

## 2.2 Stack Tecnológico

### Frontend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 18 | Framework UI |
| Vite | - | Build tool y dev server |
| TypeScript | - | Tipado estático |
| Tailwind CSS | - | Framework CSS utility-first |
| shadcn/ui (Radix UI) | - | Componentes de UI accesibles |
| FullCalendar | - | Componente de calendario interactivo |
| TanStack React Query | v5 | Gestión de estado del servidor y cache |
| Wouter | - | Routing ligero |
| ReactMarkdown | - | Renderizado de Markdown en el chat |
| Lucide React | - | Iconografía |
| date-fns / date-fns-tz | - | Manipulación de fechas y zonas horarias |

### Backend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | 20 | Runtime |
| Express.js | - | Framework HTTP |
| Prisma ORM | - | Acceso a base de datos (patrón singleton) |
| PostgreSQL (Neon) | - | Base de datos relacional en la nube |
| JSON Web Tokens (JWT) | - | Autenticación |
| bcryptjs | - | Hash de contraseñas |
| Zod | - | Validación de esquemas de datos |
| Helmet | - | Headers de seguridad HTTP |
| express-rate-limit | - | Limitación de tasa de peticiones |
| Swagger/OpenAPI | 3.0 | Documentación interactiva de API |

### Inteligencia Artificial
| Tecnología | Modelo | Propósito |
|------------|--------|-----------|
| Anthropic SDK | Claude Sonnet 4.5 | Agente conversacional principal (orquestador) |
| OpenAI SDK | GPT-4.1 | Calculadora de recursos (fallback para tipos no reconocidos) |

---

## 2.3 Modelo de Datos (Prisma Schema)

### Tabla `users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | Identificador único (PK) |
| email | String (unique) | Correo electrónico del usuario |
| password_hash | String | Hash bcrypt de la contraseña |
| role | Enum (ADMIN, PLANNER, BASIC_READONLY) | Rol del usuario |
| created_at | DateTime | Fecha de creación |
| updated_at | DateTime | Fecha de última actualización |

### Tabla `providers`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | Identificador único (PK) |
| name | String (unique) | Nombre del proveedor |
| notes | String? | Notas opcionales |
| created_at | DateTime | Fecha de creación |
| updated_at | DateTime | Fecha de última actualización |

### Tabla `appointments`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | Identificador único (PK) |
| provider_id | String? (FK) | Referencia al proveedor |
| provider_name | String | Nombre del proveedor (desnormalizado) |
| start_utc | DateTime | Inicio de la cita en UTC |
| end_utc | DateTime | Fin de la cita en UTC |
| work_minutes_needed | Int | Minutos de trabajo-persona requeridos |
| forklifts_needed | Int | Número de carretillas necesarias |
| goods_type | String? | Tipo de mercancía |
| units | Int? | Número de unidades/bultos |
| lines | Int? | Número de líneas/referencias |
| delivery_notes_count | Int? | Número de albaranes |
| external_ref | String? (unique) | Referencia externa (para integraciones) |
| created_at | DateTime | Fecha de creación |
| updated_at | DateTime | Fecha de última actualización |

**Índices**: start_utc, end_utc, provider_name

### Tabla `capacity_shifts`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | Identificador único (PK) |
| start_utc | DateTime | Inicio del turno en UTC |
| end_utc | DateTime | Fin del turno en UTC |
| workers | Int | Trabajadores disponibles |
| forklifts | Int | Carretillas disponibles |
| docks | Int? | Muelles disponibles |
| created_at | DateTime | Fecha de creación |
| updated_at | DateTime | Fecha de última actualización |

**Índice compuesto**: (start_utc, end_utc)

### Tabla `conversations`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | Identificador único (PK) |
| session_id | String (unique) | ID de sesión del chat |
| metadata | JSON? | Metadatos opcionales |
| created_at | DateTime | Fecha de creación |
| updated_at | DateTime | Fecha de última actualización |

### Tabla `messages`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (CUID) | Identificador único (PK) |
| conversation_id | String (FK) | Referencia a la conversación |
| role | Enum (user, assistant, system, tool) | Rol del mensaje |
| content | String | Contenido del mensaje |
| metadata | JSON? | Metadatos opcionales |
| created_at | DateTime | Fecha de creación |

**Índices**: conversation_id, created_at

---

## 2.4 API REST - Endpoints Completos

### Autenticación
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Inicio de sesión (devuelve JWT) |
| GET | `/api/auth/me` | JWT | Obtener datos del usuario actual |

### Proveedores
| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| GET | `/api/providers` | JWT | Todos | Listar proveedores |
| POST | `/api/providers` | JWT | ADMIN, PLANNER | Crear proveedor |
| PUT | `/api/providers/:id` | JWT | ADMIN, PLANNER | Editar proveedor |
| DELETE | `/api/providers/:id` | JWT | ADMIN, PLANNER | Eliminar proveedor |

### Turnos de Capacidad
| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| GET | `/api/capacity-shifts` | JWT | Todos | Listar turnos (filtro opcional `from`, `to`) |
| POST | `/api/capacity-shifts` | JWT | ADMIN, PLANNER | Crear turno |
| PUT | `/api/capacity-shifts/:id` | JWT | ADMIN, PLANNER | Editar turno |
| DELETE | `/api/capacity-shifts/:id` | JWT | ADMIN, PLANNER | Eliminar turno |

### Citas
| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| GET | `/api/appointments` | JWT | Todos | Listar citas (filtro opcional `from`, `to`, `providerId`) |
| POST | `/api/appointments` | JWT | ADMIN, PLANNER | Crear cita (con validación de capacidad) |
| PUT | `/api/appointments/:id` | JWT | ADMIN, PLANNER | Editar cita (con validación de capacidad) |
| DELETE | `/api/appointments/:id` | JWT | ADMIN, PLANNER | Eliminar cita |

### Capacidad
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/capacity/at-minute?minute=ISO` | JWT | Uso de recursos en un minuto específico |
| GET | `/api/capacity/utilization?startDate=ISO&endDate=ISO` | JWT | Porcentaje de utilización por recurso en un rango |

### Chat (Público)
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/chat/message` | No | Enviar mensaje al asistente virtual (SSE streaming) |

### Integración (para n8n/sistemas externos)
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/integration/appointments/upsert` | JWT | Crear o actualizar cita por `externalRef` |
| POST | `/api/integration/calendar/parse` | API Key | Parsear y normalizar query de calendario |
| POST | `/api/integration/calendar/availability` | API Key | Buscar slots disponibles |
| POST | `/api/integration/calendar/book` | API Key | Reservar cita (con reintentos automáticos) |
| GET | `/api/integration/appointments/by-external-ref/:ref` | JWT | Buscar cita por referencia externa |

### Utilidades
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | No | Estado del servidor y conectividad de BD |
| GET | `/docs` | No | Documentación Swagger/OpenAPI interactiva |

---

## 2.5 Sistema de Validación de Capacidad

### Concepto
El sistema valida la capacidad del almacén **minuto a minuto**. Cada vez que se intenta crear o modificar una cita, se verifica que en ningún minuto del rango de la cita se excedan los recursos disponibles.

### Recursos validados
1. **Trabajadores (work)**: El sistema distribuye los `workMinutesNeeded` de forma uniforme a lo largo de la duración de la cita. En cada minuto, la tasa de trabajo (`workMinutesNeeded / duraciónMinutos`) se suma con las de otras citas solapadas y no puede exceder el número de trabajadores disponibles.
2. **Carretillas (forklifts)**: El número de carretillas necesarias se verifica contra las disponibles en cada minuto.
3. **Muelles (docks)**: Cada cita activa ocupa 1 muelle. El total de citas simultáneas no puede exceder los muelles disponibles.

### Algoritmo de Validación (`CapacityValidator.validateAppointment`)
```
Para cada minuto de la cita:
  1. Obtener capacidad disponible (del turno más específico o valores por defecto)
  2. Calcular tasa de trabajo de esta cita: workMinutesNeeded / duración
  3. Sumar tasa de trabajo de todas las citas solapadas en este minuto
  4. Verificar: workUsed ≤ workers disponibles
  5. Sumar carretillas de todas las citas solapadas
  6. Verificar: forkliftsUsed ≤ forklifts disponibles
  7. Contar citas simultáneas (incluida esta)
  8. Verificar: docksUsed ≤ docks disponibles
  
Si alguna verificación falla → devolver CapacityConflictError con detalle exacto
Si todas pasan → devolver null (sin conflicto)
```

### Protección contra Condiciones de Carrera
Todas las operaciones de creación y actualización de citas se ejecutan dentro de una transacción Prisma con nivel de aislamiento **Serializable**:
```typescript
prisma.$transaction(async (tx) => {
  // 1. Validar capacidad (dentro de la transacción)
  // 2. Crear/actualizar la cita
}, { isolationLevel: "Serializable" });
```
Esto garantiza que dos citas simultáneas no puedan reservar el mismo recurso.

### Cálculo de Utilización
El endpoint `/api/capacity/utilization` calcula el porcentaje de uso de cada recurso para un rango de fechas:
- Usa un algoritmo basado en **timeline de eventos** para calcular la capacidad disponible eficientemente
- Identifica el recurso cuello de botella (el de mayor porcentaje)
- Detecta el día pico del período
- Reporta cuántos días usan capacidad por defecto vs. turnos configurados

---

## 2.6 Sistema de Agentes de IA

### Arquitectura
```
Usuario (Chat) → AgentOrchestrator → Claude Sonnet 4.5
                                         │
                                    ┌─────┴─────┐
                                    │   Tools    │
                                    ├────────────┤
                                    │ calculator │ → Deterministic Calculator
                                    │            │   (fallback: GPT-4.1)
                                    ├────────────┤
                                    │ calendar_  │ → /api/integration/
                                    │ availability│   calendar/availability
                                    ├────────────┤
                                    │ calendar_  │ → /api/integration/
                                    │ book       │   calendar/book
                                    └────────────┘
```

### Orquestador (Claude Sonnet 4.5)
- **Modelo**: `claude-sonnet-4-5` (Anthropic)
- **Función**: Agente conversacional que guía al proveedor en la reserva
- **Streaming**: Las respuestas se envían palabra a palabra vía SSE (Server-Sent Events)
- **Herramientas**: Tiene acceso a 3 tools que ejecuta según el flujo de conversación
- **Historial**: Mantiene las últimas 20 interacciones (10 intercambios)
- **Truncamiento**: Contenidos mayores de 2000 caracteres se truncan para evitar exceso de tokens
- **Máximo de iteraciones**: 10 ciclos de tool-calling por mensaje
- **Prompt del sistema**: Configura la personalidad de "Elías Ortega", las reglas del almacén (horarios, zona horaria), y el flujo de trabajo paso a paso

### Calculadora de Recursos
La calculadora determina los recursos necesarios para una entrega basándose en fórmulas determinísticas.

**Categorías soportadas** (8 categorías con coeficientes específicos):

| Categoría | TD | TA | TL | TU | Usa Carretilla |
|-----------|------|------|------|------|:---:|
| Asientos | 48.88 | 5.49 | 0.00 | 1.06 | Sí |
| Baño | 3.11 | 11.29 | 0.61 | 0.00 | No |
| Cocina | 10.67 | 0.00 | 4.95 | 0.04 | No |
| Colchonería | 14.83 | 0.00 | 4.95 | 0.12 | Sí |
| Electro | 33.49 | 0.81 | 0.00 | 0.31 | Sí |
| Mobiliario | 23.20 | 0.00 | 2.54 | 0.25 | Sí |
| PAE | 6.67 | 8.33 | 0.00 | 0.00 | No |
| Tapicería | 34.74 | 0.00 | 2.25 | 0.10 | Sí |

Donde: TD = Tiempo Descarga base, TA = Tiempo por Albarán, TL = Tiempo por Línea, TU = Tiempo por Unidad

**Fórmula de cálculo de tiempo:**
- **Asientos**: `(U * TU) + (A * TA) + (L * TL)` (sin TD)
- **Resto**: `(U == 0 ? 0 : TD) + (U * TU) + (A * TA) + (L * TL)`

**Redondeo humano:**
- 0-44 min → múltiplo de 10 hacia abajo
- 45-94 min → múltiplo de 5 más cercano
- ≥95 min → múltiplo de 10 hacia arriba

**Carretillas:**
- Categorías sin carretilla (Baño, Cocina, PAE): siempre 0
- Duración ≥ 90 min: 2 carretillas
- Resto: 1 carretilla

**Trabajadores:**
- ≤30 min: 1 trabajador
- 31-90 min: 2 trabajadores
- ≥91 min: 3 trabajadores
- Tapicería/Asientos: +1 especialista
- Máximo: 4 trabajadores

**Normalización de categorías**: El sistema incluye un diccionario de sinónimos (ej: "sofá" → "Tapicería", "colchones" → "Colchonería") que permite reconocer el tipo de mercancía en diferentes formas de escritura.

**Fallback LLM**: Si la categoría no se reconoce por el sistema determinístico, se usa GPT-4.1 como fallback con el mismo prompt de cálculo. Si también falla, se aplican valores por defecto (60 min, 1 carretilla, 2 trabajadores).

### Memoria de Conversación
- Almacenada en PostgreSQL (tablas `conversations` y `messages`)
- Cada sesión de chat genera un `sessionId` único
- Se conservan las últimas 30 mensajes por conversación
- Ordenados cronológicamente para mantener el contexto

### Flujo Completo de una Reserva por Chat
```
1. Proveedor escribe: "Hola, quiero reservar una cita"
2. Claude responde preguntando datos de la entrega
3. Proveedor proporciona: empresa, tipo mercancía, unidades, líneas, albaranes
4. Claude llama tool `calculator` con los datos
5. Calculator devuelve: work_minutes, forklifts, workers, duration
6. Claude muestra estimación al proveedor y pregunta fecha preferida
7. Proveedor indica fecha deseada
8. Claude llama tool `calendar_availability` con rango de fechas y recursos
9. API busca slots de 15 en 15 minutos, valida capacidad, devuelve hasta 3 opciones
10. Claude presenta las opciones al proveedor
11. Proveedor elige una opción
12. Claude llama tool `calendar_book` con fecha/hora elegida
13. API crea la cita con validación transaccional (reintentos si hay conflicto)
14. Claude confirma la reserva con resumen completo
```

---

## 2.7 Seguridad

### Autenticación
- **JWT (JSON Web Tokens)**: Tokens firmados con `JWT_SECRET`, expiran en 7 días
- **bcryptjs**: Contraseñas hasheadas con salt de 10 rondas
- **Token validation**: Se verifica en cada request autenticado via middleware `authenticateToken`
- **Auto-logout**: Si un token expira o es inválido, el frontend redirige automáticamente al login

### Autorización (RBAC)
- Middleware `requireRole(...)` que verifica el rol del usuario en cada endpoint
- 3 niveles: ADMIN > PLANNER > BASIC_READONLY

### Protección de la API
- **Helmet**: Headers de seguridad HTTP (XSS, MIME sniffing, clickjacking, etc.)
- **Rate Limiting**:
  - Login: máximo 10 intentos cada 15 minutos
  - Chat: máximo 20 mensajes por minuto
  - API general: máximo 200 requests por minuto
- **Body limit**: Máximo 1MB por request JSON
- **Trust Proxy**: Habilitado para correcto funcionamiento del rate limiting detrás de reverse proxy
- **Validación de entrada**: Todos los payloads se validan con esquemas Zod antes de procesarse

### Integración Externa
- Endpoints de integración protegidos opcionalmente con API Key (`X-API-Key` header)
- Si `INTEGRATION_API_KEY` no está configurada, los endpoints quedan abiertos

---

## 2.8 Frontend - Arquitectura de Componentes

### Estructura de Páginas
```
client/src/
├── App.tsx                       # Layout principal, auth, routing, ErrorBoundary
├── pages/
│   ├── login.tsx                 # Página de inicio de sesión
│   ├── calendar-page.tsx         # Calendario + indicadores de capacidad
│   ├── appointments-page.tsx     # Lista y gestión de citas
│   ├── capacity-page.tsx         # Gestión de turnos de capacidad
│   ├── providers-page.tsx        # Gestión de proveedores
│   ├── users-page.tsx            # Gestión de usuarios (solo ADMIN)
│   ├── chat-public.tsx           # Chat público con asistente IA
│   └── not-found.tsx             # Página 404
├── components/
│   ├── app-sidebar.tsx           # Barra lateral de navegación
│   ├── calendar-view.tsx         # Componente FullCalendar
│   ├── capacity-indicators.tsx   # Indicadores de capacidad con barras
│   ├── appointment-dialog.tsx    # Formulario de crear/editar cita
│   ├── conflict-error-dialog.tsx # Diálogo de error de capacidad
│   ├── confirm-dialog.tsx        # Diálogo de confirmación genérico
│   ├── providers-table.tsx       # Tabla de proveedores (edición inline)
│   ├── capacity-windows-table.tsx# Tabla de turnos de capacidad
│   ├── users-table.tsx           # Tabla de usuarios
│   ├── role-badge.tsx            # Badge visual de rol
│   └── theme-toggle.tsx          # Toggle modo claro/oscuro
├── lib/
│   ├── api.ts                    # Clientes API tipados + gestión de tokens
│   ├── queryClient.ts            # Configuración TanStack Query
│   └── utils.ts                  # Utilidades (cn helper para clases)
└── hooks/
    ├── use-toast.ts              # Hook para notificaciones toast
    └── use-mobile.tsx            # Hook para detección de dispositivo móvil
```

### Gestión de Estado
- **TanStack React Query v5**: Toda la comunicación con el servidor se gestiona via queries y mutations
  - Queries usan `queryKey` como identificador de cache
  - Mutations invalidan automáticamente las queries relacionadas tras éxito
  - Loading states y error handling integrados
- **Estado local (useState)**: Para formularios, diálogos, filtros
- **Auth token**: Almacenado en `localStorage`, gestionado en `lib/api.ts`

### Routing
- **Wouter**: Router ligero sin dependencias
- Rutas protegidas: verificación de token al cargar la app
- Ruta `/chat`: renderiza directamente sin sidebar ni autenticación

### Sistema de Diseño Visual
- **Color primario**: Azul `hsl(213 94% 46%)` con variaciones de gradiente
- **Glass-morphism**: Efectos de vidrio esmerilado con `backdrop-blur` en login y header
- **Animaciones CSS**: fadeIn, slideUp, float, shimmer (definidas en `index.css` + `tailwind.config.ts`)
- **Clases utilitarias personalizadas**:
  - `.glass-card` / `.glass-header`: Efecto vidrio con blur
  - `.gradient-btn`: Botón con degradado azul
  - `.page-icon`: Icono con fondo degradado para encabezados de página
  - `.premium-table`: Tabla con estilos premium (bordes redondeados, sombras)
  - `.skeleton-shimmer`: Animación de carga tipo esqueleto

---

## 2.9 Variables de Entorno

| Variable | Obligatoria | Descripción |
|----------|:-----------:|-------------|
| `DATABASE_URL` | Sí | URL de conexión a PostgreSQL (formato Prisma) |
| `JWT_SECRET` | Sí | Secreto para firmar tokens JWT (el servidor se detiene si no está configurada) |
| `INTEGRATION_API_KEY` | No | API Key para endpoints de integración (si no se configura, quedan abiertos) |
| `DEFAULT_WORKERS` | No | Trabajadores por defecto en días laborables (default: 3) |
| `DEFAULT_FORKLIFTS` | No | Carretillas por defecto (default: 2) |
| `DEFAULT_DOCKS` | No | Muelles por defecto (default: 3) |
| `NODE_ENV` | No | Modo de entorno (`development` / `production`) |
| `PORT` | No | Puerto del servidor (default: 5000) |

---

## 2.10 Estructura de Archivos del Servidor

```
server/
├── index.ts                      # Punto de entrada, configuración Express
├── routes.ts                     # Todas las rutas API (~1066 líneas)
├── swagger.ts                    # Configuración Swagger/OpenAPI
├── vite.ts                       # Integración Vite para desarrollo
├── storage.ts                    # Interfaz de almacenamiento (no usada actualmente)
├── db/
│   └── client.ts                 # Cliente Prisma singleton
├── middleware/
│   └── auth.ts                   # JWT auth + role middleware
├── services/
│   └── capacity-validator.ts     # Servicio de validación de capacidad
├── agent/
│   ├── orchestrator.ts           # Orquestador IA (Claude streaming + tools)
│   ├── calculator.ts             # Calculadora determinística + fallback LLM
│   ├── tools.ts                  # Definición y ejecución de herramientas IA
│   ├── prompts.ts                # Prompts del sistema (Elías + Calculator)
│   ├── memory.ts                 # Memoria conversacional (PostgreSQL)
│   └── llm-clients.ts           # Clientes configurados para Anthropic/OpenAI
└── utils/
    └── timezone.ts               # Utilidad de conversión a Europe/Madrid
```

---

## 2.11 Flujos de Datos Clave

### Flujo: Crear una Cita (Panel de Gestión)
```
1. Usuario rellena formulario en AppointmentDialog
2. Validación client-side (campos obligatorios, rango de fechas, valores positivos)
3. POST /api/appointments con payload validado
4. Server: Zod valida el body
5. Server: prisma.$transaction(Serializable) {
     a. capacityValidator.validateAppointment() → revisa cada minuto
     b. Si conflicto → devuelve 409 con CapacityConflictError
     c. Si OK → prisma.appointment.create()
   }
6. Frontend: Mutation onSuccess → invalidate queries → cerrar diálogo → toast éxito
7. Frontend: Mutation onError → si 409 → mostrar ConflictErrorDialog
```

### Flujo: Reserva por Chat
```
1. Proveedor envía mensaje → POST /api/chat/message (SSE)
2. AgentOrchestrator carga historial de conversación
3. Claude Sonnet 4.5 procesa con tools disponibles
4. Si necesita calcular → tool "calculator" → calculadora determinística
5. Si necesita buscar slots → tool "calendar_availability" → 
   POST /api/integration/calendar/availability →
   busca slots cada 15 min, valida capacidad en cada uno
6. Si necesita reservar → tool "calendar_book" →
   POST /api/integration/calendar/book →
   upsertAppointmentInternal (con 3 reintentos de +30 min)
7. Chunks de texto se envían via SSE al frontend
8. Frontend actualiza el mensaje en tiempo real
```

### Flujo: Validación de Capacidad en Tiempo Real (Calendar Page)
```
1. CalendarView envía datesSet callback con rango visible
2. CalendarPage actualiza dateRange state
3. useQuery fetches /api/capacity/utilization?startDate=...&endDate=...
4. Server calcula utilización con timeline de eventos:
   - Para cada día: obtener turnos → calcular capacidad por recurso
   - Para cada cita: calcular fracción dentro del rango → acumular uso
   - Calcular porcentajes por recurso
   - Identificar cuello de botella y día pico
5. CapacityIndicators renderiza barras con colores según porcentaje
```

---

## 2.12 Endpoints de Integración (para n8n/sistemas externos)

El sistema expone endpoints especializados para integración con herramientas de automatización como n8n:

### `/api/integration/calendar/parse`
Parsea y normaliza una consulta de calendario. Acepta el body como JSON directo o envuelto en `{ query: "..." }`.

### `/api/integration/calendar/availability`
Busca hasta 3 slots disponibles en un rango de fechas:
- Itera por cada día laboral (lun-vie)
- Para cada día, prueba slots cada 15 minutos dentro del horario 08:00-14:00
- Valida capacidad para cada slot candidato
- Devuelve fecha/hora en UTC y en formato local (Europe/Madrid)

### `/api/integration/calendar/book`
Reserva una cita con reintentos automáticos:
- Genera `externalRef` determinístico para idempotencia
- Si hay conflicto, reintenta 3 veces desplazando +30 minutos
- Devuelve confirmación con HTML formateado

### `/api/integration/appointments/upsert`
Crea o actualiza una cita usando `externalRef` como clave:
- Si existe con ese `externalRef` → actualiza
- Si no existe → crea
- Ambas operaciones validan capacidad en transacción Serializable

---

## 2.13 Consideraciones de Rendimiento

- **Cliente Prisma Singleton**: Evita crear múltiples conexiones a la base de datos
- **Índices de base de datos**: En campos de búsqueda frecuente (start_utc, end_utc, provider_name, session_id)
- **TanStack Query Cache**: Evita re-fetching innecesario de datos
- **Invalidación selectiva**: Las mutations solo invalidan las queries afectadas
- **Timeline de eventos**: El cálculo de utilización usa un algoritmo O(n log n) basado en eventos en vez de iterar cada minuto
- **SSE Streaming**: Las respuestas del chat se envían progresivamente, mejorando la experiencia de usuario
- **Truncamiento de historial**: Máximo 20 mensajes en contexto del LLM y 2000 chars por mensaje

---

## 2.14 Despliegue

- **Entorno**: Replit (NixOS container)
- **Comando de inicio**: `npm run dev` (desarrollo) / build de producción con Vite
- **Puerto**: 5000 (configurable via `PORT`)
- **Base de datos**: PostgreSQL hospedado en Neon (cloud)
- **Servidor único**: Express sirve tanto la API como el frontend (Vite en dev, archivos estáticos en prod)

---

*Documento generado el 23 de febrero de 2026*
*Sistema de Gestión de Citas - Centro Hogar Sanchez v1.0*
