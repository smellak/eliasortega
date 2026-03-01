## REGLAS GIT OBLIGATORIAS — LEER ANTES DE CADA SESION
1. SIEMPRE hacer `git pull origin main` ANTES de empezar cualquier tarea
2. NUNCA usar `git add -A` ni `git add .` — siempre `git add <archivos específicos>`
3. ANTES de cada commit, verificar con `git diff --cached --stat` que solo incluyes archivos de tu tarea
4. El repo está en /root/eliasortega. /home/claudeuser/eliasortega es un symlink al mismo directorio. NO crear copias adicionales.
5. Después de cada push, verificar con `git log --oneline -3` que el commit es correcto
6. Si arrancas una nueva sesión, SIEMPRE empieza con `git pull origin main && git status`
7. NUNCA compiles ni despliegues desde un directorio que no sea /root/eliasortega

# Proyecto: Sistema de Citas CentroHogar Sánchez (Elías Ortega)
## Qué es
Sistema web para gestionar citas de descarga en almacén. Agente IA atiende proveedores por chat, calcula tiempos y reserva citas.
## Stack
Backend: Express.js + TypeScript, Prisma ORM, PostgreSQL. Frontend: React + Vite + TailwindCSS + shadcn/ui. Agente: Claude (Anthropic SDK).
## URLs producción
- Chat: http://cogk4c4s8kgsk4k4s00wskss.5.9.187.169.sslip.io/chat
- Admin: http://cogk4c4s8kgsk4k4s00wskss.5.9.187.169.sslip.io/capacity
- Login admin: admin@admin.com / admin123
## Contenedor producción
- App: `cogk4c4s8kgsk4k4s00wskss-144450312557`
- BD: `lsggkkg0wkw04s0ook44cccw` (PostgreSQL 16)
- Alpine Linux: NO usar `<<<`, usar `echo "..." | comando`
## MCPs disponibles
- Coolify: deploy, restart, logs, env vars (API en http://localhost:8000)
- Playwright: navegador headless para testear la app
## Arquitectura (tras refactorización)
- `server/routes.ts` — Router composer (28 líneas)
- `server/routes/` — 11 módulos: auth, providers, appointments, slots, docks, capacity, integration, config, email, users, public
- `server/helpers/appointment-helpers.ts` — Lógica compartida de citas
- `server/agent/` — orchestrator, tools, calculator
- `server/services/slot-validator.ts` — Validador capacidad (puntos + muelles)
## REGLAS
- NO silenciar errores con `.catch(() => {})`
- NO usar `getDay()`, usar `getMadridDayOfWeek()` de `server/utils/madrid-date.ts`
- Timezone siempre Europe/Madrid
- Alpine: NO usar `<<<`
## Estado BD
- 3 muelles activos: M1, M2, M3 (96 disponibilidades)
- dock_buffer_minutes = 15
- SMTP configurado: Gmail (s.mellak.shiito@gmail.com) via Coolify env vars
