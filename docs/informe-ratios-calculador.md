# Informe completo: Sistema de calculo de tiempos de descarga

> Sistema de Citas CentroHogar Sanchez — Agente Elias Ortega
> Generado: 2026-02-26

---

## Indice

1. [Arquitectura general](#1-arquitectura-general)
2. [Categorias de productos y coeficientes](#2-categorias-de-productos-y-coeficientes)
3. [Formula de calculo](#3-formula-de-calculo)
4. [Ratios de estimacion (datos historicos)](#4-ratios-de-estimacion-datos-historicos)
5. [Normalizacion de categorias (sinonimos)](#5-normalizacion-de-categorias-sinonimos)
6. [Funcion determineSizeAndPoints](#6-funcion-determinesizeandpoints)
7. [Redondeo humanRound](#7-redondeo-humanround)
8. [Parametros que pide el agente al proveedor](#8-parametros-que-pide-el-agente-al-proveedor)
9. [Tool calculator (definicion para el LLM)](#9-tool-calculator-definicion-para-el-llm)
10. [Flujo completo de ejecucion](#10-flujo-completo-de-ejecucion)
11. [Codigo fuente completo del calculador](#11-codigo-fuente-completo-del-calculador)
12. [Codigo fuente completo de estimation-ratios](#12-codigo-fuente-completo-de-estimation-ratios)
13. [Prompt del subagente calculador (LLM fallback)](#13-prompt-del-subagente-calculador-llm-fallback)
14. [Ejemplos de calculo paso a paso](#14-ejemplos-de-calculo-paso-a-paso)

---

## 1. Arquitectura general

El sistema de calculo de tiempos tiene tres capas:

```
Proveedor (chat)
    |
    v
Orquestador (Claude Sonnet 4.6)
    |-- tool: calculator         --> calculo deterministico de tiempo
    |-- tool: calendar_availability --> busqueda de franjas libres
    |-- tool: calendar_book      --> reserva de cita con asignacion de muelle
    |
    v
slot-validator.ts  --> determineSizeAndPoints() --> S/M/L + puntos
```

**Archivos clave:**

| Archivo | Responsabilidad |
|---------|----------------|
| `server/agent/calculator.ts` | Calculo deterministico de tiempos (201 lineas) |
| `server/config/estimation-ratios.ts` | Ratios historicos para estimar lineas/albaranes (71 lineas) |
| `server/agent/tools.ts` | Definicion de tools + ejecucion (546 lineas) |
| `server/agent/orchestrator.ts` | Bucle de conversacion con el LLM (187 lineas) |
| `server/agent/prompts.ts` | System prompts del agente y subagente |
| `server/services/slot-validator.ts` | Validacion de capacidad, talla y muelles |

---

## 2. Categorias de productos y coeficientes

El sistema reconoce **8 categorias canonicas**, cada una con 4 coeficientes de tiempo en minutos:

| Categoria | TD (base) | TA (por albaran) | TL (por linea) | TU (por unidad) |
|-----------|-----------|-------------------|-----------------|-------------------|
| **Asientos** | 48.88 | 5.49 | 0.00 | 1.06 |
| **Bano** | 3.11 | 11.29 | 0.61 | 0.00 |
| **Cocina** | 10.67 | 0.00 | 4.95 | 0.04 |
| **Colchoneria** | 14.83 | 0.00 | 4.95 | 0.12 |
| **Electro** | 33.49 | 0.81 | 0.00 | 0.31 |
| **Mobiliario** | 23.20 | 0.00 | 2.54 | 0.25 |
| **PAE** | 6.67 | 8.33 | 0.00 | 0.00 |
| **Tapiceria** | 34.74 | 0.00 | 2.25 | 0.10 |

**Significado de los coeficientes:**
- **TD** — Tiempo base fijo (se aplica solo si hay al menos 1 unidad). Representa el coste de arranque de la descarga (posicionar camion, abrir muelle, etc.)
- **TA** — Minutos por cada albaran de entrega
- **TL** — Minutos por cada linea/referencia diferente
- **TU** — Minutos por cada unidad/bulto individual

**Fuente de datos:** Analisis de consultor externo sobre datos reales de descargas de marzo-mayo 2025, archivo `Tiempos_medios_descargas_CHS.xlsx`.

---

## 3. Formula de calculo

### Caso especial: Asientos

```
Tiempo_raw = (U * TU) + (A * TA) + (L * TL)
```

No se aplica TD porque la categoria Asientos tiene un comportamiento distinto: el tiempo base ya esta absorbido en el coeficiente TU alto (1.06 min/unidad).

### Resto de categorias

```
Tiempo_raw = (U == 0 ? 0 : TD) + (U * TU) + (A * TA) + (L * TL)
```

Donde:
- **U** = unidades (proporcionadas por el proveedor)
- **A** = albaranes (proporcionados o estimados)
- **L** = lineas/referencias (proporcionadas o estimadas)
- Si U = 0, no se aplica TD (no hay descarga)

El resultado `Tiempo_raw` pasa por `humanRound()` para obtener el tiempo final.

### En codigo (calculator.ts, lineas 128-133):

```typescript
let rawMinutes: number;
if (category === "Asientos") {
  rawMinutes = (U * coeff.TU) + (A * coeff.TA) + (L * coeff.TL);
} else {
  rawMinutes = (U === 0 ? 0 : coeff.TD) + (U * coeff.TU) + (A * coeff.TA) + (L * coeff.TL);
}
```

---

## 4. Ratios de estimacion (datos historicos)

Cuando el proveedor no conoce las lineas y/o albaranes de su entrega, el sistema los estima automaticamente usando ratios historicos:

| Categoria | linesPerUnit | defaultDeliveryNotes | sampleSize | R² |
|-----------|-------------|---------------------|-----------|-----|
| **Asientos** | 0.149 | 4 | 21 | 0.65 |
| **Bano** | 0.889 | 1 | 4 | 0.94 |
| **Cocina** | 0.119 | 2 | 10 | 0.97 |
| **Colchoneria** | 0.369 | 3 | 44 | 0.86 |
| **Electro** | 0.617 | 34 | 40 | 0.47 |
| **Mobiliario** | 0.370 | 4 | 108 | 0.79 |
| **PAE** | 0.002 | 2 | 6 | 0.89 |
| **Tapiceria** | 0.467 | 6 | 60 | 0.65 |

**Formulas de estimacion:**

```
lineas_estimadas = max(1, round(unidades * linesPerUnit))
albaranes_estimados = defaultDeliveryNotes  (constante por categoria)
```

**Fallback generico** (si la categoria no se reconoce):
```
lineas = max(1, round(unidades * 0.3))
albaranes = 1
```

**Notas:**
- `sampleSize` = numero de entregas analizadas del historico para obtener el ratio
- `R²` = coeficiente de correlacion del modelo lineal del consultor
- Electro tiene R²=0.47 (correlacion baja), lo que significa que sus estimaciones son menos fiables
- Cocina tiene R²=0.97 (correlacion altisima), estimaciones muy fiables
- Electro tiene 34 albaranes por defecto porque las entregas de electrodomesticos suelen venir con muchos documentos

---

## 5. Normalizacion de categorias (sinonimos)

El sistema acepta variaciones del nombre de categoria que los proveedores pueden usar en el chat. Se normalizan a las 8 categorias canonicas:

### Sinonimos en calculator.ts

```typescript
const CATEGORY_SYNONYMS: Record<string, string> = {
  "asientos": "Asientos",
  "sillas": "Asientos",
  "asiento": "Asientos",
  "silla": "Asientos",
  "bano": "Bano",
  "sanitarios": "Bano",
  "sanitario": "Bano",
  "cocina": "Cocina",
  "encimeras": "Cocina",
  "encimera": "Cocina",
  "colchoneria": "Colchoneria",
  "colchon": "Colchoneria",
  "colchones": "Colchoneria",
  "descanso": "Colchoneria",
  "electro": "Electro",
  "electrodomesticos": "Electro",
  "electrodomestico": "Electro",
  "mobiliario": "Mobiliario",
  "canape": "Mobiliario",
  "canapes": "Mobiliario",
  "bases": "Mobiliario",
  "estructuras": "Mobiliario",
  "muebles": "Mobiliario",
  "mueble": "Mobiliario",
  "pae": "PAE",
  "pequeno electro": "PAE",
  "tapiceria": "Tapiceria",
  "sofa": "Tapiceria",
  "sofas": "Tapiceria",
  "sillones": "Tapiceria",
  "sillon": "Tapiceria",
};
```

### Sinonimos adicionales en estimation-ratios.ts

```typescript
const CATEGORY_ALIASES: Record<string, string> = {
  "cocinas": "Cocina",
  "electros": "Electro",
  "pequeno aparato electronico": "PAE",
};
```

### Logica de normalizacion (prioridad):

1. Match exacto por nombre canonico (case-sensitive)
2. Match case-insensitive contra nombres canonicos
3. Match exacto contra sinonimos
4. Match parcial (substring) contra sinonimos
5. Fallback a normalizer de estimation-ratios.ts
6. Si nada funciona: LLM fallback (subagente calculador)

---

## 6. Funcion determineSizeAndPoints

Convierte la duracion en minutos a una talla (S/M/L) y puntos de capacidad para la gestion de franjas.

### En codigo (slot-validator.ts, lineas 118-139):

```typescript
determineSizeFromDuration(durationMin: number): "S" | "M" | "L" {
  if (durationMin <= 30) return "S";
  if (durationMin <= 120) return "M";
  return "L";
}

getPointsForSize(size: "S" | "M" | "L"): number {
  switch (size) {
    case "S": return 1;
    case "M": return 2;
    case "L": return 3;
  }
}

determineSizeAndPoints(durationMin: number): { size: "S" | "M" | "L"; points: number } {
  const size = this.determineSizeFromDuration(durationMin);
  const points = this.getPointsForSize(size);
  return { size, points };
}
```

### Tabla resumen

| Talla | Duracion | Puntos | Descripcion |
|-------|----------|--------|-------------|
| **S** | 0-30 min | 1 | Entregas rapidas: PAE, lotes pequenos |
| **M** | 31-120 min | 2 | Cargas medianas: electro mediano, mobiliario pequeno |
| **L** | >120 min | 3 | Cargas grandes: cocinas, colchoneria masiva, tapiceria |

### Donde se usa

- `tools.ts: executeCalendarAvailability()` — para buscar franjas con puntos suficientes
- `tools.ts: executeCalendarBook()` — para validar y reservar con los puntos correctos
- `server/routes/appointments.ts` — para creacion de citas via API REST
- `server/helpers/appointment-helpers.ts` — para citas manuales del admin
- `server/agent/admin-tools.ts` — para citas creadas por el agente admin

---

## 7. Redondeo humanRound

Convierte los minutos crudos del calculo en valores "amigables" para el proveedor:

```typescript
function humanRound(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 15;               // Minimo 15 min
  if (minutes <= 44) return Math.floor(minutes / 10) * 10;  // Multiplos de 10 hacia abajo
  if (minutes <= 94) return Math.round(minutes / 5) * 5;    // Multiplos de 5 al mas cercano
  return Math.ceil(minutes / 10) * 10;                       // Multiplos de 10 hacia arriba
}
```

### Ejemplos de redondeo

| Raw (min) | Redondeado | Regla |
|-----------|-----------|-------|
| 3 | 15 | Minimo 15 min |
| 12 | 15 | Minimo 15 min |
| 23 | 20 | Multiplo de 10 abajo |
| 37 | 30 | Multiplo de 10 abajo |
| 43 | 40 | Multiplo de 10 abajo |
| 52 | 50 | Multiplo de 5 mas cercano |
| 78 | 80 | Multiplo de 5 mas cercano |
| 93 | 95 | Multiplo de 5 mas cercano |
| 96 | 100 | Multiplo de 10 arriba |
| 143 | 150 | Multiplo de 10 arriba |
| 209.98 | 210 | Multiplo de 10 arriba |

---

## 8. Parametros que pide el agente al proveedor

El agente Elias sigue este flujo de conversacion definido en su system prompt:

### Datos obligatorios

| # | Parametro | Pregunta del agente | Tipo |
|---|-----------|-------------------|------|
| 1 | **providerName** | "¿De que empresa eres?" | string |
| 2 | **goodsType** | "¿Que tipo de mercancia traes?" | string (normalizado a 8 categorias) |
| 3 | **units** | "¿Cuantas unidades mas o menos?" | number |

### Datos opcionales (se estiman si no se dan)

| # | Parametro | Pregunta del agente | Estimacion si no se da |
|---|-----------|-------------------|----------------------|
| 4 | **albaranes** | "¿Sabes cuantos albaranes traes?" | `defaultDeliveryNotes` de la categoria |
| 5 | **lines** | "¿Y cuantas lineas/referencias?" | `max(1, round(units * linesPerUnit))` |
| 6 | **providerEmail** | "¿Tienes un email para la confirmacion?" | No se estima, es opcional |
| 7 | **providerPhone** | "¿Un telefono de contacto?" | No se estima, es opcional |

### Comportamiento del agente

- Si el proveedor no sabe lineas/albaranes, el agente dice: "vale, lo calculo yo con datos de cargas parecidas" y sigue sin insistir
- Si no da email, dice "vale, sin problema" y sigue
- Nunca pregunta la fecha antes de calcular el tiempo
- Rechaza domingos y fechas pasadas
- Nunca menciona puntos, tallas (S/M/L) ni detalles tecnicos al proveedor

---

## 9. Tool calculator (definicion para el LLM)

Esta es la definicion exacta de la tool que recibe el modelo LLM:

```typescript
const CALCULATOR_TOOL: Anthropic.Tool = {
  name: "calculator",
  description: "Calcula el tiempo estimado de descarga basandose en el tipo de mercancia y unidades. "
    + "Lineas y albaranes son opcionales: si no se proporcionan, se estiman con datos historicos. "
    + "Usa esta herramienta antes de buscar disponibilidad o reservar.",
  input_schema: {
    type: "object",
    properties: {
      providerName: {
        type: "string",
        description: "Nombre de la empresa/proveedor (opcional para el calculo)",
      },
      goodsType: {
        type: "string",
        description: "Tipo de mercancia (ej: 'Colchones', 'Sofas', 'Electrodomesticos', "
          + "'Muebles', 'Asientos', 'Bano', 'Cocina', 'PAE')",
      },
      units: {
        type: "number",
        description: "Numero de unidades/bultos a descargar",
      },
      lines: {
        type: "number",
        description: "Numero de lineas/referencias diferentes "
          + "(opcional — se estima si no se proporciona)",
      },
      albaranes: {
        type: "number",
        description: "Numero de albaranes/documentos de entrega "
          + "(opcional — se estima si no se proporciona)",
      },
    },
    required: ["goodsType", "units"],
  },
};
```

### Salida del calculator

```json
{
  "categoria_elegida": "Colchoneria",
  "work_minutes_needed": 210,
  "duration_min": 210,
  "estimatedFields": ["lines", "deliveryNotes"],
  "usedLines": 37,
  "usedAlbaranes": 3,
  "note": "Nota: se han estimado lines y deliveryNotes a partir de datos historicos de Colchoneria."
}
```

### Cache

Los resultados se cachean 10 minutos con clave `JSON({goodsType, units, lines, albaranes})` para evitar llamadas redundantes cuando el agente invoca el calculator multiples veces en la misma conversacion.

---

## 10. Flujo completo de ejecucion

### Paso a paso

```
1. Proveedor escribe: "Hola, traigo 100 colchones"
                |
2. Orquestador (Claude Sonnet 4.6) recibe mensaje + historial + tools
                |
3. LLM decide llamar: calculator(goodsType="colchones", units=100)
                |
4. executeToolCall("calculator", {...})
   |-- Comprueba cache (miss en primera llamada)
   |-- Llama runCalculator(input)
       |-- calculateDeterministic(input)
           |-- normalizeCategory("colchones") -> "Colchoneria"
           |-- L = estimateLines("Colchoneria", 100)
           |   = max(1, round(100 * 0.369)) = 37
           |-- A = estimateDeliveryNotes("Colchoneria") = 3
           |-- rawMinutes = 14.83 + (100*0.12) + (3*0.00) + (37*4.95)
           |   = 14.83 + 12.00 + 0.00 + 183.15 = 209.98
           |-- humanRound(209.98) = 210
           |-- return { categoria: "Colchoneria", work_minutes: 210, ... }
   |-- Cachea resultado (TTL 10 min)
   |-- Devuelve JSON al LLM
                |
5. LLM responde: "Te va a llevar unas 3 horas y media. ¿Que dia te viene bien?"
                |
6. Proveedor: "El jueves si puede ser"
                |
7. LLM decide llamar: calendar_availability(from=jueves, to=+7dias, duration=210)
   |-- determineSizeAndPoints(210) -> size="L", points=3
   |-- findAvailableSlots(from, to, 3)
   |-- Devuelve franjas con >= 3 puntos libres
                |
8. LLM ofrece opciones: "El jueves tengo hueco a las 8:00 y a las 10:00"
                |
9. Proveedor: "A las 10 perfecto"
                |
10. LLM confirma: "Entonces el jueves a las 10:00, ¿te lo reservo?"
    Proveedor: "Si"
                |
11. LLM llama: calendar_book(start="jueves 10:00", end="jueves 13:30", ...)
    |-- Valida capacidad del slot (puntos + muelle fisico)
    |-- Crea/actualiza proveedor en BD
    |-- Asigna muelle automaticamente (M1, M2 o M3)
    |-- Crea appointment con size="L", pointsUsed=3
    |-- Envia email de confirmacion (si hay email)
    |-- Registra auditoria
    |-- Devuelve confirmacion con horaRealInicio
                |
12. LLM lee horaRealInicio del resultado
    Si AVISO_HORA_CAMBIADA: informa la hora real al proveedor
    Si no: confirma "Listo, cita el jueves de 10:00 a 13:30"
```

### Reintentos en reserva

Si el slot solicitado esta lleno al intentar reservar:
1. Busca el siguiente slot disponible (hasta 7 dias adelante)
2. Reintenta hasta 3 veces con slots alternativos
3. Si todos fallan: devuelve error "No hay disponibilidad"

### Deteccion de desplazamiento horario

Si el muelle asignado requiere desplazar la hora de inicio mas de 5 minutos respecto a lo solicitado, se genera un `AVISO_HORA_CAMBIADA` para que el agente informe al proveedor de la hora real.

---

## 11. Codigo fuente completo del calculador

**Archivo: `server/agent/calculator.ts`** (201 lineas)

```typescript
import { anthropic } from "./llm-clients";
import { CALCULATOR_AGENT_SYSTEM_PROMPT } from "./prompts";
import { z } from "zod";
import {
  normalizeCategory as normalizeCategoryFromRatios,
  estimateLines,
  estimateDeliveryNotes,
} from "../config/estimation-ratios";

const calculatorInputSchema = z.object({
  providerName: z.string().optional(),
  goodsType: z.string(),
  units: z.number().int().min(0),
  lines: z.number().int().min(0).optional().nullable(),
  albaranes: z.number().int().min(0).optional().nullable(),
});

const calculatorOutputSchema = z.object({
  categoria_elegida: z.string(),
  work_minutes_needed: z.number().int().min(0),
  duration_min: z.number().int().min(0),
});

export type CalculatorInput = z.infer<typeof calculatorInputSchema>;

export interface CalculatorOutput {
  categoria_elegida: string;
  work_minutes_needed: number;
  duration_min: number;
  estimatedFields?: string[];
  usedLines: number;
  usedAlbaranes: number;
}

interface CategoryCoefficients {
  TD: number;
  TA: number;
  TL: number;
  TU: number;
}

const CATEGORIES: Record<string, CategoryCoefficients> = {
  "Asientos":     { TD: 48.88, TA: 5.49,  TL: 0.00, TU: 1.06 },
  "Baño":         { TD: 3.11,  TA: 11.29, TL: 0.61, TU: 0.00 },
  "Cocina":       { TD: 10.67, TA: 0.00,  TL: 4.95, TU: 0.04 },
  "Colchonería":  { TD: 14.83, TA: 0.00,  TL: 4.95, TU: 0.12 },
  "Electro":      { TD: 33.49, TA: 0.81,  TL: 0.00, TU: 0.31 },
  "Mobiliario":   { TD: 23.20, TA: 0.00,  TL: 2.54, TU: 0.25 },
  "PAE":          { TD: 6.67,  TA: 8.33,  TL: 0.00, TU: 0.00 },
  "Tapicería":    { TD: 34.74, TA: 0.00,  TL: 2.25, TU: 0.10 },
};

const CATEGORY_SYNONYMS: Record<string, string> = {
  "asientos": "Asientos", "sillas": "Asientos", "asiento": "Asientos",
  "silla": "Asientos",
  "baño": "Baño", "bano": "Baño", "sanitarios": "Baño",
  "sanitario": "Baño",
  "cocina": "Cocina", "encimeras": "Cocina", "encimera": "Cocina",
  "colchonería": "Colchonería", "colchoneria": "Colchonería",
  "colchon": "Colchonería", "colchones": "Colchonería",
  "descanso": "Colchonería", "colchón": "Colchonería",
  "electro": "Electro", "electrodomesticos": "Electro",
  "electrodomésticos": "Electro", "electrodomestico": "Electro",
  "electrodoméstico": "Electro",
  "mobiliario": "Mobiliario", "canape": "Mobiliario",
  "canapé": "Mobiliario", "canapes": "Mobiliario",
  "canapés": "Mobiliario", "bases": "Mobiliario",
  "estructuras": "Mobiliario", "muebles": "Mobiliario",
  "mueble": "Mobiliario",
  "pae": "PAE", "pequeño electro": "PAE",
  "pequenio electro": "PAE", "pequeño electrodoméstico": "PAE",
  "tapicería": "Tapicería", "tapiceria": "Tapicería",
  "sofa": "Tapicería", "sofá": "Tapicería", "sofas": "Tapicería",
  "sofás": "Tapicería", "sillones": "Tapicería",
  "sillon": "Tapicería", "sillón": "Tapicería",
};

function normalizeCategory(goodsType: string): string | null {
  const lower = goodsType.toLowerCase().trim();

  if (CATEGORIES[goodsType]) return goodsType;

  for (const cat of Object.keys(CATEGORIES)) {
    if (cat.toLowerCase() === lower) return cat;
  }

  if (CATEGORY_SYNONYMS[lower]) return CATEGORY_SYNONYMS[lower];

  for (const [synonym, category] of Object.entries(CATEGORY_SYNONYMS)) {
    if (lower.includes(synonym) || synonym.includes(lower)) {
      return category;
    }
  }

  // Fallback to estimation-ratios normalizer
  return normalizeCategoryFromRatios(goodsType);
}

function humanRound(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 15;
  if (minutes <= 44) return Math.floor(minutes / 10) * 10;
  if (minutes <= 94) return Math.round(minutes / 5) * 5;
  return Math.ceil(minutes / 10) * 10;
}

function calculateDeterministic(input: CalculatorInput): CalculatorOutput | null {
  const category = normalizeCategory(input.goodsType);
  if (!category) return null;

  const coeff = CATEGORIES[category];
  const U = Math.max(0, input.units);
  const estimatedFields: string[] = [];

  // Resolve lines — use provided value or estimate
  let L: number;
  if (input.lines != null && input.lines >= 0) {
    L = input.lines;
  } else {
    L = estimateLines(category, U);
    estimatedFields.push("lines");
  }

  // Resolve albaranes — use provided value or estimate
  let A: number;
  if (input.albaranes != null && input.albaranes >= 0) {
    A = input.albaranes;
  } else {
    A = estimateDeliveryNotes(category);
    estimatedFields.push("deliveryNotes");
  }

  let rawMinutes: number;
  if (category === "Asientos") {
    rawMinutes = (U * coeff.TU) + (A * coeff.TA) + (L * coeff.TL);
  } else {
    rawMinutes = (U === 0 ? 0 : coeff.TD) + (U * coeff.TU) + (A * coeff.TA) + (L * coeff.TL);
  }

  const workMinutes = humanRound(rawMinutes);

  return {
    categoria_elegida: category,
    work_minutes_needed: workMinutes,
    duration_min: workMinutes,
    estimatedFields: estimatedFields.length > 0 ? estimatedFields : undefined,
    usedLines: L,
    usedAlbaranes: A,
  };
}

const CALCULATOR_MODEL = process.env.CALCULATOR_MODEL || "claude-haiku-4-5-20251001";

export async function runCalculator(input: CalculatorInput): Promise<CalculatorOutput> {
  const deterministicResult = calculateDeterministic(input);
  if (deterministicResult) {
    return deterministicResult;
  }

  // LLM fallback for unknown categories
  const estimatedFields: string[] = [];
  const filledInput = { ...input };
  if (filledInput.lines == null) {
    filledInput.lines = Math.max(1, Math.round(input.units * 0.3));
    estimatedFields.push("lines");
  }
  if (filledInput.albaranes == null) {
    filledInput.albaranes = 1;
    estimatedFields.push("deliveryNotes");
  }

  try {
    const response = await anthropic.messages.create({
      model: CALCULATOR_MODEL,
      max_tokens: 500,
      top_k: 1,
      system: CALCULATOR_AGENT_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: JSON.stringify(filledInput) },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text")
      throw new Error("No response from calculator agent");

    const parsed = JSON.parse(textBlock.text);
    const base = calculatorOutputSchema.parse(parsed);
    return {
      ...base,
      estimatedFields: estimatedFields.length > 0 ? estimatedFields : undefined,
      usedLines: filledInput.lines!,
      usedAlbaranes: filledInput.albaranes!,
    };
  } catch (error) {
    console.error("Calculator LLM fallback error:", error);
    return {
      categoria_elegida: "General",
      work_minutes_needed: 90,
      duration_min: 90,
      estimatedFields: estimatedFields.length > 0 ? estimatedFields : undefined,
      usedLines: filledInput.lines!,
      usedAlbaranes: filledInput.albaranes!,
    };
  }
}
```

---

## 12. Codigo fuente completo de estimation-ratios

**Archivo: `server/config/estimation-ratios.ts`** (71 lineas)

```typescript
// Ratios de estimacion calculados de datos historicos reales (mar-may 2025)
// Fuente: Tiempos_medios_descargas_CHS.xlsx del consultor
// Se usan cuando el proveedor no sabe lineas y/o albaranes

export interface CategoryRatio {
  linesPerUnit: number;        // lineas = unidades * este ratio
  defaultDeliveryNotes: number; // albaranes por defecto (mediana historica)
  sampleSize: number;           // numero de muestras del historico
  correlation: number;          // R del modelo del consultor para esta categoria
}

export const ESTIMATION_RATIOS: Record<string, CategoryRatio> = {
  "Asientos":     { linesPerUnit: 0.149, defaultDeliveryNotes: 4,
                    sampleSize: 21,  correlation: 0.65 },
  "Baño":         { linesPerUnit: 0.889, defaultDeliveryNotes: 1,
                    sampleSize: 4,   correlation: 0.94 },
  "Cocina":       { linesPerUnit: 0.119, defaultDeliveryNotes: 2,
                    sampleSize: 10,  correlation: 0.97 },
  "Colchonería":  { linesPerUnit: 0.369, defaultDeliveryNotes: 3,
                    sampleSize: 44,  correlation: 0.86 },
  "Electro":      { linesPerUnit: 0.617, defaultDeliveryNotes: 34,
                    sampleSize: 40,  correlation: 0.47 },
  "Mobiliario":   { linesPerUnit: 0.370, defaultDeliveryNotes: 4,
                    sampleSize: 108, correlation: 0.79 },
  "PAE":          { linesPerUnit: 0.002, defaultDeliveryNotes: 2,
                    sampleSize: 6,   correlation: 0.89 },
  "Tapicería":    { linesPerUnit: 0.467, defaultDeliveryNotes: 6,
                    sampleSize: 60,  correlation: 0.65 },
};

// Alias para variantes de nombre que pueden venir del chat
export const CATEGORY_ALIASES: Record<string, string> = {
  "asientos": "Asientos",
  "baño": "Baño",
  "bano": "Baño",
  "cocina": "Cocina",
  "cocinas": "Cocina",
  "colchonería": "Colchonería",
  "colchoneria": "Colchonería",
  "colchones": "Colchonería",
  "electro": "Electro",
  "electrodomésticos": "Electro",
  "electrodomesticos": "Electro",
  "electros": "Electro",
  "mobiliario": "Mobiliario",
  "muebles": "Mobiliario",
  "pae": "PAE",
  "pequeño aparato electrónico": "PAE",
  "tapicería": "Tapicería",
  "tapiceria": "Tapicería",
  "sofás": "Tapicería",
  "sofas": "Tapicería",
};

export function normalizeCategory(input: string): string | null {
  const lower = input.toLowerCase().trim();
  if (ESTIMATION_RATIOS[input]) return input;
  if (CATEGORY_ALIASES[lower]) return CATEGORY_ALIASES[lower];
  for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) return canonical;
  }
  return null;
}

export function estimateLines(category: string, units: number): number {
  const ratio = ESTIMATION_RATIOS[category];
  if (!ratio) return Math.max(1, Math.round(units * 0.3));
  return Math.max(1, Math.round(units * ratio.linesPerUnit));
}

export function estimateDeliveryNotes(category: string): number {
  const ratio = ESTIMATION_RATIOS[category];
  if (!ratio) return 1;
  return ratio.defaultDeliveryNotes;
}
```

---

## 13. Prompt del subagente calculador (LLM fallback)

Solo se usa cuando la categoria NO se reconoce por el metodo deterministico. En ese caso se invoca Claude Haiku como fallback:

```
Rol: Subagente de calculo de tiempos de descarga.
Recibes un JSON y devuelves SOLO un JSON con 3 campos.

Entrada (JSON en texto):
{
  "goodsType": "Colchoneria",
  "units": 100,
  "albaranes": 2,
  "lines": 5
}

Si falta un campo o no es numero, devuelve:
{"categoria_elegida":"", "work_minutes_needed":0, "duration_min":0}

Categorias validas (mapear sinonimos):
- Asientos (sillas), Bano (sanitarios), Cocina (encimeras),
  Colchoneria (colchones, descanso)
- Electro (electrodomesticos), Mobiliario (canapes, bases,
  estructuras, muebles)
- PAE (pequeno electro), Tapiceria (sofas, sillones)

Coeficientes de tiempo (minutos):
| Tipo         | TD    | TA    | TL    | TU    |
|--------------|-------|-------|-------|-------|
| Asientos     | 48.88 | 5.49  | 0.00  | 1.06  |
| Bano         | 3.11  | 11.29 | 0.61  | 0.00  |
| Cocina       | 10.67 | 0.00  | 4.95  | 0.04  |
| Colchoneria  | 14.83 | 0.00  | 4.95  | 0.12  |
| Electro      | 33.49 | 0.81  | 0.00  | 0.31  |
| Mobiliario   | 23.20 | 0.00  | 2.54  | 0.25  |
| PAE          | 6.67  | 8.33  | 0.00  | 0.00  |
| Tapiceria    | 34.74 | 0.00  | 2.25  | 0.10  |

Formula (U=units, A=albaranes, L=lines):
- Asientos: Tiempo = (U * TU) + (A * TA) + (L * TL) — NO usar TD
- Resto: Tiempo = (U == 0 ? 0 : TD) + (U * TU) + (A * TA) + (L * TL)

Redondeo:
- 0-44 min: multiplo de 10 abajo (43->40)
- 45-94 min: multiplo de 5 mas cercano (79->80)
- >=95 min: multiplo de 10 arriba (96->100)

work_minutes_needed = tiempo redondeado
duration_min = work_minutes_needed

Salida (JSON-ONLY, sin texto ni markdown):
{"categoria_elegida":"<categoria>", "work_minutes_needed":<entero>, "duration_min":<entero>}

Ejemplo:
Entrada: {"goodsType":"colchones","units":100,"albaranes":2,"lines":5}
Calculo: 14.83 + (100*0.12) + (2*0.00) + (5*4.95) = 51.58 -> 50
Salida: {"categoria_elegida":"Colchoneria","work_minutes_needed":50,"duration_min":50}
```

**Modelo usado:** `claude-haiku-4-5-20251001` (configurable via `CALCULATOR_MODEL` env var)

**Fallback del fallback:** Si el LLM tambien falla, se devuelve un valor por defecto de 90 minutos con categoria "General".

---

## 14. Ejemplos de calculo paso a paso

### Ejemplo 1: 50 sofas (sin datos de lineas ni albaranes)

```
Categoria: "sofas" -> normalizeCategory -> "Tapiceria"
Coeficientes: TD=34.74, TA=0.00, TL=2.25, TU=0.10

Estimaciones:
  L = max(1, round(50 * 0.467)) = max(1, 23) = 23 lineas
  A = 6 albaranes

Formula (no es Asientos):
  raw = TD + (U*TU) + (A*TA) + (L*TL)
  raw = 34.74 + (50*0.10) + (6*0.00) + (23*2.25)
  raw = 34.74 + 5.00 + 0.00 + 51.75
  raw = 91.49

humanRound(91.49): 91.49 esta en rango 45-94 -> round(91.49/5)*5 = round(18.298)*5 = 18*5 = 90

Resultado: 90 minutos -> Size M (2 puntos)
```

### Ejemplo 2: 200 electrodomesticos con 10 albaranes y 80 lineas

```
Categoria: "electrodomesticos" -> normalizeCategory -> "Electro"
Coeficientes: TD=33.49, TA=0.81, TL=0.00, TU=0.31

Datos proporcionados (no se estima nada):
  U = 200, A = 10, L = 80

Formula (no es Asientos):
  raw = TD + (U*TU) + (A*TA) + (L*TL)
  raw = 33.49 + (200*0.31) + (10*0.81) + (80*0.00)
  raw = 33.49 + 62.00 + 8.10 + 0.00
  raw = 103.59

humanRound(103.59): 103.59 esta en rango >=95 -> ceil(103.59/10)*10 = 11*10 = 110

Resultado: 110 minutos -> Size M (2 puntos)
```

### Ejemplo 3: 15 sillas con 2 albaranes

```
Categoria: "sillas" -> normalizeCategory -> "Asientos"
Coeficientes: TD=48.88, TA=5.49, TL=0.00, TU=1.06

Estimaciones:
  L = max(1, round(15 * 0.149)) = max(1, 2) = 2 lineas
  A = 2 (proporcionado)

Formula (caso Asientos, NO se usa TD):
  raw = (U*TU) + (A*TA) + (L*TL)
  raw = (15*1.06) + (2*5.49) + (2*0.00)
  raw = 15.90 + 10.98 + 0.00
  raw = 26.88

humanRound(26.88): 26.88 esta en rango 15-44 -> floor(26.88/10)*10 = 2*10 = 20

Resultado: 20 minutos -> Size S (1 punto)
```

### Ejemplo 4: 500 unidades de PAE

```
Categoria: "PAE"
Coeficientes: TD=6.67, TA=8.33, TL=0.00, TU=0.00

Estimaciones:
  L = max(1, round(500 * 0.002)) = max(1, 1) = 1 linea
  A = 2 albaranes

Formula (no es Asientos):
  raw = TD + (U*TU) + (A*TA) + (L*TL)
  raw = 6.67 + (500*0.00) + (2*8.33) + (1*0.00)
  raw = 6.67 + 0.00 + 16.66 + 0.00
  raw = 23.33

humanRound(23.33): 23.33 esta en rango 15-44 -> floor(23.33/10)*10 = 2*10 = 20

Resultado: 20 minutos -> Size S (1 punto)

Nota: PAE tiene TU=0.00, asi que las unidades no afectan al tiempo.
El coste viene de TD (arranque) + albaranes.
```

### Ejemplo 5: 300 colchones (caso grande)

```
Categoria: "colchones" -> normalizeCategory -> "Colchoneria"
Coeficientes: TD=14.83, TA=0.00, TL=4.95, TU=0.12

Estimaciones:
  L = max(1, round(300 * 0.369)) = max(1, 111) = 111 lineas
  A = 3 albaranes

Formula:
  raw = 14.83 + (300*0.12) + (3*0.00) + (111*4.95)
  raw = 14.83 + 36.00 + 0.00 + 549.45
  raw = 600.28

humanRound(600.28): 600.28 >= 95 -> ceil(600.28/10)*10 = 61*10 = 610

Resultado: 610 minutos (~10 horas) -> Size L (3 puntos)
```
