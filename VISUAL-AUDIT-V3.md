# Auditoría Visual V3 — Camino al 10/10

**Fecha:** 2026-03-01
**Autor:** Claude Opus 4.6
**Contexto:** Tras implementar los 20 fixes de la Auditoría V2 (P0+P1+P2), documentados en `FIXES-APPLIED.md`
**Screenshots:** 28 capturas en `test-results/screenshots/visual-audit-v3/`
**Dispositivos testeados:** Desktop 1400px, Dark mode 1400px, Mobile 375px, Tablet 768px, Wide desktop 1920px

---

## Resumen Ejecutivo

La V2 elevó la puntuación media de 6.2 a 8.4/10. El calendario es funcional, responsive, y visualmente competente. Sin embargo, para alcanzar **10/10** faltan detalles de **pulido premium** que distinguen un "buen dashboard" de un "dashboard excepcional". Esta auditoría identifica **4 problemas P0**, **8 mejoras P1**, **12 pulidos P2** y **5 aspiracionales P3**.

**Puntuación actual post-V2 (verificada con 28 screenshots):**

| Vista | Desktop 1400 | Dark 1400 | Tablet 768 | Mobile 375 | Wide 1920 |
|-------|-------------|-----------|------------|------------|-----------|
| Semana con datos | 8.5/10 | 8.5/10 | 6/10 | N/A (→ día) | 8.5/10 |
| Semana vacía | 7.5/10 | 7/10 | 5.5/10 | N/A (→ día) | 7.5/10 |
| Día con datos | 8.5/10 | 8/10 | 8/10 | 7.5/10 | 8.5/10 |
| Día vacío | 7.5/10 | 7/10 | 7.5/10 | 6.5/10 | 7.5/10 |
| Día domingo | 8/10 | 8/10 | 7.5/10 | 6.5/10 | 8/10 |
| Mes | 8.5/10 | 8.5/10 | 7/10 | 7/10 | 8.5/10 |
| KPIs | 9/10 | 8.5/10 | 8/10 | 8/10 | 9/10 |

**Media actual: 7.8/10** — **Objetivo: 10/10**

---

## P0 — Problemas Críticos (impiden el 9/10)

### P0-1. Botón "Nueva Cita" SIGUE cortado en tablet
**Screenshots:** `23-tablet-week-viewport.png`, `24-tablet-week-data.png`, `25-tablet-day.png`, `26-tablet-month.png`

En las 4 capturas de tablet (768px) el botón "Nueva Cita" se muestra como **"+ Nue"** — el texto está truncado. La sidebar (~310px) + header actions no dejan espacio suficiente.

**Causa:** El fix P0-2 de V2 usó `hidden sm:inline` (640px), pero el problema en tablet (768px) persiste porque la sidebar reduce el espacio disponible a ~458px. El breakpoint `sm` (640px) no es suficiente — se necesita `md` (768px) o incluso `lg` (1024px).

**Solución propuesta:**
```tsx
// Opción A: Ocultar texto hasta lg (1024px)
<span className="hidden lg:inline">Nueva Cita</span>

// Opción B: Texto corto en tablet, completo en desktop
<span className="hidden sm:inline lg:hidden">Cita</span>
<span className="hidden lg:inline">Nueva Cita</span>
```

**Impacto:** Alto — el CTA principal está roto en un breakpoint completo.

---

### P0-2. Sin indicador de "Hoy" en vista mensual
**Screenshots:** `10-desktop-month-mar.png`, `11-desktop-month-feb.png`, `16-dark-month.png`, `28-wide-month.png`

Hoy es 1 de marzo de 2026, pero en la vista mensual de marzo, el día 1 no tiene NINGÚN indicador visual de que es "hoy". No hay círculo, no hay fondo, no hay borde. El usuario no puede localizar el día actual sin leer cada número.

**Todos los dashboards de calendario premium** (Google Calendar, Outlook, Notion, Cal.com) marcan "hoy" con un círculo azul o fondo destacado. Su ausencia es una omisión grave en un calendario de gestión.

**Solución propuesta:**
```tsx
// En MonthView, celda del día actual:
const isToday = isSameDay(day, new Date());
// Aplicar: bg-primary/10 border-primary text-primary font-bold al número
<span className={cn(
  "inline-flex h-7 w-7 items-center justify-center rounded-full",
  isToday && "bg-primary text-primary-foreground font-bold"
)}>
  {format(day, 'd')}
</span>
```

