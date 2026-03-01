# RECOVERY REPORT — Unificación de Repos

**Fecha:** 2026-03-01  
**Commit de rescate:** `fb46cf9`

---

## 1. Situación inicial

Existían **2 clones git independientes** del repo:

| Ruta | HEAD | Commits | Estado |
|------|------|--------:|--------|
| `/root/eliasortega` | `3d0ceb3` | 74 | Correcto (tiene los 7 commits de mejoras) |
| `/home/claudeuser/eliasortega` | `368010d` | 65 | 9 commits atrás, PERO con cambios no commiteados de emails/notifications |

---

## 2. Archivos rescatados de /home/claudeuser

| Archivo | Acción | Cambio | Descripción |
|---------|--------|-------:|-------------|
| `server/routes/email.ts` | Copiar entero | +70 líneas | Email preview endpoint (GET) + test-confirmation endpoint (POST) |
| `server/services/provider-email-service.ts` | Copiar entero | +32 líneas | Funciones de preview (getConfirmationPreviewHtml, getReminderPreviewHtml) |
| `server/middleware/rate-limiting.ts` | Copiar entero | +88 líneas | Chat rate limiter: rolling window, 10/hora + 30/día por IP |
| `server/routes/public.ts` | Copiar entero | +4/-4 líneas | Usar chatRateLimiter en /api/chat/message |
| `client/src/pages/notifications-page.tsx` | Copiar entero | 899→1041 líneas | Rewrite completo: 3 tabs (Proveedores, Equipo, Registro) con preview |
| `client/src/lib/api.ts` | **Merge manual** | +16 líneas | Añadir sendTestConfirmation y getPreviewUrl (SIN sobrescribir contacts API) |
| `CLAUDE.md` | **Merge manual** | 2 líneas | Actualizar container name y SMTP status |
| `tests/e2e/email-system.spec.ts` | Copiar (nuevo) | +93 líneas | 5 tests de Playwright para sistema de emails |
| `tests/helpers/auth-helpers.ts` | Copiar (nuevo) | — | Helper de autenticación para tests |
| `tests/helpers/chat-helpers.ts` | Copiar (nuevo) | — | Helper de chat para tests |

**Total:** 10 archivos rescatados, ~1,100 líneas de código nuevo.

---

## 3. Archivos IGNORADOS (regresiones / sin cambios)

| Archivo | Razón |
|---------|-------|
| `client/src/components/providers-table.tsx` | Sin cambios de contenido (solo permisos). /root tiene versión con enriched fields. |
| `client/src/pages/providers-page.tsx` | Sin cambios de contenido. /root tiene ProviderEditModal. |
| `shared/types.ts` | Sin cambios de contenido. /root tiene ProviderContact, enriched fields. |
| `server/routes/providers.ts` | Sin cambios de contenido. /root tiene contacts CRUD. |
| `client/src/App.tsx` | Sin cambios de contenido. /root tiene FloatingAssistant. |
| ~155 archivos con `\| 0` en diff | Solo cambios de permisos (644→755), no contenido. |

---

## 4. Proceso de merge

### 4.1 api.ts — Merge manual
- /root tenía 1034 líneas (con contacts CRUD API de commit 4f39189)
- /home tenía ~1000 líneas base + 16 líneas nuevas de email
- Se insertaron SOLO las 2 funciones nuevas (`sendTestConfirmation`, `getPreviewUrl`) en la posición correcta dentro de `emailApi`
- Se preservaron TODAS las funciones de contacts CRUD

### 4.2 CLAUDE.md — Merge manual  
- Se aplicaron solo 2 cambios específicos con `sed`:
  - Container name: `165754960082` → `144450312557`
  - SMTP: "no configurado" → "configurado: Gmail via Coolify env vars"

### 4.3 notifications-page.tsx — Copia directa
- Archivo NO tocado por ninguno de los 7 commits que faltaban
- Base idéntica en ambos repos (899 líneas)
- La versión de /home es una reescritura completa (1041 líneas) con:
  - 3 tabs: Proveedores (config + preview iframe), Equipo (CRUD), Registro (log con filtros)
  - Preview de email en iframe con auth JWT via query param

---

## 5. Estado final de archivos clave

| Archivo | Líneas | Incluye |
|---------|-------:|---------|
| `providers-table.tsx` | 256 | Enriched fields, "Sin perfil" badge, modal edit |
| `providers-page.tsx` | 194 | ProviderEditModal, EmptyState |
| `shared/types.ts` | 504 | ProviderContact, enriched Provider fields |
| `server/routes/providers.ts` | 192 | Contacts CRUD (GET/POST/PUT/DELETE) |
| `notifications-page.tsx` | 1041 | 3 tabs, email preview, test send |
| `server/routes/email.ts` | 224 | Preview + test-confirmation endpoints |
| `api.ts` | 1050 | Contacts API + email preview/test |
| `client/src/App.tsx` | 214 | FloatingAssistant widget |
| `rate-limiting.ts` | ~130 | Chat rate limiter (10/h + 30/d) |

---

## 6. Verificación visual (Playwright screenshots)

### Proveedores (/providers)
- 88 proveedores listados
- Columnas: Nombre, Tipo, Categoría, Transporte, Contactos, Notas, Acciones
- "10 sin perfil" badge visible
- Badges de tipo (Agencia, Proveedor directo, Importación)
- Botones de editar/eliminar presentes

### Notificaciones (/notifications)
- **Tab Proveedores:** Config switches (confirmación, recordatorio), teléfono, texto adicional, preview iframe con email de muestra, botón "Enviar prueba"
- **Tab Equipo:** Tabla de destinatarios con toggles (Resumen, Alertas, Urgentes, Activo)
- **Tab Registro:** Log de 17 emails con filtros, estados (Enviado/Fallido)

### Calendario (/)
- Vista semanal con slots
- Citas con color por ocupación
- Badge "Capacidad normal"

### UI General
- Tildes correctas en sidebar (Auditoría, Precisión IA)
- Widget flotante de chat (esquina inferior derecha)
- Dark mode toggle visible

---

## 7. Unificación de repos

```
/home/claudeuser/eliasortega → symlink → /root/eliasortega
```

Verificación:
```
$ cd /root/eliasortega && git log --oneline -1
fb46cf9 feat: rescue email preview, notifications rewrite, chat rate limiter

$ cd /home/claudeuser/eliasortega && git log --oneline -1
fb46cf9 feat: rescue email preview, notifications rewrite, chat rate limiter
```

Ambos paths apuntan al **mismo commit**. No habrá más divergencias.

---

## 8. Backups

| Backup | Ruta |
|--------|------|
| /home antes de borrar | `/tmp/backup-home-claudeuser-repo` |
| /root antes de cambios | `/tmp/backup-root-repo` |

---

## 9. Conclusión

Recuperación completada exitosamente:
- **0 líneas de código perdidas** — todo el trabajo nuevo rescatado
- **0 regresiones introducidas** — build pasa, todas las features verificadas
- **Repos unificados** — symlink elimina posibilidad de futura divergencia
- **Deploy actualizado** — contenedor corriendo con todo el código

*Generado el 2026-03-01*
