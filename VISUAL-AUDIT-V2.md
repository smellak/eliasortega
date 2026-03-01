# Auditoría Visual V2 — Calendario Rediseñado

**Fecha:** 2026-03-01
**Autor:** Claude Opus 4.6
**Contexto:** Tras implementar FIX 1 (KPIs reactivos), FIX 2 (eliminar ghost rows), MEJORAs 3-7 (rediseño premium)
**Screenshots:** 23 capturas en `test-results/screenshots/visual-audit-v2/`
**Dispositivos testeados:** Desktop 1400px, Dark mode, Mobile 375px, Tablet 768px

---

## Resumen Ejecutivo

El rediseño mejora significativamente la experiencia visual. El time-grid de la semana, los colores por categoría y los 4 KPIs son mejoras claras. Sin embargo, la auditoría identifica **3 problemas críticos**, **7 mejoras importantes** y **10 pulidos** para alcanzar el nivel "SaaS premium de 200 EUR/mes".

**Puntuación actual por vista:**

| Vista | Desktop | Dark | Tablet | Mobile |
|-------|---------|------|--------|--------|
| Semana con datos | 8.5/10 | 8.5/10 | 6/10 | 5/10 |
| Semana vacía | 6/10 | 6/10 | 5/10 | 4/10 |
| Día con datos | 8/10 | 7.5/10 | 7.5/10 | 7/10 |
| Día vacío | 5.5/10 | 5/10 | 5.5/10 | 5/10 |
| Mes | 8/10 | 8/10 | 6.5/10 | 4.5/10 |
| KPIs | 8.5/10 | 8/10 | 4/10 | 7.5/10 |

---

## P0 — Problemas Críticos (rompen la experiencia)

### P0-1. KPI cards desbordadas en tablet (768px)
**Screenshot:** `22-tablet-week-full.png`, `23-tablet-month-full.png`

En tablet (768px), los 4 KPI cards usan `md:grid-cols-4` que se activa a 768px. El espacio resulta insuficiente:
- "OCUPACIÓN" se corta como "OCUPA"
- "100%" del Slot Pico se muestra como "10" (cortado)
- "DISPONIBLE" aparece como "DISPONI"
- "Esta Semana" se corta como "Esta Seman"
- Los iconos y números se apilan caóticamente

**Causa:** El breakpoint `md` (768px) activa 4 columnas demasiado pronto. Con sidebar visible, el área de contenido es ~450px, dando ~112px por tarjeta.

**Solución propuesta:** Usar `lg:grid-cols-4` (1024px+) en vez de `md:grid-cols-4`, o usar `grid-cols-2 lg:grid-cols-4` para mantener 2x2 en tablet.

---

### P0-2. Botón "Nueva Cita" truncado en mobile
**Screenshot:** `17-mobile-week-full.png`, `18-mobile-week-data-full.png`

El header de acciones muestra el botón "+" con texto "N..." truncado. El botón "Exportar PDF" se muestra como "PDF" (aceptable), pero el CTA principal "Nueva Cita" pierde su label.

**Solución propuesta:** En mobile, el botón debería mostrar solo el icono "+" sin texto, o usar un FAB (floating action button) en la esquina inferior.

---

### P0-3. Vista semanal inutilizable en mobile (375px)
**Screenshot:** `17-mobile-week-full.png`, `18-mobile-week-data-full.png`

El grid semanal tiene `minWidth: 840px`, por lo que en pantalla de 375px solo se ven ~1.5 columnas (Lun parcial + Mar parcial). El usuario debe hacer scroll horizontal para ver los 6 días. Las appointment cards se cortan.

**Solución propuesta:** En mobile (<640px), auto-redirect a vista día o mostrar una versión simplificada tipo lista vertical (un card por día, colapsable).

---

## P1 — Mejoras Importantes (impacto visual significativo)

### P1-1. Semana vacía se ve demasiado "desierta"
**Screenshot:** `01-week-current-full.png`

Cuando una semana tiene pocas citas (ej: Feb 23-28 con solo 1 en jueves), la vista muestra ~36 celdas de slot con solo un icono "+" gris. El resultado visual es un grid grande y vacío que no inspira confianza.

