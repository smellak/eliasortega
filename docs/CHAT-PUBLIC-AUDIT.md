# Auditoría UX/UI — Chat Público de Proveedores (`/chat`)

**Fecha:** 1 de marzo de 2026
**Auditor:** Claude Code
**Versión auditada:** Commit actual en `main`
**URL:** `https://elias.centrohogarsanchez.es/chat`
**Archivo fuente:** `client/src/pages/chat-public.tsx` (504 líneas)

---

## Resumen ejecutivo

El chat público es la **ventanilla digital** de Centro Hogar Sánchez frente a proveedores. Es la primera impresión que reciben los transportistas y comerciales que necesitan reservar citas de descarga. Actualmente presenta una base sólida con un diseño profesional en desktop, pero tiene carencias importantes en responsive, accesibilidad y funcionalidades avanzadas que impiden alcanzar la excelencia.

### Nota global: 6.1 / 10

---

## Metodología

Se utilizó **Playwright** en modo headless para capturar screenshots automatizados en **6 viewports**:

| Viewport | Resolución | Dispositivo simulado |
|----------|-----------|---------------------|
| Desktop | 1400x900 | Monitor estándar |
| Wide Desktop | 1920x1080 | Monitor grande |
| Tablet | 768x1024 | iPad |
| Mobile | 375x812 | iPhone 13 mini |
| Small Mobile | 320x568 | iPhone SE |
| Landscape | 812x375 | Móvil en horizontal |

Se evaluaron tanto el estado inicial (sin conversación) como el estado con conversación activa, modo claro y modo oscuro.

**Screenshots:** `test-results/screenshots/chat-audit/` (19 capturas)

---

## 1. Diseño Visual — 6.5/10

### Lo que funciona bien

- **Layout 2 columnas en desktop** — Panel izquierdo oscuro con branding + panel derecho claro con chat. Separación clara de funciones.
- **Gradientes profesionales** — Header y panel izquierdo usan gradientes azul-cyan coherentes con la marca.
- **Logo integrado** — Logotipo de Sánchez bien visible en contenedor con backdrop blur.
- **Video tutorial** — Incluido en panel izquierdo, añade confianza y profesionalidad.
- **Info bullets** — 3 datos clave (horario, instrucción, disponibilidad) con iconos.
- **Badge "En línea"** — Con punto verde pulsante, transmite disponibilidad inmediata.
- **Progress Stepper** — 4 pasos (Datos → Cálculo → Disponibilidad → Confirmación) contextualizan el proceso.
- **Modo oscuro** — Bien implementado, contraste adecuado, aspecto premium.
- **Burbujas diferenciadas** — Azul para usuario, blanco/gris para asistente, bien legibles.

### Problemas detectados

| ID | Problema | Severidad | Detalle |
|----|---------|-----------|---------|
| V1 | Avatar genérico "EO" | Media | Elías no tiene foto real ni ilustración personalizada. Un círculo con iniciales no genera confianza. |
| V2 | Video sin poster | Baja | El `<video>` no tiene atributo `poster`, muestra frame negro hasta que se carga. |
| V3 | Estado vacío sin personalidad | Media | Al entrar solo hay 1 burbuja de bienvenida flotando en un espacio enorme. Falta un onboarding visual. |
| V4 | Chat area excesiva en pantallas anchas | Media | En 1920px, el área de mensajes es desproporcionadamente grande. Los mensajes se ven diminutos y perdidos. |
| V5 | Botón de tema poco visible | Baja | El toggle de tema en el panel izquierdo está al fondo, es diminuto y pasa desapercibido. |
| V6 | Sin patrón/textura en área de chat | Baja | El fondo del chat es un gradiente liso. Un patrón sutil (como WhatsApp) añadiría calidez. |
| V7 | Avatar de usuario genérico | Baja | Icono de silueta de persona sin personalización. |

---

## 2. Diseño Responsive — 5.5/10

### Lo que funciona bien

- Usa `h-dvh` para altura dinámica del viewport (correcto para móvil).
- Panel izquierdo se oculta en `<lg` y aparece un header compacto.
- Video colapsa en móvil con Collapsible (buen patrón).
- Mensajes legibles en todos los tamaños.

