# AUDITORIA DEL CALENDARIO — Informe Completo

**Fecha:** 2026-03-01
**Autor:** Claude (auditoria automatizada)
**Estado:** Solo investigacion, sin cambios de codigo

---

## 1. Configuracion de Franjas (SlotTemplates)

### 1.1 Datos actuales en la base de datos

La base de datos tiene **32 SlotTemplates activos**:

| Dia | dayOfWeek | Franjas | Puntos totales |
|-----|-----------|---------|----------------|
| Lunes | 1 | 08-10 (**4**), 10-12 (6), 12-14 (6), 14-16 (6), 16-18 (6), 18-20 (4) | **32** |
| Martes | 2 | 08-10 (6), 10-12 (6), 12-14 (6), 14-16 (6), 16-18 (6), 18-20 (4) | **34** |
| Miercoles | 3 | 08-10 (6), 10-12 (6), 12-14 (6), 14-16 (6), 16-18 (6), 18-20 (4) | **34** |
| Jueves | 4 | 08-10 (6), 10-12 (6), 12-14 (6), 14-16 (6), 16-18 (6), 18-20 (4) | **34** |
| Viernes | 5 | 08-10 (6), 10-12 (6), 12-14 (6), 14-16 (6), 16-18 (6), 18-20 (4) | **34** |
| Sabado | 6 | 08-11 (4), 11-14 (4) | **8** |
| Domingo | 0 | (ninguna) | **0** |

**Nota:** El Lunes 08:00-10:00 tiene maxPoints=4 en la DB, mientras el seed original define 6. Fue modificado manualmente en algun momento.

### 1.2 Seed original vs DB actual

El seed (`seed-production.cjs`) define:
- L-V: franjas de **2 horas** (08-10, 10-12, 12-14, 14-16, 16-18, 18-20), 6 pts cada una excepto 18-20 (4 pts)
- Sabado: franjas de **3 horas** (08-11, 11-14), 4 pts cada una

**La DB coincide exactamente con el seed**, excepto la modificacion del Lunes 08:00-10:00 (6->4 pts).

### 1.3 SlotOverrides activos

| Fecha | Dia | Franjas afectadas | Nivel | Puntos nuevos |
|-------|-----|-------------------|-------|---------------|
| 2026-02-27 | Viernes | 6 franjas | `slightly_less` (0.75x) | 5,5,5,5,5,3 = 28 |
| 2026-03-18 | Miercoles | 6 franjas | `much_less` (0.50x) | 3,3,3,3,3,2 = 17 |

---

## 2. Diagnostico de Solapamiento — CAUSA RAIZ IDENTIFICADA

### **NO hay solapamiento real en la base de datos**

Las franjas de la DB no se solapan. Son contiguas y correctas:
- **L-V:** 08:00->10:00->12:00->14:00->16:00->18:00->20:00 (bloques de 2h)
- **Sabado:** 08:00->11:00->14:00 (bloques de 3h)

### **El problema visual es un BUG de renderizado en la vista semanal**

**Archivo:** `client/src/components/slot-calendar.tsx`, lineas 202-210

```tsx
const allTimeSlots = useMemo(() => {
    const keys = new Set<string>();
    for (const day of weekData) {
      for (const slot of day.slots) {
        keys.add(`${slot.startTime}-${slot.endTime}`);
      }
    }
    return Array.from(keys).sort();
  }, [weekData]);
```

Este codigo recopila **TODAS las franjas unicas de TODOS los dias de la semana** (Lun-Sab) y crea una fila por cada una. Como el Sabado tiene franjas de 3h y L-V tienen franjas de 2h, el resultado es:

| Fila | Franja | L-V | Sab |
|------|--------|-----|-----|
| 1 | 08:00-10:00 | Datos | Vacio (gris) |
| 2 | **08:00-11:00** | Vacio (gris) | Datos |
| 3 | 10:00-12:00 | Datos | Vacio (gris) |
| 4 | **11:00-14:00** | Vacio (gris) | Datos |
| 5 | 12:00-14:00 | Datos | Vacio (gris) |
| 6 | 14:00-16:00 | Datos | Vacio (gris) |
| 7 | 16:00-18:00 | Datos | Vacio (gris) |
| 8 | 18:00-20:00 | Datos | Vacio (gris) |

Resultado: **8 filas en vez de 6**, con las filas de Sabado (08:00-11:00, 11:00-14:00) creando la ilusion de "franjas solapadas" que empiezan a las 08:00.

---

