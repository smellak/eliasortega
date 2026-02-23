# Centro Hogar Sanchez - Sistema de Gestion de Citas de Almacen

Sistema web para gestionar citas de entrega de mercancia en el almacen de Centro Hogar Sanchez. Controla la capacidad mediante franjas horarias con puntos (S/M/L), incluye un agente IA conversacional para proveedores, notificaciones por email y auditoria completa.

## Stack tecnologico

| Capa | Tecnologia |
|------|------------|
| Frontend | React 18, Vite, TypeScript, shadcn/ui, TanStack Query, FullCalendar |
| Backend | Node.js 20, Express.js, Prisma ORM |
| Base de datos | PostgreSQL (compatible con Neon) |
| IA | Anthropic Claude (Haiku 4.5 para chat y calculadora) |
| Email | Nodemailer (SMTP configurable) |
| Despliegue | Docker, docker-compose, compatible con Coolify |

## Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales (DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY)

# 3. Generar cliente Prisma
npx prisma generate

# 4. Aplicar migraciones
npx prisma migrate dev

# 5. (Opcional) Sembrar datos iniciales de franjas horarias
npx tsx server/seed-slots.ts

# 6. Iniciar en modo desarrollo
npm run dev
```

El servidor arranca en `http://localhost:5000` (API + frontend).

## Despliegue con Docker

```bash
# Construir imagen
docker build -t chs .

# Ejecutar
docker run -d \
  -p 5000:5000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="tu-secreto" \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e NODE_ENV=production \
  chs
```

O con docker-compose:

```bash
# Configurar .env y ejecutar
docker compose up -d
```

El contenedor ejecuta `npx prisma db push --skip-generate && node dist/index.js` al arrancar.

## Variables de entorno

Ver `.env.example` para la lista completa. Las principales:

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `DATABASE_URL` | Si | Conexion PostgreSQL |
| `JWT_SECRET` | Si | Secreto para tokens JWT |
| `ANTHROPIC_API_KEY` | Si | API key de Anthropic para el agente IA |
| `SMTP_HOST/PORT/USER/PASS` | No | Configuracion SMTP para emails |
| `INTEGRATION_API_KEY` | No | API key para endpoints de integracion externa |
| `BASE_URL` | No | URL base del servicio (para Docker/produccion) |

## Estructura del proyecto

```
client/                   # Frontend React
  src/
    pages/                # Paginas principales (calendario, capacidad, etc.)
    components/           # Componentes reutilizables (shadcn/ui + custom)
    lib/                  # API client, utilidades
server/                   # Backend Express
  agent/                  # Agente IA (orquestador, calculadora, herramientas)
  services/               # Logica de negocio (slots, email, auditoria)
  middleware/             # Autenticacion JWT
  db/                     # Cliente Prisma
  utils/                  # Utilidades (base URL)
shared/                   # Tipos y schemas Zod compartidos
  types.ts
prisma/
  schema.prisma           # Modelo de datos
  migrations/             # Migraciones SQL
```

## Modelo de capacidad (v2.0)

- **Plantillas de franja** (`SlotTemplate`): Franjas horarias recurrentes por dia de la semana con puntos maximos
- **Excepciones** (`SlotOverride`): Cambios de capacidad por fecha o rango de fechas (festivos, bajas, etc.)
- **Tallas de cita**: S (<=30min, 1pt), M (31-90min, 2pts), L (>90min, 3pts)
- **Ajuste rapido**: Boton para reducir/ampliar capacidad diaria con un clic

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| `ADMIN` | Acceso completo, gestion de usuarios |
| `PLANNER` | Gestion de citas, capacidad y proveedores |
| `BASIC_READONLY` | Solo lectura |

## Licencia

Privado - Uso interno de Centro Hogar Sanchez.