### Problemas detectados

| ID | Problema | Severidad | Detalle |
|----|---------|-----------|---------|
| R1 | **Doble header en móvil** | Alta | En móvil hay 2 barras azules apiladas: (1) header con logo + nombre + tema, (2) chat header con avatar + nombre + "En línea" + sonido. Ambas muestran "Elías Ortega" y "Asistente de Almacén". Desperdicio de ~110px verticales. |
| R2 | Texto truncado en pantallas pequeñas | Media | En 320px el subtítulo se corta a "Ce..." y en 375px a "Centro Hoga...". No es legible. |
| R3 | Tablet sin panel lateral | Media | A 768px se pierde todo el panel izquierdo (video, info bullets). Oportunidad perdida de mostrar una versión compacta. |
| R4 | **Landscape móvil casi inutilizable** | Alta | A 812x375 el header + video bar + chat header consumen ~180px de los 375px disponibles. Solo quedan ~195px para mensajes + input. El mensaje de bienvenida aparece cortado. |
| R5 | Sin safe-area-inset | Media | No hay `env(safe-area-inset-*)` para el notch de iPhone X+. El input inferior puede quedar bajo el Home Indicator. |
| R6 | Barra "Conozca nuestro almacén" siempre visible | Baja | Incluso cerrada ocupa 40px en móvil. Podría mostrarse solo al inicio o integrarse en el chat como burbuja. |

---

## 3. Experiencia de Usuario — 6.0/10

### Lo que funciona bien

- **Streaming en tiempo real** — Las respuestas aparecen caracter a caracter (SSE).
- **Indicador de escritura** — 3 puntos animados + "Elías está escribiendo...".
- **Sonido de notificación** — Toggle para activar/desactivar sonidos al recibir respuesta.
- **Enter para enviar** — Con hint visible "Presiona Enter para enviar · Shift+Enter para nueva línea".
- **Progress stepper contextual** — Aparece solo al iniciar conversación y avanza según herramientas usadas.

### Problemas detectados

| ID | Problema | Severidad | Detalle |
|----|---------|-----------|---------|
| U1 | **Sin sugerencias rápidas** | Alta | El proveedor llega y no sabe qué escribir. Faltan botones de acción rápida como "Reservar cita", "Ver horarios", "Tengo una consulta". |
| U2 | **Sin botón "nueva conversación"** | Alta | No hay forma de reiniciar el chat. Si el proveedor quiere empezar de cero, tiene que recargar la página. |
| U3 | Sin botón "volver al sitio web" | Media | No hay enlace para ir a la web principal de Centro Hogar Sánchez. El proveedor queda atrapado en el chat. |
| U4 | Sin botón "detener respuesta" | Media | Cuando Elías está respondiendo (streaming), no hay forma de detener la generación. El `AbortController` existe en código pero no hay UI. |
| U5 | Sin scroll-to-bottom FAB | Baja | Si el usuario scrollea hacia arriba para releer, no hay indicador visual de nuevos mensajes abajo ni botón para volver al final. |
| U6 | Sin persistencia de sesión | Media | Al recargar la página se pierde toda la conversación. No hay `localStorage` backup. |
| U7 | Error sin recovery | Baja | Los errores se muestran como texto plano ("Error: HTTP error!"). Falta botón de reintentar. |
| U8 | Sin límite de longitud de mensaje | Baja | El textarea no tiene `maxLength`. Un proveedor podría pegar un texto enorme. |
| U9 | Sin feedback de envío | Baja | No hay animación ni confirmación visual al enviar el mensaje (checkmark, vibración). |
| U10 | Hint de teclado en móvil | Baja | "Presiona Enter para enviar" se oculta en móvil (`hidden sm:block`), correcto, pero en tablet (768px+) sigue visible aunque el usuario probablemente use toque. |

---

## 4. Accesibilidad — 4.5/10

### Lo que funciona bien

- `data-testid` en elementos clave (bueno para testing).
- `aria-label` en botón de envío y toggle de sonido.
- Textos alternativos en imágenes del logo.