**Impacto:** Alto — el usuario pierde orientación temporal en la vista más panorámica.

---

### P0-3. Título de día en mobile se desborda a 3 líneas
**Screenshots:** `18-mobile-day-viewport.png`, `19-mobile-day-data-viewport.png`, `22-mobile-day-sunday.png`

En 375px, el título **"Domingo 01 de marzo 2026"** ocupa 3 líneas completas (~120px de alto). Esto empuja el contenido del calendario muy abajo. El usuario ve en "above the fold":
1. Header app (50px)
2. Título "Calendario" + subtítulo (80px)
3. Botones PDF/Capacidad/+ (40px)
4. 4 KPIs en 2x2 (200px)
5. "Detalles por Slot" colapsado (50px)
6. Navegación < Hoy > (40px)
7. **Título del día en 3 líneas (120px)**
8. Botones Mes/Día (40px)

**Total antes de ver contenido: ~620px de 812px.** Solo quedan ~190px para el calendario real.

**Solución propuesta:**
```tsx
// En mobile, usar formato corto:
const titleText = isMobile
  ? format(currentDate, "EEE dd MMM yyyy", { locale: es })  // "dom 01 mar 2026"
  : format(currentDate, "EEEE dd 'de' MMMM yyyy", { locale: es });
```

O mover los view toggles (Mes/Día) al mismo renglón que la navegación < Hoy >.

**Impacto:** Alto — en mobile, el calendario es casi invisible "above the fold".

---

### P0-4. Chat FAB superpuesto al contenido
**Screenshots:** `10-desktop-month-mar.png`, `20-mobile-month-viewport.png`, `22-mobile-day-sunday.png`, `23-tablet-week-viewport.png`

El botón flotante de chat (círculo morado, esquina inferior-derecha) se superpone al contenido del calendario en todos los breakpoints:
- **Desktop/Tablet:** Cubre parcialmente la columna DOM/SÁB del mes y del week grid
- **Mobile:** Cubre la esquina inferior-derecha de la grid mensual y el botón "Día"

**Solución propuesta:**
```css
/* Añadir padding-bottom al contenedor principal del calendario */
.calendar-container {
  padding-bottom: 80px; /* espacio para el FAB */
}

/* O mover el FAB a esquina inferior-izquierda en la página de calendario */
```

**Nota:** Si el chat es un componente externo (ej: Tidio, Crisp), puede requerir CSS global o configuración del widget.

**Impacto:** Medio-alto — oculta información y puede bloquear interacciones en la última columna/fila.

---

## P1 — Mejoras Importantes (impiden el 9.5/10)

### P1-1. "Detalles por Slot" usa fechas ISO
**Screenshot:** `04-desktop-details-expanded.png`

Los headers de agrupación muestran **"2026-03-02"** y **"2026-03-03"** en formato ISO. El resto de la UI usa formato español ("02 mar", "Lunes 09 de marzo 2026"). Esta inconsistencia rompe la coherencia visual.

**Solución propuesta:**
```tsx
// Cambiar el header del grupo de:
<span>2026-03-02</span>
// A:
<span>{format(parseISO(dateKey), "EEEE dd/MM", { locale: es })}</span>
// Resultado: "lunes 02/03"
```

**Impacto:** Medio — inconsistencia de formato que parece "de desarrollador".

---

### P1-2. Slot Pico muestra fecha en formato ISO
**Screenshots:** `02-desktop-week-data-viewport.png`, `13-dark-week-data.png`

El KPI "SLOT PICO" muestra **"03-02 08:00"** — formato ambiguo (¿mes-día o día-mes?). Debería usar el formato consistente con el resto: "02/03 08:00" o "Lun 02/03 08:00".

**Solución propuesta:**
```tsx
// En capacity-indicators.tsx, formatear la fecha del peakSlot:
const formattedDate = format(parseISO(peakSlot.date), "dd/MM", { locale: es });
// Mostrar: "Lun 02/03 08:00" o "02/03 08:00"
```

**Impacto:** Medio — confusión potencial sobre el formato de fecha.

---

### P1-3. Tablet: sidebar demasiado ancha para week view
**Screenshots:** `23-tablet-week-viewport.png`, `24-tablet-week-data.png`