## 3. Huecos Grises — Explicacion

Los huecos grises son **celdas vacias** donde un dia no tiene una franja que coincida con esa fila.

**Archivo:** `client/src/components/slot-calendar.tsx`, lineas 271-274

```tsx
if (!slot) {
    return <td key={day.date} className="p-1 border-r" />;
}
```

Cuando la vista semanal busca una franja con ese `startTime-endTime` exacto para un dia determinado y no la encuentra, renderiza un `<td>` vacio. Esto ocurre:
- Para L-V en las filas `08:00-11:00` y `11:00-14:00` (que solo existen para Sabado)
- Para Sabado en las filas `08:00-10:00`, `10:00-12:00`, `12:00-14:00`, `14:00-16:00`, `16:00-18:00`, `18:00-20:00` (que solo existen para L-V)

**Evidencia visual:** Ver screenshots `01-default-view.png` y `03-week-mar2-7.png` donde se ven claramente las filas extra con celdas vacias.

---

## 4. KPIs — Diagnostico

### 4.1 Comportamiento actual

**Archivo:** `client/src/pages/calendar-page.tsx`, lineas 37-48

```tsx
const getDateRange = () => {
    if (currentView === "month") {
      return {
        startDate: startOfMonth(currentDate),
        endDate: endOfMonth(currentDate),
      };
    }
    return {
      startDate: startOfWeek(currentDate, { weekStartsOn: 1 }),
      endDate: endOfWeek(currentDate, { weekStartsOn: 1 }),
    };
  };
```

### BUG CONFIRMADO: Los KPIs no son reactivos a la vista diaria

El codigo tiene solo dos ramas:
1. `currentView === "month"` -> rango del mes
2. **Todo lo demas** (incluyendo `"week"` y `"day"`) -> rango de la semana

**Resultado:** En vista diaria, los KPIs muestran datos de la SEMANA COMPLETA, no del dia seleccionado.

### 4.2 Evidencia con screenshots

| Vista | Fecha mostrada | KPIs | Correcto? |
|-------|----------------|------|-----------|
| Semana Feb 23-28 | Lun-Sab | 6 citas, 5.9% | Usa rango Lun-Dom de esa semana |
| Semana Mar 2-7 | Lun-Sab | 8 citas, 8.7%, 18/208 pts | 8 citas correcto para esa semana |
| Dia - Dom 8 Mar | Domingo (0 franjas) | **8 citas, 8.7%, 18/208 pts** | **BUG** - Deberia ser 0 citas, 0% |
| Dia - Lun 9 Mar | Lunes (0 citas ese dia) | 0 citas, 0.0%, 0/208 pts | Semana 9-15 Mar no tiene citas -> resultado "correcto" por casualidad |
| Mes - Marzo 2026 | Todo marzo | 8 citas, 2.3%, 18/787 pts | Mes completo |

### 4.3 Fix necesario

Anadir una rama para `currentView === "day"` en la funcion `getDateRange()`:

```tsx
if (currentView === "day") {
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);
  return { startDate: dayStart, endDate: dayEnd };
}
```

**Archivo a modificar:** `client/src/pages/calendar-page.tsx`, linea 38

---

## 5. Vista Mensual

### 5.1 Informacion actual mostrada

Cada celda del dia muestra:
- Numero del dia
- "X citas"
- "X/Y pts"
- Color de fondo segun % ocupacion (verde/amarillo/rojo)

**Archivo:** `client/src/components/slot-calendar.tsx`, lineas 533-537

### 5.2 Mejoras posibles

La vista mensual es funcional pero basica. Podria enriquecerse con:
- Porcentaje de ocupacion visible (ej: "75%")
- Nombres de proveedores (primeros 2-3, truncados)
- Mini barra de progreso de ocupacion por dia
- Tooltip con desglose de slots al hover
- Distincion entre franjas manana/tarde

### 5.3 Screenshot

Ver `08-month-mar2026.png`: se ve la rejilla mensual con citas y puntos por dia. Los domingos aparecen vacios (correcto). El dia 18 de marzo muestra "0/17 pts" por el override `much_less`.

---

## 6. Citas en la Base de Datos

### 6.1 Listado completo de citas activas (9 citas)