### Problemas detectados

| ID | Problema | Severidad | Detalle |
|----|---------|-----------|---------|
| A1 | Sin roles ARIA en el chat | Alta | El contenedor de mensajes no tiene `role="log"` ni `aria-live="polite"`. Los lectores de pantalla no anuncian mensajes nuevos. |
| A2 | Sin focus management | Media | Después de enviar un mensaje, el foco no vuelve automáticamente al textarea. |
| A3 | Contraste insuficiente en algunos textos | Media | Los timestamps en `text-blue-100` sobre burbujas azules, y `text-muted-foreground` en modo oscuro, podrían no cumplir WCAG AA (4.5:1). |
| A4 | Video sin subtítulos/captions | Media | El video tutorial no tiene `<track>` para subtítulos. |
| A5 | Sin skip-to-content | Baja | No hay enlace para saltar directamente al área de input. |
| A6 | Navegación por teclado limitada | Media | No se puede navegar entre mensajes con Tab/flechas. |

---

## 5. Funcionalidad — 6.5/10

### Lo que funciona bien

- Streaming SSE robusto con chunked parsing.
- Detección de herramientas para avanzar el stepper (calculator → Cálculo, calendar_availability → Disponibilidad, calendar_book → Confirmación).
- ReactMarkdown para renderizar respuestas con formato.
- Soporte de código, listas, negrita, enlaces en respuestas.
- ID de sesión único por pestaña.

### Problemas detectados

| ID | Problema | Severidad | Detalle |
|----|---------|-----------|---------|
| F1 | Sin adjuntos/fotos | Media | Los proveedores no pueden enviar fotos de albaranes, mercancía, etc. |
| F2 | Sin copiar mensaje | Baja | No hay opción de copiar texto de un mensaje específico. |
| F3 | Sin feedback (thumbs up/down) | Baja | No hay mecanismo para que el proveedor indique si la respuesta fue útil. |
| F4 | Sin transcript por email | Baja | No hay opción de recibir la conversación por email al terminar. |
| F5 | Sin rate limiting visual | Baja | Si el API limita peticiones, el usuario no ve un mensaje claro. |
| F6 | Sin reconexión offline | Media | No hay detección de pérdida de conexión ni reintentos automáticos. |

---

## 6. Primera Impresión y Marca — 7.0/10

### Lo que funciona bien

- El panel izquierdo en desktop genera confianza: logo, nombre, video, horarios.
- "Elías Ortega" con nombre y cargo humaniza la experiencia.
- El badge "En línea" sugiere disponibilidad inmediata.
- Gradientes azules coherentes con identidad corporativa.

### Problemas detectados

| ID | Problema | Severidad | Detalle |
|----|---------|-----------|---------|
| B1 | Sin favicon/título personalizado | Media | La pestaña del navegador no tiene título específico ("Elías - Centro Hogar Sánchez") ni favicon. |
| B2 | Sin disclaimer de IA | Media | No hay aviso de que el proveedor habla con una IA. Cuestión legal y de transparencia. |
| B3 | Sin enlace a política de privacidad | Media | Se procesan datos personales (nombre empresa, mercancía) sin enlace a términos. |
| B4 | Sin datos de contacto alternativos | Baja | No hay teléfono, email o WhatsApp de respaldo si el chat no funciona. |
| B5 | Sin dirección/mapa | Baja | Los proveedores que vienen por primera vez no ven la ubicación del almacén. |

---

## 7. Rendimiento — 7.0/10

### Lo que funciona bien

- `preload="metadata"` en video (no descarga todo al cargar).
- Streaming evita esperas largas.
- Componentes ligeros sin dependencias pesadas.

### Áreas de mejora

| ID | Problema | Severidad |
|----|---------|-----------|
| P1 | Video podría ser lazy-loaded | Baja |
| P2 | Sin Service Worker para offline | Baja |
| P3 | Logo podría usar formato WebP/AVIF | Baja |

---

## Resumen de puntuación