En tablet (768px), la sidebar ocupa ~310px, dejando solo ~458px para el contenido. En week view, esto muestra solo **2 columnas completas** (Lun, Mar) + un fragmento de Mié. El usuario debe hacer scroll horizontal para ver Jue-Sáb — experiencia similar al bug P0-3 de V2 en mobile.

**Solución propuesta:**
- **Opción A:** Colapsar la sidebar automáticamente en tablet (< 1024px), mostrándola como overlay al tocar un hamburger icon
- **Opción B:** Reducir sidebar a icons-only en tablet (~64px), expandible al hover
- **Opción C:** Auto-redirigir week → day en tablet (como en mobile), aunque menos ideal

**Impacto:** Alto — la week view en tablet es prácticamente inutilizable (peor que desktop pero sin la protección de auto-redirect a day).

---

### P1-4. Día vacío: 6 slots idénticos repetitivos
**Screenshots:** `06-desktop-day-mar3-full.png`, `07-desktop-day-mar4-empty.png`, `08-desktop-day-sat-full.png`, `15-dark-day-empty.png`

Cuando un día tiene 0 citas, se muestran 6 cards idénticas:
```
08:00 — 10:00  |  0/6 pts  0%  | 3 muelles | + Añadir
        Franja libre — 6 pts disponibles
10:00 — 12:00  |  0/6 pts  0%  | 3 muelles | + Añadir
        Franja libre — 6 pts disponibles
[... ×6 idénticas]
```

El badge "3 muelles" se repite 6 veces innecesariamente. El aspecto es monótono y no aporta información nueva después del primer slot.

**Solución propuesta:**
- Mostrar "3 muelles" solo una vez como dato general del día (en el header)
- Colapsar slots vacíos consecutivos: "08:00 — 20:00: 6 franjas libres — 34 pts disponibles" con botón "Expandir"
- O reducir la altura de slots vacíos cuando hay más de 3 vacíos consecutivos

**Impacto:** Medio — el usuario hace scroll innecesario por información redundante.

---

### P1-5. Fechas de mes previo/siguiente no atenuadas
**Screenshots:** `10-desktop-month-mar.png`, `11-desktop-month-feb.png`, `26-tablet-month.png`, `28-wide-month.png`

En la vista de Marzo 2026, la primera fila muestra los días 23-28 (de febrero). Estos días del mes anterior NO tienen opacidad reducida — se ven idénticos a los días de marzo. Lo mismo ocurre con los días del mes siguiente en la última fila.

Todos los calendarios estándar (iOS Calendar, Google Calendar, Outlook) atenúan los días fuera del mes actual para dar contexto sin confundir.

**Solución propuesta:**
```tsx
const isCurrentMonth = isSameMonth(day, currentDate);
// Aplicar opacity-40 o text-muted-foreground a los días fuera del mes
<td className={cn(!isCurrentMonth && "opacity-40")}>
```

**Impacto:** Medio — confusión sobre qué mes se está viendo, especialmente en la primera/última fila.

---

### P1-6. Mobile: demasiado contenido "above the fold"
**Screenshots:** `18-mobile-day-viewport.png`, `19-mobile-day-data-viewport.png`, `20-mobile-month-viewport.png`

En mobile (375px), antes de ver el primer dato del calendario, el usuario debe pasar por:
1. Barra superior de la app (~50px)
2. Título "Calendario" + subtítulo (~80px)
3. Botones de acción PDF/Capacidad/+ (~45px)
4. 4 KPIs en grid 2x2 (~220px)
5. "Detalles por Slot" colapsado (~55px)
6. Navegación + título de fecha (~140px)
7. Toggle de vista (~45px)

**Total: ~635px de 812px viewport.** Solo quedan ~177px para contenido real.

**Solución propuesta (ordenadas por impacto):**
1. **Mover los toggles de vista** (Mes/Día) a la misma línea que la navegación `< Hoy >`
2. **Hacer los KPIs colapsables** en mobile (mostrar solo 2 principales: Citas + Ocupación), expandir con un tap
3. **Ocultar "Detalles por Slot"** en mobile (accesible desde otro lugar)
4. **Compactar la barra de acciones** (PDF + Capacidad en un menu "...")

**Impacto:** Alto — el contenido más importante (las citas) queda debajo del fold.

---

### P1-7. Week view: dots de ocupación en headers demasiado pequeños
**Screenshots:** `02-desktop-week-data-viewport.png`, `01-desktop-week-empty.png`, `13-dark-week-data.png`