**Propuestas:**
- Reducir la opacidad/tamaño del icono "+" cuando no hay hover
- Añadir un micro-label "Libre" en texto muy tenue en slots vacíos
- Considerar colapsar slots vacíos a menor altura (ej: 40px en vez de 140px) con un expand on hover
- Añadir un pattern sutil (rayas diagonales muy tenues) para diferenciar "slot configurado pero vacío" de "no hay slot"

### P1-2. Vista diaria vacía desperdicia espacio vertical
**Screenshot:** `07-day-mar3-full.png`, `08-day-mar6-full.png`

Cada slot sin citas muestra una card grande (~130px alto) con solo "Sin citas en esta franja" centrado. Con 6 slots, son ~780px de cards vacías. El usuario ve mucho espacio blanco sin valor.

**Propuestas:**
- Slots vacíos compactos (60px) que se expanden al hacer hover o al añadir cita
- Agrupar slots vacíos: "12:00-20:00: 4 franjas libres (24 puntos disponibles)" como un bloque colapsado
- Añadir un CTA más claro: "Haz clic para programar descarga" con icono de camión

### P1-3. Vista mensual: "0 citas" repetido es visualmente ruidoso
**Screenshot:** `11-month-mar-full.png`, `12-month-feb-full.png`

Cada celda del mes sin actividad muestra "0%" y "0 citas". En un mes con solo 3 días activos, se ven ~24 celdas con "0%" y "0 citas" creando ruido visual.

**Propuestas:**
- Ocultar el texto "0 citas" en días sin actividad
- Solo mostrar barra + % cuando hay alguna ocupación (>0%)
- Para días sin actividad, mostrar solo el número del día
- Mantener la info rica solo para días con datos

### P1-4. Vista mensual ilegible en mobile
**Screenshot:** `20-mobile-month-full.png`

En 375px, las 7 columnas del mes dan ~53px por celda. Solo cabe el número del día. Las barras de progreso, "0 citas", y provider names no se ven o se cortan. La experiencia es peor que un calendario básico.

**Propuestas:**
- En mobile, mostrar una lista vertical por semana con cards expandibles
- O usar un diseño de "agenda" (lista de días con info inline)
- Mínimo: ocultar "0 citas" y barras en mobile, solo mostrar numero + color de fondo

### P1-5. Day title capitalización inconsistente
**Screenshot:** `06-day-mar2-full.png`

El título muestra "Domingo 08 De Marzo 2026" — las preposiciones "De" están capitalizadas. Debería ser "domingo 08 de marzo 2026" (minúsculas en español) o "Domingo 08 de Marzo 2026" (capitalizar solo sustantivos).

**Causa:** `format(currentDate, "EEEE dd 'de' MMMM yyyy", { locale: es })` pero date-fns puede capitalizar las primeras letras. El componente añade `capitalize` al contenedor.

**Solución:** Quitar la clase `capitalize` del h2 del título, o aplicar CSS `text-transform: capitalize` solo a la primera letra.

### P1-6. Slot Pico muestra datos confusos cuando no hay actividad
**Screenshot:** `09-day-sunday-no-slots.png`

En domingo (sin slots), el KPI "Slot Pico" muestra "0% 03-14 08:00" — referencia una fecha/hora que no corresponde al día visualizado. Confuso para el usuario.

**Solución:** Cuando `peakSlot.percentage === 0`, mostrar "—" en vez de "0% fecha hora". Ya se maneja `peakSlot === null` pero no el caso `peakSlot.percentage === 0`.

### P1-7. Week view: appointment cards se apilan sin scroll visible
**Screenshot:** `03-week-mar2-full.png`

En la columna del lunes 02, el slot 10:00-12:00 tiene 2 citas (Muebles Castilla + Electrodomésticos Ruiz). Las cards se apilan y la segunda ("Electrodomésticos...") se corta al fondo del slot block. No hay indicador visual de que hay más contenido abajo (scroll invisible).

**Propuestas:**
- Añadir un fade-to-transparent gradient en la parte inferior del slot cuando hay overflow
- O mostrar un badge "+1 más" cuando no caben todas las cards
- O aumentar ligeramente HOUR_PX (de 70 a 80) para dar más espacio

---

## P2 — Pulidos y Refinamientos

### P2-1. Progress bar de ocupación muy tenue en KPIs
**Screenshot:** `01-week-current-full.png`