| Categoría | Nota | Peso | Ponderado |
|-----------|------|------|-----------|
| Diseño Visual | 6.5 | 20% | 1.30 |
| Responsive | 5.5 | 20% | 1.10 |
| Experiencia de Usuario | 6.0 | 25% | 1.50 |
| Accesibilidad | 4.5 | 10% | 0.45 |
| Funcionalidad | 6.5 | 10% | 0.65 |
| Marca / Primera Impresión | 7.0 | 10% | 0.70 |
| Rendimiento | 7.0 | 5% | 0.35 |
| **TOTAL** | | **100%** | **6.05 → 6.1** |

---

## Hoja de ruta hacia el 10/10

### Prioridad 1 — Impacto alto, esfuerzo bajo (6.1 → 7.5)

| # | Mejora | Categoría | Impacto |
|---|--------|-----------|---------|
| 1 | **Unificar headers en móvil** — Fusionar el header móvil y el chat header en uno solo. Logo + "Elías Ortega" + badge "En línea" + toggle sonido/tema, todo en una barra. Recuperar ~55px verticales. | Responsive | +0.5 |
| 2 | **Añadir botones de sugerencia rápida** — 3-4 chips bajo el mensaje de bienvenida: "Reservar cita de descarga", "Consultar horarios", "Hablar con almacén". Se ocultan tras el primer mensaje. | UX | +0.4 |
| 3 | **Avatar con foto real** — Sustituir "EO" por una foto recortada del video o una ilustración estilo cartoon del empleado de almacén. Genera confianza inmediata. | Visual | +0.3 |
| 4 | **Botón "Nueva conversación"** — Icono de "refresh" en el header del chat. Con confirmación si hay mensajes. | UX | +0.2 |

### Prioridad 2 — Impacto medio, esfuerzo medio (7.5 → 8.5)

| # | Mejora | Categoría | Impacto |
|---|--------|-----------|---------|
| 5 | **Welcome card mejorada** — Reemplazar la burbuja solitaria por una tarjeta de bienvenida con: foto de Elías, nombre, descripción breve, 3 quick-action buttons, y un "Escribe tu primera pregunta abajo". | Visual + UX | +0.3 |
| 6 | **Optimizar landscape móvil** — Reducir header a una sola línea compacta (logo + nombre + badges). Ocultar barra de video. Maximizar espacio de chat. | Responsive | +0.2 |
| 7 | **Panel lateral compacto en tablet** — A 768-1023px, mostrar un mini-panel con logo + 3 info bullets (sin video). A partir de 1024px, panel completo. | Responsive | +0.2 |
| 8 | **Botón detener respuesta** — Mientras Elías escribe, mostrar un botón "Detener" que use el AbortController existente. | UX | +0.1 |
| 9 | **ARIA roles y live regions** — `role="log"` + `aria-live="polite"` en el contenedor de mensajes. `aria-label` en todos los botones. | Accesibilidad | +0.2 |
| 10 | **Disclaimer de IA + privacidad** — Pequeño texto al pie: "Elías es un asistente de IA. [Política de privacidad]". Cumplimiento legal. | Marca | +0.1 |
| 11 | **Título y favicon** — `document.title = "Elías - Centro Hogar Sánchez"` + favicon corporativo. | Marca | +0.1 |
| 12 | **Safe-area-inset** — Añadir `pb-[env(safe-area-inset-bottom)]` al input area para iPhone X+. | Responsive | +0.1 |

### Prioridad 3 — Pulido hacia la excelencia (8.5 → 9.5)