Cada columna del week view tiene un dot coloreado (verde/naranja/rojo) debajo del header que indica el nivel de ocupación del día. Estos dots son tan pequeños (~4px) que pasan completamente desapercibidos. El summary bar "——— 10/32" es más legible, pero el dot de color que debería dar señal rápida es invisible.

**Solución propuesta:**
- Reemplazar el dot por una barra de progreso horizontal de 100% del ancho del header (~120px)
- O aumentar el dot a un chip: `<Badge variant="outline">31%</Badge>`
- O añadir un fondo sutil coloreado al header del día (verde tenue = libre, rojo tenue = lleno)

**Impacto:** Medio — se pierde una señal visual de ocupación que ya está implementada pero es invisible.

---

### P1-8. "Capacidad normal" badge y tooltip wrapping
**Screenshots:** `07-desktop-day-mar4-empty.png`, `08-desktop-day-sat-full.png`, `10-desktop-month-mar.png`, `11-desktop-month-feb.png`

En la vista de día y mes, la zona superior-derecha muestra:
```
● Capacidad normal
Hoy: 0/34 puntos en 6 franjas
```
El texto "Hoy: 0/34 puntos en 6 franjas" se muestra debajo del badge, creando un layout de 2 líneas que desalinea los botones del header. En algunos breakpoints el texto wraps awkwardly.

**Solución propuesta:**
- Mover el texto contextual al interior de un tooltip del badge "Capacidad normal"
- O integrarlo como subtitle de los KPIs
- O mostrarlo inline en una sola línea: `● Capacidad normal — 0/34 pts en 6 franjas`

**Impacto:** Bajo-medio — desalineación estética en el header.

---

## P2 — Pulidos y Refinamientos (impiden el 10/10)

### P2-1. Dark mode: contraste de "Libre" en week view
**Screenshot:** `13-dark-week-data.png`

Los slots vacíos del week view en dark mode muestran "+" y "Libre" en gris muy claro sobre fondo oscuro. El contraste es insuficiente — el texto es casi invisible. Necesita `dark:text-muted-foreground/40` como mínimo.

### P2-2. Dark mode: KPI cards se confunden con el fondo
**Screenshots:** `13-dark-week-data.png`, `17-dark-kpis.png`

Las 4 KPI cards en dark mode tienen borde sutil que se confunde con el fondo oscuro. Las cards flotan visualmente pero no tienen suficiente separación. Añadir `dark:border-border/50` o un sutil `dark:bg-card/80` para más contraste.

### P2-3. Mes: días vacíos sin contexto de disponibilidad
**Screenshots:** `10-desktop-month-mar.png`, `28-wide-month.png`

Los días 4, 5, 7, 9-31 de marzo están completamente vacíos — solo muestran el número. No hay indicación de si hay franjas disponibles o no. Para un gestor de almacén, saber "día 10: 6 franjas, 34 pts libres" sin entrar al día sería valioso.

**Propuesta:** Añadir un indicator sutil en días con franjas pero sin citas: un pequeño "○" o "6f" en gris tenue, indicando que hay slots configurados.

### P2-4. Week view: scroll affordance inexistente
**Screenshots:** `02-desktop-week-data-viewport.png`, `03-desktop-week-scrolled.png`

El grid semanal se extiende debajo del viewport (slots 14:00-20:00 no son visibles sin scroll), pero no hay ningún indicador visual de que hay más contenido abajo. Un shadow o fade en el bottom edge sería útil.

### P2-5. Day view con datos: título del slot header cortado
**Screenshot:** `19-mobile-day-data-viewport.png`

En mobile, el header del slot muestra: `— 4/4 pts 100% 2 m...` — el texto "2 muelles" se corta como "2 m...". A 375px no hay espacio suficiente para todo el metadata inline.

**Propuesta:** En mobile, mover "N muelles" debajo del header principal, o abreviarlo a "2M".

### P2-6. Month view: no hay week numbers
**Screenshots:** `10-desktop-month-mar.png`, `28-wide-month.png`

Los calendarios de gestión europeos suelen mostrar el número de semana (S9, S10, S11...) en el margen izquierdo. Esto facilita la referencia cruzada con sistemas logísticos que trabajan por semana ISO.

**Propuesta:** Columna izquierda estrecha con `W${getISOWeek(day)}`.

