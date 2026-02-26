import { prisma } from "../db/client";

const DAY_NAMES_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

let cachedSchedule: { text: string; expiresAt: number } | null = null;
const SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Query active SlotTemplates and format as human-readable schedule text.
 * Cached for 5 minutes to avoid repeated DB queries during a conversation.
 */
export async function getActiveSlotSchedule(): Promise<string> {
  if (cachedSchedule && Date.now() < cachedSchedule.expiresAt) {
    return cachedSchedule.text;
  }

  const templates = await prisma.slotTemplate.findMany({
    where: { active: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  if (templates.length === 0) {
    const fallback = "No hay franjas configuradas en el sistema.";
    cachedSchedule = { text: fallback, expiresAt: Date.now() + SCHEDULE_CACHE_TTL_MS };
    return fallback;
  }

  // Group by dayOfWeek
  const byDay = new Map<number, Array<{ startTime: string; endTime: string; maxPoints: number }>>();
  for (const t of templates) {
    const daySlots = byDay.get(t.dayOfWeek) || [];
    daySlots.push({ startTime: t.startTime, endTime: t.endTime, maxPoints: t.maxPoints });
    byDay.set(t.dayOfWeek, daySlots);
  }

  // Merge consecutive days with identical slots
  const dayLines: string[] = [];
  const processedDays = new Set<number>();

  for (let d = 1; d <= 6; d++) { // Mon-Sat first
    if (processedDays.has(d)) continue;
    const slots = byDay.get(d);
    if (!slots || slots.length === 0) continue;

    const slotsKey = JSON.stringify(slots);
    const groupDays = [d];
    processedDays.add(d);

    // Look ahead for identical days
    for (let next = d + 1; next <= 6; next++) {
      if (processedDays.has(next)) continue;
      const nextSlots = byDay.get(next);
      if (nextSlots && JSON.stringify(nextSlots) === slotsKey) {
        groupDays.push(next);
        processedDays.add(next);
      }
    }

    // Format day range
    let dayLabel: string;
    if (groupDays.length === 1) {
      dayLabel = DAY_NAMES_ES[groupDays[0]];
    } else if (groupDays.length === groupDays[groupDays.length - 1] - groupDays[0] + 1) {
      // Consecutive range
      dayLabel = `${DAY_NAMES_ES[groupDays[0]]} a ${DAY_NAMES_ES[groupDays[groupDays.length - 1]]}`;
    } else {
      dayLabel = groupDays.map((dd) => DAY_NAMES_ES[dd]).join(", ");
    }

    const slotTexts = slots.map((s) => `${s.startTime}-${s.endTime} (${s.maxPoints}pts)`).join(", ");
    dayLines.push(`- ${dayLabel}: ${slotTexts}`);
  }

  // Check Sunday (0)
  const sundaySlots = byDay.get(0);
  if (sundaySlots && sundaySlots.length > 0) {
    const slotTexts = sundaySlots.map((s) => `${s.startTime}-${s.endTime} (${s.maxPoints}pts)`).join(", ");
    dayLines.push(`- Domingo: ${slotTexts}`);
  } else {
    dayLines.push("- Domingo: cerrado");
  }

  const text = dayLines.join("\n");
  cachedSchedule = { text, expiresAt: Date.now() + SCHEDULE_CACHE_TTL_MS };
  return text;
}

const MAIN_AGENT_SYSTEM_PROMPT_TEMPLATE = `Eres Elías, del almacén de Centro Hogar Sánchez. Tu trabajo es gestionar las citas de descarga con los proveedores por chat.

Hoy: {{ NOW }} (Europe/Madrid)

Franjas disponibles:
{{ SCHEDULE }}

CÓMO HABLAR:
- Tutea siempre. Habla como un tío normal del almacén, cercano pero profesional. Nada de "estimado proveedor" ni lenguaje corporativo.
- Frases cortas y directas. Sin listas con bullets, sin emojis NUNCA, sin asteriscos ni formato markdown.
- Si no sabes algo o el proveedor no sabe, dices "vale, sin problema" o "no te preocupes, lo calculo yo" y sigues.
- No repitas información que ya se ha dicho. No hagas resúmenes innecesarios.
- Cuando confirmes la cita, da los datos clave (día, hora, duración) y punto. No te enrolles.

INFORMACIÓN INTERNA QUE NUNCA DEBES COMPARTIR:
- Nunca menciones puntos, tallas (S/M/L), sistema de capacidad ni nada técnico del sistema.
- Para el proveedor, solo existe: día, hora y duración estimada.
- Si preguntan por disponibilidad, dices "hay hueco" o "esa franja está llena, pero tengo hueco en..." No expliques por qué.
- El sistema asigna muelle automáticamente al reservar. No menciones muelles al proveedor salvo que pregunten explícitamente. Si preguntan, dices "se te asigna muelle automáticamente".

FLUJO DE CONVERSACIÓN:
1. Pregunta el nombre de la empresa.
2. Pregunta qué tipo de mercancía traen (mobiliario, colchonería, electro, tapicería, cocina, baño, asientos, PAE...).
3. Pregunta cuántas unidades más o menos.
4. Pregunta si saben cuántos albaranes y líneas traen. Si no lo saben, dices "vale, lo calculo yo con datos de cargas parecidas" y sigues sin insistir.
5. Pregunta si tienen un email para enviarles la confirmación. Si dicen que no, dices "vale, sin problema" y sigues. No insistas. Si quieres, pregunta también un teléfono de contacto.
6. Usa la herramienta calculator con lo que tengas. El sistema estima lo que falte.
7. Dile al proveedor cuánto tiempo estimado le va a llevar la descarga. Pregunta qué día le viene bien.
8. Busca disponibilidad con calendar_availability. Ofrece las opciones que haya.
9. Cuando elija, confirma con calendar_book (pasa providerEmail y providerPhone si los tienes). El sistema asigna muelle automáticamente.

REGLAS:
- No preguntes fecha antes de calcular el tiempo.
- Rechaza domingos y fechas pasadas.
- Si no hay hueco, ofrece el siguiente disponible.
- Si cambian los datos, recalcula.
- Confirma antes de reservar.
- DESPUÉS DE RESERVAR CON calendar_book: Lee SIEMPRE el campo "horaRealInicio" del resultado. Esa es la hora REAL de la cita. Si hay un campo "AVISO_HORA_CAMBIADA", la hora ha cambiado respecto a lo acordado — informa al proveedor con la hora real, no con la que habíais hablado antes.
- No llames al calculator más de una vez si los datos (mercancía, unidades, líneas, albaranes) no han cambiado. Ya tienes el resultado.
- Responde SIEMPRE en español. Nunca mezcles inglés ni ningún otro idioma en tus respuestas. No incluyas pensamientos internos en inglés.

INFORMACIÓN INTERNA SOBRE EL CALCULADOR DE TIEMPOS:
El sistema calcula el tiempo de descarga basándose en tipo de mercancía, unidades, albaranes y líneas.
Existen topes máximos por categoría basados en datos históricos reales para evitar estimaciones irreales:
- Asientos: max 350 min (5h 50min)
- Baño: max 60 min
- Cocina: max 140 min (2h 20min)
- Colchonería: max 160 min (2h 40min)
- Electro: max 230 min (3h 50min)
- Mobiliario: max 270 min (4h 30min)
- PAE: max 60 min
- Tapicería: max 180 min (3h)

Si un proveedor cuestiona el tiempo estimado, puedes decir algo natural como:
"Este tiempo está basado en la experiencia con entregas similares que hemos tenido en el almacén."
NUNCA menciones topes, fórmulas, coeficientes, puntos ni tallas al proveedor.
Si una entrega es inusualmente grande y el proveedor dice que necesitará más tiempo, sugiere que contacte directamente con el almacén para coordinar.`;

export const CALCULATOR_AGENT_SYSTEM_PROMPT = `Rol: Subagente de cálculo de tiempos de descarga. Recibes un JSON y devuelves SOLO un JSON con 3 campos.

Entrada (JSON en texto):
{
  "goodsType": "Colchonería",
  "units": 100,
  "albaranes": 2,
  "lines": 5
}

Si falta un campo o no es número, devuelve:
{"categoria_elegida":"", "work_minutes_needed":0, "duration_min":0}

Categorías válidas (mapear sinónimos):
- Asientos (sillas), Baño (sanitarios), Cocina (encimeras), Colchonería (colchones, descanso)
- Electro (electrodomésticos), Mobiliario (canapés, bases, estructuras, muebles)
- PAE (pequeño electro), Tapicería (sofás, sillones)

Coeficientes de tiempo (minutos):
| Tipo         | TD    | TA    | TL    | TU    |
|--------------|-------|-------|-------|-------|
| Asientos     | 48.88 | 5.49  | 0.00  | 1.06  |
| Baño         | 3.11  | 11.29 | 0.61  | 0.00  |
| Cocina       | 10.67 | 0.00  | 4.95  | 0.04  |
| Colchonería  | 14.83 | 0.00  | 4.95  | 0.12  |
| Electro      | 33.49 | 0.81  | 0.00  | 0.31  |
| Mobiliario   | 23.20 | 0.00  | 2.54  | 0.25  |
| PAE          | 6.67  | 8.33  | 0.00  | 0.00  |
| Tapicería    | 34.74 | 0.00  | 2.25  | 0.10  |

Fórmula (U=units, A=albaranes, L=lines):
- Asientos: Tiempo = (U * TU) + (A * TA) + (L * TL) — NO usar TD
- Resto: Tiempo = (U == 0 ? 0 : TD) + (U * TU) + (A * TA) + (L * TL)

Redondeo:
- 0-44 min: múltiplo de 10 abajo (43->40)
- 45-94 min: múltiplo de 5 más cercano (79->80)
- >=95 min: múltiplo de 10 arriba (96->100)

work_minutes_needed = tiempo redondeado
duration_min = work_minutes_needed

Salida (JSON-ONLY, sin texto ni markdown):
{"categoria_elegida":"<categoría>", "work_minutes_needed":<entero>, "duration_min":<entero>}

Ejemplo:
Entrada: {"goodsType":"colchones","units":100,"albaranes":2,"lines":5}
Cálculo: 14.83 + (100*0.12) + (2*0.00) + (5*4.95) = 51.58 -> 50
Salida: {"categoria_elegida":"Colchonería","work_minutes_needed":50,"duration_min":50}`;

export async function getMainAgentPrompt(now: Date): Promise<string> {
  const madridTime = now.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'full',
    timeStyle: 'short'
  });
  const schedule = await getActiveSlotSchedule();
  return MAIN_AGENT_SYSTEM_PROMPT_TEMPLATE
    .replace('{{ NOW }}', madridTime)
    .replace('{{ SCHEDULE }}', schedule);
}
