# Informe de Auditoría Git — Análisis de Regresiones

**Fecha:** 2026-03-01
**Autor:** Claude (auditoría automatizada)

## 1. Causa Raíz

Existen DOS copias independientes del repositorio en la máquina:

| Directorio | HEAD | Último commit |
|---|---|---|
| `/root/eliasortega` | `dfd04e3` | feat: marcar proveedores sin perfil completo |
| `/home/claudeuser/eliasortega` | `368010d` | feat: Phase D — deduplicate providers via alias lookup on booking |

`/home/claudeuser` está **7 commits por detrás** de `/root`. Nunca se hizo `git pull` en `/home/claudeuser` para traer los 7 commits que se hicieron y pushearon desde `/root`.

## 2. Los 7 commits que existen en /root pero NO en /home/claudeuser

```
dfd04e3 feat: marcar proveedores sin perfil completo
7b59a7b test: verificación Playwright de nuevas funcionalidades
81b9557 feat: widget flotante de asistente IA accesible desde todas las páginas
4f39189 feat: modal completo de edición de proveedores con CRUD de contactos
3c01ca1 fix: corregir tildes y acentos en toda la interfaz
9e71c76 test: add comprehensive Playwright test suite
062916c fix: providers table shows enriched fields + calendar color readability
```

## 3. Mecanismo de la Regresión

1. La sesión anterior de Claude trabajó en `/root/eliasortega` — hizo 7 commits con features (modal de proveedores, tildes, floating assistant, badge "Sin perfil", tests) y los pusheó a origin/main.
2. La sesión actual arrancó en `/home/claudeuser/eliasortega` — un clon separado que NO fue actualizado. Está en commit `368010d`, sin los 7 commits nuevos.
3. Al editar archivos como `notifications-page.tsx`, `email.ts`, `api.ts` en `/home/claudeuser`, se trabajó sobre la versión antigua.
4. Al hacer `npm run build` y `docker cp` al contenedor, el build incluyó la versión antigua de TODOS los archivos — sobrescribiendo los cambios de los 7 commits en el contenedor de producción.

## 4. Archivos Afectados — Regresiones Específicas

| Archivo | /root (correcto) | /home (regresado) | Qué se perdió |
|---|---|---|---|
| `providers-table.tsx` | 256 líneas | 184 líneas | onEditClick, isIncompleteProvider, badge "Sin perfil", enriched fields display, sorting |
| `server/routes/providers.ts` | 192 líneas | 118 líneas | GET /:id con contacts, POST/PUT/DELETE contacts CRUD (3 routes) |
| `providers-page.tsx` | 194 líneas | 185 líneas | ProviderEditModal integration, handleEditClick, contacts handlers |
| `shared/types.ts` | 504 líneas | 475 líneas | createProviderSchema con enriched fields, updateProviderSchema |
| Tildes (7 archivos) | Corregidas | Sin corregir | "Almacen" → "Almacén", "ocupacion" → "ocupación", etc. |

### Archivos sin regresión (iguales en ambas copias):
- `server/agent/tools.ts` (656 líneas)
- `server/agent/prompts.ts` (216 líneas)
- `client/src/pages/chat-public.tsx` (504 líneas)

## 5. Estado del Contenedor en Producción

El contenedor tiene código buildeado desde `/home/claudeuser` (versión vieja):
- **NO tiene** contacts CRUD routes
- **NO tiene** badge "Sin perfil"
- **NO tiene** tildes corregidas
- **SÍ tiene** email preview (añadido en esta sesión)
- **SÍ tiene** notifications page reescrita con 3 tabs

## 6. Solución Recomendada

No hay commits que revertir ni cherry-pick. El repositorio git en `/root` está intacto y correcto.

Pasos a seguir:
1. Sincronizar `/home/claudeuser` con `git pull origin main` para traer los 7 commits faltantes
2. Re-aplicar los cambios de email (preview, test-confirmation, notifications page rewrite) sobre los archivos actualizados
3. Rebuild y redeploy al contenedor
4. **Prevención futura:** siempre hacer `git pull` antes de empezar a trabajar en cualquier copia

## 7. Historial Completo de Commits Recientes

```
dfd04e3 feat: marcar proveedores sin perfil completo
7b59a7b test: verificación Playwright de nuevas funcionalidades
81b9557 feat: widget flotante de asistente IA accesible desde todas las páginas
4f39189 feat: modal completo de edición de proveedores con CRUD de contactos
3c01ca1 fix: corregir tildes y acentos en toda la interfaz
9e71c76 test: add comprehensive Playwright test suite
062916c fix: providers table shows enriched fields + calendar color readability
368010d feat: Phase D — deduplicate providers via alias lookup on booking
3b18e35 feat: Phase B+C — provider_lookup tool + soft knowledge in system prompt
0cca313 feat: Phase A — enrich Provider schema + seed 78 supplier profiles
d4ea9a7 fix: service worker uses network-first for HTML pages
5d4fa44 fix: improve chat design — wider panel, accents, professional styling
2640d38 feat: redesign public chat — 2-column layout with branding
c61e0fe data: export 12,521 emails as readable markdown blocks for external analysis
8de440b data: complete supplier profiles — deep email analysis with aliases, phones, agency mappings
```