### P2-7. Wide desktop (1920px): KPIs no aprovechan el espacio
**Screenshot:** `27-wide-week.png`

En 1920px, los 4 KPIs se distribuyen en una fila pero con mucho padding. El contenido de cada card es idéntico al de 1400px. El espacio extra no aporta nada visual.

**Propuesta:** En wide desktop, añadir mini-sparklines a los KPIs (tendencia de la semana) o mostrar un quinto KPI ("Tasa de cancelación" o "Citas pendientes").

### P2-8. Inconsistencia de separadores entre slots en week view
**Screenshots:** `02-desktop-week-data-viewport.png`, `27-wide-week.png`

Los slots del week view muestran una línea divisoria (08:00, 10:00, 12:00...) en el lado izquierdo. Estas líneas son inconsistentes — algunas veces el slot header "08:00-10:00" aparece dentro del bloque y otras en el borde. La alineación de las time labels con los bloques no es pixel-perfect.

### P2-9. Week view: "Libre" label position inconsistente
**Screenshots:** `01-desktop-week-empty.png`, `02-desktop-week-data-viewport.png`

En slots vacíos, el texto "Libre" y el "+" aparecen centrados vertical y horizontalmente. Pero cuando el slot es muy corto (ej: SÁB 08:00-11:00 que tiene 3h = ~210px), el label se posiciona bien. En slots de 2h (~140px), queda algo apretado. Normalizar el posicionamiento para que siempre se vea centrado.

### P2-10. Empty state del domingo: icono y mensaje podrían ser más cálidos
**Screenshots:** `05-desktop-day-mar2-viewport.png`, `14-dark-day-full.png`, `22-mobile-day-sunday.png`

El mensaje "No hay franjas configuradas para domingo 08/03/2026" con el icono de reloj es correcto pero frío. Un mensaje más humano sería: "Domingo — almacén cerrado" con un icono de casa o luna, manteniendo el tono de la app.

### P2-11. Badge de proveedor en month view cortado en tablet
**Screenshot:** `26-tablet-month.png`

En la vista mensual de tablet, las celdas de los días 2, 3 y 6 muestran texto truncado: "Distrib...", "Tapice...", "Tapice...". Los nombres de proveedores son demasiado largos para el espacio disponible.

**Propuesta:** Ocultar nombres de proveedores en tablet month view (solo mostrar "5 citas, 31%"), o truncar a las primeras 8 caracteres.

### P2-12. Colores de categoría sin leyenda
**Screenshots:** Todas las vistas con appointment cards

Las appointment cards usan colores de borde izquierdo (verde=Muebles, rosa=Tapicería, azul=Colchonería, naranja=PAE, amarillo=Electro). No hay leyenda visible en la UI que explique qué color corresponde a qué categoría. Un usuario nuevo no puede decodificar los colores sin ver primero una card con el label de categoría.

**Propuesta:** Añadir un botón "Leyenda" o un tooltip en el week header que muestre la paleta de colores y sus categorías.

---

## P3 — Aspiracional (el último 0.5 para el 10/10)

### P3-1. Transiciones animadas entre vistas
Actualmente, cambiar de Semana → Día → Mes es instantáneo (sin animación). Los dashboards premium usan transiciones suaves (fade, slide) de ~200ms para dar sensación de fluidez.

**Propuesta:** `framer-motion` con `AnimatePresence` para fade-in en cambio de vista.

### P3-2. Skeleton loading states
No se observan estados de carga. Si la conexión es lenta, la UI puede parpadear o mostrar un estado vacío antes de cargar datos. Skeleton loaders (shimmer effect) darían una experiencia premium.

### P3-3. Keyboard navigation
No verificable via screenshots, pero la navegación de calendario debería soportar:
- `←` / `→` para día anterior/siguiente
- `T` para ir a "Hoy"
- `W` / `D` / `M` para cambiar de vista
- `N` para abrir "Nueva Cita"

### P3-4. Print-optimized CSS
La vista debería tener `@media print` con:
- Sidebar oculta
- Chat FAB oculto
- Colores optimizados para impresión
- Salto de página entre días/semanas

### P3-5. Micro-interacciones y feedback
- Hover en cards del week: scale(1.02) + shadow elevation
- Click feedback en slots vacíos (ripple o pulse)
- Toast de confirmación al crear/mover cita
- Counter animation en KPIs al cambiar de vista/fecha