Con 5.9% de ocupación, la barra de progreso del KPI "Ocupación" apenas se ve — es un pixel azul en una barra gris de 200px. Para porcentajes <10%, la barra es prácticamente invisible.

**Propuesta:** Añadir un ancho mínimo visual (ej: `minWidth: 4px`) para que siempre sea visible.

### P2-2. Dark mode: contraste de bordes de categoría
**Screenshot:** `14-dark-week-full.png`

Los colores de categoría en dark mode se ven bien, pero algunos bordes izquierdos (especialmente `border-l-yellow-500` de Electro) tienen bajo contraste contra el fondo oscuro del card.

**Propuesta:** En dark mode, usar variantes más brillantes para los bordes: `dark:border-l-yellow-400`.

### P2-3. Day headers solo muestran día numérico
**Screenshot:** `03-week-mar2-full.png`

Los headers muestran "LUN 02", "MAR 03", etc. sin el mes. Cuando la semana cruza meses (ej: "28 Feb — 06 Mar"), no queda claro si "02" es febrero o marzo sin mirar el título.

**Propuesta:** Mostrar "02/03" (dd/MM) en vez de solo "02" en los headers de día.

### P2-4. Tooltip/hover feedback en week slots
No se puede verificar via screenshot, pero los slots vacíos tienen `cursor: pointer` y un "+" muy tenue. No hay feedback visible de hover (shadow, border change) en las screenshots.

**Propuesta:** Verificar que el hover state (`hover:shadow-md`) sea suficientemente visible. Considerar `hover:ring-2 ring-primary/30` para slots clickeables.

### P2-5. Chat bubble overlap
**Screenshot:** `20-mobile-month-full.png`

El botón flotante del chat (esquina inferior derecha) se superpone al grid del mes en mobile y tablet. Oculta la columna DOM parcialmente.

**Propuesta:** Esto es del componente de chat externo. Considerar `z-index` o margen inferior en el calendario.

### P2-6. Detalles por Slot: lista muy larga
**Screenshot:** `05-kpi-details-expanded.png`

Expandir "Detalles por Slot" muestra una lista de ~36 slots (6 días x 6 franjas). La lista ocupa toda la pantalla. No hay agrupación ni paginación.

**Propuesta:** Agrupar los slots por día con sub-headers colapsables, o limitar a los top-10 slots más llenos.

### P2-7. Empty state del día: icono decorativo
**Screenshot:** `06-day-mar2-full.png` (domingo sin slots)

El mensaje "No hay franjas configuradas para domingo 08/03/2026" es solo texto en una card. Falta un icono decorativo (calendario con X, o reloj) que suavice la experiencia.

### P2-8. Month view: Sundays y holidays no distinguidos
**Screenshot:** `11-month-mar-full.png`

Los domingos (sin slots) muestran celdas vacías sin ningún indicador. No se distinguen visualmente de los días de la semana anterior/posterior que están fuera del mes (opacity 30%).

**Propuesta:** Añadir "Cerrado" o un icono de luna para domingos/días sin slots configurados.

### P2-9. KPI "Disponible" no muestra contexto de urgencia
**Screenshot:** `03-week-mar2-full.png`

"DISPONIBLE 190 de 208 pts" en verde. Pero 190/208 = 91% libre, que es mucho. El color verde es correcto, pero falta un label como "91% libre" para dar contexto rápido.

### P2-10. Points bar min-width inconsistente
En las cards compactas del week view, la PointsBar tiene `max-w-[80px]`. Cuando el slot tiene valores altos (ej: "10/32"), el texto "10/32" más la barra no caben bien.

**Propuesta:** Ajustar `max-w-[90px]` o usar font más pequeño para los puntos en los headers de día.

---

## Lo que funciona excelentemente

1. **Time-grid semanal** — Elimina completamente los ghost rows. El sábado con 2 slots de 3h se integra perfectamente junto a los 6 slots de 2h de L-V. La alineación temporal es intuitiva.

2. **Colores de categoría** — PAE (naranja), Tapicería (rosa), Colchonería (índigo), Mobiliario (esmeralda), Electro (amarillo). Los bordes izquierdos dan identidad visual inmediata a cada cita.