| # | Proveedor | Fecha (UTC) | Hora Madrid aprox | Mercancia | Uds | Tamano | Pts | Min | Muelle |
|---|-----------|-------------|-------------------|-----------|-----|--------|-----|-----|--------|
| 1 | Transportes Garcia | 2026-02-26 | 08:00-09:10 | Sofas | 40 | M | 2 | 70 | M1 |
| 2 | Distribuciones Lopez | 2026-03-02 | 08:00-08:10 | PAE | 15 | S | 1 | 10 | M1 |
| 3 | Colchones del Sur | 2026-03-02 | 08:25-10:35 | Colchones | 60 | L | 3 | 130 | M1 |
| 4 | Muebles Castilla | 2026-03-02 | 10:00-12:50 | Muebles | 120 | L | 3 | 170 | M2 |
| 5 | Electrodomesticos Ruiz | 2026-03-02 | 10:50-12:40 | Electrodom. | 200 | M | 2 | 110 | M1 |
| 6 | Materiales Perez | 2026-03-02 | 12:55-13:25 | Bano | 25 | S | 1 | 30 | M1 |
| 7 | Tapiceria Jaen | 2026-03-03 | 08:00-08:50 | Tapiceria | 15 | M | 2 | 50 | M2 |
| 8 | Jancor | 2026-03-03 | 10:00-13:30 | Colchones | 100 | L | 3 | 210 | M1 |
| 9 | Tapiceria Pedro Ortiz | 2026-03-06 | 08:00-11:00 | Tapiceria | 180 | L | 3 | 180 | M2 |

### 6.2 Distribucion por puntos y slots

- **Lunes 02/Mar:** 5 citas, 10 puntos usados
  - Slot 08:00-10:00: Distribuciones Lopez (1pt) + Colchones del Sur (3pt) = **4/4 pts (LLENO)**
  - Slot 10:00-12:00: Muebles Castilla (3pt) + Electrodomesticos Ruiz (2pt) + Materiales Perez asignada aqui = **6/6 pts (LLENO)**
  - Slot 12:00-14:00: Materiales Perez (1pt) = **1/6 pts**
- **Martes 03/Mar:** 2 citas, 5 puntos usados
  - Slot 08:00-10:00: Tapiceria Jaen (2pt) = **2/6 pts**
  - Slot 10:00-12:00: Jancor (3pt) = **3/6 pts**
- **Viernes 06/Mar:** 1 cita, 3 puntos usados
  - Slot 08:00-10:00: Tapiceria Pedro Ortiz (3pt) = **3/6 pts**

Todas las citas coinciden con lo que muestra el calendario en los screenshots.

---

## 7. Flujo de Datos (Como se alimenta la vista semanal)

### 7.1 Endpoint: `GET /api/slots/week?date=YYYY-MM-DD`

**Archivo:** `server/routes/slots.ts`, lineas 366-483

1. Calcula el Lunes de la semana que contiene la fecha
2. Genera Mon-Sat (6 dias) — **no incluye Domingo**
3. Para cada dia, llama a `slotCapacityValidator.getSlotsForDate(date)`
4. Para cada slot, busca appointments con `slotStartTime === slot.startTime`
5. Devuelve array de `WeekDay[]` con slots y appointments anidados

### 7.2 Resolucion de slots: `SlotCapacityValidator.getSlotsForDate()`

**Archivo:** `server/services/slot-validator.ts`, lineas 440-523

1. Obtiene `dayOfWeek` en timezone Madrid
2. Busca SlotTemplates para ese `dayOfWeek` + `active: true`
3. Busca SlotOverrides para esa fecha
4. Si hay override especifico por slot -> usa sus maxPoints
5. Si hay override de dia completo -> aplica a todos los slots
6. Si no hay override -> usa template original
7. **No fusiona ni filtra solapamientos** — devuelve todos los templates del dia

### 7.3 Frontend: `SlotCalendar -> WeekView`

**Archivo:** `client/src/components/slot-calendar.tsx`, lineas 188-324

1. Recibe `weekData: WeekDay[]` del query
2. Calcula `allTimeSlots` = union de TODOS los slot keys de TODOS los dias (linea 202)
3. Renderiza tabla: una fila por cada timeSlot, una columna por cada dia
4. Para cada celda, busca `day.slots.find(s => s.startTime === start && s.endTime === end)`
5. Si no encuentra -> celda vacia (gris)
6. Si encuentra -> muestra PointsBar + appointments

---

## 8. Recomendaciones Concretas (Prioridad)

### P0 (ALTA) — KPIs no reactivos a vista diaria