| # | Mejora | Categoría | Impacto |
|---|--------|-----------|---------|
| 13 | **Persistencia de sesión** — Guardar mensajes en `localStorage` con TTL de 24h. Al recargar, recuperar la conversación. | Funcionalidad | +0.15 |
| 14 | **Scroll-to-bottom FAB** — Cuando el usuario scrollea arriba, mostrar un botón flotante "↓ Nuevos mensajes". | UX | +0.1 |
| 15 | **Animaciones micro** — Entrada suave de burbujas (slide-up), animación del botón enviar (scale on press), transición del stepper. | Visual | +0.1 |
| 16 | **Patrón de fondo en chat** — Patrón SVG sutil (estilo WhatsApp) con opacidad baja para dar textura al área de chat. | Visual | +0.05 |
| 17 | **Detección offline** — Banner "Sin conexión — reconectando..." con reintento automático. | Funcionalidad | +0.1 |
| 18 | **Reintentar en error** — Botón "Reintentar" en la burbuja de error en lugar de texto plano. | UX | +0.05 |
| 19 | **Copiar mensaje** — Menú contextual (long-press en móvil, right-click en desktop) para copiar texto. | Funcionalidad | +0.05 |
| 20 | **Subtítulos en video** — Añadir track `.vtt` al video tutorial. | Accesibilidad | +0.05 |
| 21 | **Contacto alternativo** — Mostrar teléfono + email en el panel izquierdo (desktop) y en un menú de ayuda (móvil). | Marca | +0.1 |
| 22 | **Enlace "Volver a la web"** — Link en el header hacia la página principal de CHS. | UX | +0.05 |
| 23 | **Límite de caracteres** — `maxLength={1000}` con contador visual "856/1000". | UX | +0.05 |

### Prioridad 4 — Toque final (9.5 → 10)

| # | Mejora | Categoría | Impacto |
|---|--------|-----------|---------|
| 24 | **Typing indicator contextual** — En lugar de solo "Elías está escribiendo...", mostrar "Elías está consultando el calendario..." cuando usa `calendar_availability`, "Elías está calculando..." cuando usa `calculator`, etc. | UX | +0.1 |
| 25 | **Confirmaciones de lectura** — Checkmarks estilo WhatsApp (✓ enviado, ✓✓ recibido). | UX | +0.05 |
| 26 | **Feedback en respuestas** — Thumbs up/down discreto en cada respuesta del asistente. | Funcionalidad | +0.1 |
| 27 | **Email transcript** — Al completar una reserva, ofrecer "¿Quieres recibir esta conversación por email?". | Funcionalidad | +0.1 |
| 28 | **Mapa del almacén** — Mini-mapa interactivo o link a Google Maps en el panel izquierdo. | Marca | +0.05 |
| 29 | **PWA manifest** — Permitir "Añadir a pantalla de inicio" en móvil para acceso rápido. | Rendimiento | +0.05 |
| 30 | **Focus management** — Auto-focus en textarea al cargar y después de enviar. Navegación por teclado entre mensajes. | Accesibilidad | +0.05 |

---

## Diagrama de impacto vs esfuerzo

```
IMPACTO
  ^
  |  [1] Unificar headers     [5] Welcome card
  |  [2] Sugerencias rápidas
  |  [3] Avatar foto           [7] Panel tablet
  |  [4] Nueva conversación    [9] ARIA roles
  |                             [6] Landscape fix
  |  [11] Favicon              [13] Persistencia
  |  [10] Disclaimer           [17] Offline
  |  [8] Detener               [24] Typing contextual
  |  [12] Safe-area            [27] Email transcript
  |  [16] Patrón fondo         [29] PWA
  |  [23] Límite chars         [26] Feedback
  +-----------------------------------------> ESFUERZO
      Bajo                  Medio            Alto
```

---

## Conclusión

El chat público de Centro Hogar Sánchez tiene una **base sólida** en desktop: diseño profesional, streaming funcional, stepper de progreso, y buena identidad visual. Sin embargo, la experiencia se degrada significativamente en **móvil y tablet** — precisamente donde la mayoría de transportistas lo usarán (desde la cabina del camión o la calle).

Las 4 mejoras de Prioridad 1 (unificar headers, sugerencias rápidas, avatar con foto, nueva conversación) podrían llevarlo de 6.1 a ~7.5 con esfuerzo relativamente bajo. Las mejoras de Prioridad 2 lo acercarían a 8.5.

Para llegar a 10/10, el chat necesita sentirse como una **app de mensajería nativa** — con la fluidez de WhatsApp, la profesionalidad de Intercom, y la personalización de un asistente humano que conoce el negocio.

---

*Auditoría generada automáticamente. Screenshots disponibles en `test-results/screenshots/chat-audit/`.*