3. **4 KPI cards en desktop** — Citas + Ocupación + Slot Pico + Disponible dan un dashboard completo de un vistazo. Los labels contextuales ("Esta Semana" / "Hoy" / "Este Mes") son útiles.

4. **Month view enriquecida en desktop** — Mar 2 muestra "5 citas, 31%, Distribuciones López, Colchones del Sur, +3 más". Esto da información accionable sin necesidad de entrar al día.

5. **Dark mode en desktop** — Los colores de categoría resaltan contra el fondo oscuro. Los gradients de progreso se ven premium. Las separaciones visuales son claras.

6. **KPI details expandible** — Los detalles por slot con barras de progreso coloreadas (rojo para 100%, azul para <50%) son informativos.

7. **Day view headers** — Cada franja muestra hora, puntos, % ocupación, y número de muelles activos. La barra de progreso bajo el header es un toque premium.

8. **Mobile KPIs** — El grid 2x2 funciona bien en 375px. Los 4 cards caben sin truncamiento.

---

## Plan de Acción Recomendado (por prioridad)

| # | Tarea | Prioridad | Esfuerzo | Impacto |
|---|-------|-----------|----------|---------|
| 1 | Fix KPI grid breakpoint (P0-1) | P0 | 5 min | Alto |
| 2 | Mobile week → day redirect o simplificación (P0-3) | P0 | 30 min | Alto |
| 3 | Mobile "Nueva Cita" botón icon-only (P0-2) | P0 | 10 min | Medio |
| 4 | Month view: ocultar "0 citas" en días vacíos (P1-3) | P1 | 10 min | Medio |
| 5 | Slot Pico "—" para 0% (P1-6) | P1 | 5 min | Medio |
| 6 | Day title capitalización (P1-5) | P1 | 5 min | Bajo |
| 7 | Week overflow indicator/fade (P1-7) | P1 | 20 min | Medio |
| 8 | Compact empty slots en day view (P1-2) | P1 | 25 min | Medio |
| 9 | Better empty week state (P1-1) | P1 | 20 min | Medio |
| 10 | Mobile month simplification (P1-4) | P1 | 30 min | Medio |
| 11-20 | P2 refinamientos | P2 | 5-15 min c/u | Bajo |

---

## Capturas de referencia

| # | Archivo | Descripción |
|---|---------|-------------|
| 01 | `01-week-current-full.png` | Semana sin datos (Feb 23-28), desktop |
| 02 | `02-week-scrolled-bottom.png` | Semana scrolled (Feb 23-28) |
| 03 | `03-week-mar2-full.png` | Semana con 8 citas (Mar 2-7), desktop |
| 04 | `04-week-mar2-scrolled.png` | Semana Mar 2-7 scrolled |
| 05 | `05-kpi-details-expanded.png` | KPI details expandidos |
| 06 | `06-day-mar2-full.png` | Vista día (domingo, sin slots) |
| 07 | `07-day-mar3-full.png` | Vista día (lunes, sin citas) |
| 08 | `08-day-mar6-full.png` | Vista día (jueves, sin citas) |
| 09 | `09-day-sunday-no-slots.png` | Vista día sábado (2 franjas) |
| 10 | `10-day-saturday.png` | Vista día viernes |
| 11 | `11-month-mar-full.png` | Vista mes marzo, desktop |
| 12 | `12-month-feb-full.png` | Vista mes febrero, desktop |
| 13 | `13-week-today.png` | Semana tras clic "Hoy" |
| 14 | `14-dark-week-full.png` | Dark mode - semana con datos |
| 15 | `15-dark-day-full.png` | Dark mode - vista día |
| 16 | `16-dark-month-full.png` | Dark mode - vista mes |
| 17 | `17-mobile-week-full.png` | Mobile 375px - semana |
| 18 | `18-mobile-week-data-full.png` | Mobile 375px - semana con datos |
| 19 | `19-mobile-day-full.png` | Mobile 375px - vista día |
| 20 | `20-mobile-month-full.png` | Mobile 375px - vista mes |
| 21 | `21-mobile-kpis.png` | Mobile 375px - KPIs close-up |
| 22 | `22-tablet-week-full.png` | Tablet 768px - semana |
| 23 | `23-tablet-month-full.png` | Tablet 768px - vista mes |