- **Archivo:** `client/src/pages/calendar-page.tsx`
- **Lineas:** 37-48 (funcion `getDateRange`)
- **Fix:** Anadir rama `if (currentView === "day")` que devuelva solo el rango del dia seleccionado
- **Impacto:** Bajo riesgo, cambio de ~5 lineas
- **Efecto:** Los KPIs reflejaran correctamente el contexto de la vista

### P1 (MEDIA) — Filas duplicadas por franjas de Sabado

- **Archivo:** `client/src/components/slot-calendar.tsx`
- **Lineas:** 202-210 (calculo de `allTimeSlots`)
- **Fix opciones:**
  - **Opcion A (recomendada):** Separar la columna Sabado. Si las franjas de Sabado son diferentes, mostrarlas solo en su columna y no crear filas extra para L-V. Agrupar por "franja horaria" en lugar de por "key exacto".
  - **Opcion B:** No incluir Sabado en la rejilla semanal si sus franjas son incompatibles; mostrar Sabado como una seccion aparte debajo.
  - **Opcion C:** Normalizar las franjas de Sabado para que sean de 2h (08-10, 10-12, 12-14), igualando L-V. Esto requiere cambiar los SlotTemplates en DB.
- **Impacto:** Medio — afecta la logica de renderizado de la vista semanal
- **Efecto:** Elimina las filas fantasma y los huecos grises

### P2 (MEDIA) — Celdas grises sin informacion

- **Vinculado al P1.** Se resuelve automaticamente al arreglar el solapamiento visual.
- **Alternativa rapida:** Si se quiere un fix parcial sin tocar la logica de agrupacion, se puede ocultar celdas vacias o mostrar un texto como "N/A".
- **Archivo:** `client/src/components/slot-calendar.tsx`, linea 274

### P3 (BAJA) — Vista mensual mejorable

- **Archivo:** `client/src/components/slot-calendar.tsx`, lineas 444-546 (MonthView)
- **Sugerencias:**
  - Anadir porcentaje de ocupacion visible (ej: "75%")
  - Mostrar primeros 1-2 nombres de proveedores
  - Mini barra de progreso de ocupacion por dia
  - Tooltip con desglose de slots al hover

### P4 (BAJA) — Lunes 08:00-10:00 tiene maxPoints=4 (distinto del seed)

- **Verificar** si el cambio fue intencional (reduccion de capacidad)
- Si fue accidental, restaurar a 6 via UI de Capacidad o directamente en la DB

---

## 9. Screenshots

Todos los screenshots se encuentran en:
`/root/eliasortega/test-results/screenshots/calendar-audit/`

| Archivo | Descripcion |
|---------|-------------|
| `01-default-view.png` | Vista semanal por defecto (Feb 23-28). Muestra las filas duplicadas 08:00-11:00 y 11:00-14:00 de Sabado |
| `02-week-view-current.png` | Misma vista tras clic en "Semana" |
| `03-week-mar2-7.png` | Semana Mar 2-7 con 8 citas. Slots llenos (rojo) en Lunes manana. Filas de Sabado vacias visibles |
| `04-week-feb23-28.png` | Semana Feb 23-28. Transportes Garcia visible en Jueves 26. Filas de Sabado con huecos grises |
| `05-day-view-current.png` | Vista diaria (pagina de transicion) |
| `06-day-mon-mar2.png` | Vista diaria Lunes 9 Mar. KPIs: 0 citas, 0/208 pts (semana sin citas) |
| `07-day-sun-mar1.png` | Vista diaria Domingo 8 Mar. **KPIs: 8 citas, 8.7%** a pesar de ser domingo sin franjas -> BUG confirmado |
| `08-month-mar2026.png` | Vista mensual Marzo 2026. Dias con citas marcados, pts/max visible |

---

## 10. Resumen Ejecutivo

| Problema reportado | Diagnostico | Severidad | Fix |
|--------------------|-------------|-----------|-----|
| Franjas duplicadas/solapadas | **No es bug de DB.** La vista semanal mezcla franjas de 2h (L-V) con franjas de 3h (Sab), creando filas extra | Media | Cambiar logica de `allTimeSlots` en `slot-calendar.tsx` |
| Huecos grises vacios | Consecuencia directa del problema anterior. Celdas donde un dia no tiene esa franja | Media | Se resuelve con el fix anterior |
| KPIs no reactivos al dia | **BUG confirmado.** `getDateRange()` no tiene caso para `"day"`, usa siempre rango semanal | Alta | Anadir rama `"day"` en `calendar-page.tsx` |
| Vista mensual basica | Funciona correctamente pero muestra info minima | Baja | Enriquecer `MonthView` con mas datos |