---

## Lo que funciona excelentemente (post-V2)

1. **Time-grid semanal** — Alineación temporal perfecta. Sábado con 2 slots de 3h se integra visualmente junto a L-V con 6 slots de 2h.

2. **Colores por categoría** — PAE (naranja), Tapicería (rosa), Colchonería (índigo), Muebles (esmeralda), Electro (amarillo). Identidad visual inmediata.

3. **KPIs en desktop** — 4 métricas clave (Citas, Ocupación, Slot Pico, Disponible) dan contexto completo de un vistazo. El "91% libre" del Disponible es muy útil.

4. **Mobile auto-redirect week → day** — Elimina completamente la experiencia rota de week en 375px. El usuario va directo a la vista optimizada.

5. **Month view en desktop** — Limpia y rica: muestra citas, %, proveedores, y badge "+3 más" solo donde hay datos. Los domingos con "Cerrado" son un buen toque.

6. **Slot overflow con fade + "+N más"** — Visible en `27-wide-week.png`, el slot del lunes muestra las 3 primeras citas + "Materiales Pérez" + fade. Solución elegante.

7. **Detalles por Slot agrupados** — Los progress bars con código de colores (rojo 100%, azul <50%, gris vacío) son informativos y visualmente claros.

8. **Dark mode** — Los colores de categoría resaltan contra el fondo oscuro. El contraste general es bueno. Las barras de progreso se ven premium.

9. **Empty slot design** — "Franja libre — 6 pts disponibles" es mucho mejor que el diseño anterior con "+" gigantes.

10. **dd/MM en headers de semana** — "02/03", "03/03" elimina la ambigüedad cuando la semana cruza meses.

---

## Plan de Acción Recomendado

### Bloque 1: P0 Críticos (1-2 horas)

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| P0-1 | Fix botón "Nueva Cita" en tablet (usar `lg:inline`) | `calendar-page.tsx` | 5 min |
| P0-2 | Indicador "Hoy" en month view (círculo azul) | `slot-calendar.tsx` | 15 min |
| P0-3 | Título corto en mobile ("Dom 01 mar 2026") | `slot-calendar.tsx` | 10 min |
| P0-4 | Padding-bottom para chat FAB | `calendar-page.tsx` o CSS global | 10 min |

### Bloque 2: P1 Importantes (2-3 horas)

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| P1-1 | Fechas españolas en Detalles por Slot | `capacity-indicators.tsx` | 10 min |
| P1-2 | Formato dd/MM en Slot Pico | `capacity-indicators.tsx` | 5 min |
| P1-3 | Sidebar colapsada en tablet (< 1024px) | Layout global / sidebar component | 45 min |
| P1-4 | Colapsar slots vacíos consecutivos en day view | `slot-calendar.tsx` | 30 min |
| P1-5 | Atenuar días fuera del mes actual | `slot-calendar.tsx` | 10 min |
| P1-6 | Compactar "above the fold" en mobile | `calendar-page.tsx` + `slot-calendar.tsx` | 30 min |
| P1-7 | Dots de ocupación más visibles en week headers | `slot-calendar.tsx` | 15 min |
| P1-8 | Capacidad badge inline | `calendar-page.tsx` | 10 min |

### Bloque 3: P2 Pulidos (1-2 horas)

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| P2-1 | Dark mode "Libre" contrast | `slot-calendar.tsx` | 5 min |
| P2-2 | Dark mode KPI card borders | `capacity-indicators.tsx` | 5 min |
| P2-3 | Indicator de franjas en días vacíos del mes | `slot-calendar.tsx` | 15 min |
| P2-4 | Scroll affordance (fade bottom) en week | `slot-calendar.tsx` | 10 min |
| P2-5 | Mobile slot header abreviado | `slot-calendar.tsx` | 10 min |
| P2-6 | Week numbers en month view | `slot-calendar.tsx` | 15 min |
| P2-7 | Wide desktop KPI enhancements | `capacity-indicators.tsx` | 20 min |
| P2-8 | Time label alignment en week | `slot-calendar.tsx` | 10 min |
| P2-9 | "Libre" label centering | `slot-calendar.tsx` | 5 min |
| P2-10 | Empty sunday message más cálido | `slot-calendar.tsx` | 5 min |
| P2-11 | Tablet month provider truncation | `slot-calendar.tsx` | 5 min |
| P2-12 | Leyenda de colores de categoría | Nuevo componente | 20 min |

### Bloque 4: P3 Aspiracional (3-5 horas)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| P3-1 | View transitions con framer-motion | 1-2 horas |
| P3-2 | Skeleton loading states | 30 min |
| P3-3 | Keyboard shortcuts | 45 min |
| P3-4 | Print CSS | 30 min |
| P3-5 | Micro-interactions | 1-2 horas |

---

## Proyección de Puntuación tras implementación

| Vista | Desktop | Dark | Tablet | Mobile | Wide |
|-------|---------|------|--------|--------|------|
| Semana con datos | 10/10 | 9.5/10 | 9/10 | N/A | 10/10 |
| Semana vacía | 9.5/10 | 9/10 | 8.5/10 | N/A | 9.5/10 |
| Día con datos | 10/10 | 9.5/10 | 9.5/10 | 9.5/10 | 10/10 |
| Día vacío | 9.5/10 | 9.5/10 | 9.5/10 | 9/10 | 9.5/10 |
| Mes | 10/10 | 10/10 | 9.5/10 | 9/10 | 10/10 |
| KPIs | 10/10 | 9.5/10 | 9.5/10 | 9.5/10 | 10/10 |

**Media proyectada: 9.6/10** (con P0+P1+P2)
**Media proyectada: 10/10** (con P0+P1+P2+P3)

---

## Capturas de referencia (28)

| # | Archivo | Descripción | Breakpoint |
|---|---------|-------------|------------|
| 01 | `01-desktop-week-empty.png` | Semana vacía (Feb 23-28) | Desktop 1400 |
| 02 | `02-desktop-week-data-viewport.png` | Semana con datos (Mar 2-7) viewport | Desktop 1400 |
| 03 | `03-desktop-week-scrolled.png` | Semana scrolled | Desktop 1400 |
| 04 | `04-desktop-details-expanded.png` | Detalles por Slot expandidos | Desktop 1400 |
| 05 | `05-desktop-day-mar2-viewport.png` | Día domingo sin franjas | Desktop 1400 |
| 06 | `06-desktop-day-mar3-full.png` | Día lunes vacío (6 slots) | Desktop 1400 |
| 07 | `07-desktop-day-mar4-empty.png` | Día martes vacío | Desktop 1400 |
| 08 | `08-desktop-day-sat-full.png` | Día viernes vacío | Desktop 1400 |
| 09 | `09-desktop-day-sunday.png` | Día sábado (2 franjas) | Desktop 1400 |
| 10 | `10-desktop-month-mar.png` | Mes marzo | Desktop 1400 |
| 11 | `11-desktop-month-feb.png` | Mes febrero | Desktop 1400 |
| 12 | `12-desktop-week-today.png` | Semana tras "Hoy" | Desktop 1400 |
| 13 | `13-dark-week-data.png` | Dark mode semana | Dark 1400 |
| 14 | `14-dark-day-full.png` | Dark mode día domingo | Dark 1400 |
| 15 | `15-dark-day-empty.png` | Dark mode día vacío | Dark 1400 |
| 16 | `16-dark-month.png` | Dark mode mes | Dark 1400 |
| 17 | `17-dark-kpis.png` | Dark mode KPIs + mes | Dark 1400 |
| 18 | `18-mobile-day-viewport.png` | Mobile día (auto-redirect) | Mobile 375 |
| 19 | `19-mobile-day-data-viewport.png` | Mobile día con datos | Mobile 375 |
| 20 | `20-mobile-month-viewport.png` | Mobile mes | Mobile 375 |
| 21 | `21-mobile-kpis.png` | Mobile KPIs | Mobile 375 |
| 22 | `22-mobile-day-sunday.png` | Mobile domingo | Mobile 375 |
| 23 | `23-tablet-week-viewport.png` | Tablet semana vacía | Tablet 768 |
| 24 | `24-tablet-week-data.png` | Tablet semana con datos | Tablet 768 |
| 25 | `25-tablet-day.png` | Tablet día domingo | Tablet 768 |
| 26 | `26-tablet-month.png` | Tablet mes | Tablet 768 |
| 27 | `27-wide-week.png` | Wide desktop semana | Wide 1920 |
| 28 | `28-wide-month.png` | Wide desktop mes | Wide 1920 |
