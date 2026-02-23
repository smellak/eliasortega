import { openai } from "./llm-clients";
import { CALCULATOR_AGENT_SYSTEM_PROMPT } from "./prompts";
import { z } from "zod";

const calculatorInputSchema = z.object({
  providerName: z.string().optional(),
  goodsType: z.string(),
  units: z.number().int().min(0),
  lines: z.number().int().min(0),
  albaranes: z.number().int().min(0),
});

const calculatorOutputSchema = z.object({
  categoria_elegida: z.string(),
  work_minutes_needed: z.number().int().min(0),
  forklifts_needed: z.number().int().min(0),
  workers_needed: z.number().int().min(0),
  duration_min: z.number().int().min(0),
});

export type CalculatorInput = z.infer<typeof calculatorInputSchema>;
export type CalculatorOutput = z.infer<typeof calculatorOutputSchema>;

interface CategoryCoefficients {
  TD: number;
  TA: number;
  TL: number;
  TU: number;
  usesForklift: boolean;
}

const CATEGORIES: Record<string, CategoryCoefficients> = {
  "Asientos":     { TD: 48.88, TA: 5.49,  TL: 0.00, TU: 1.06, usesForklift: true },
  "Baño":         { TD: 3.11,  TA: 11.29, TL: 0.61, TU: 0.00, usesForklift: false },
  "Cocina":       { TD: 10.67, TA: 0.00,  TL: 4.95, TU: 0.04, usesForklift: false },
  "Colchonería":  { TD: 14.83, TA: 0.00,  TL: 4.95, TU: 0.12, usesForklift: true },
  "Electro":      { TD: 33.49, TA: 0.81,  TL: 0.00, TU: 0.31, usesForklift: true },
  "Mobiliario":   { TD: 23.20, TA: 0.00,  TL: 2.54, TU: 0.25, usesForklift: true },
  "PAE":          { TD: 6.67,  TA: 8.33,  TL: 0.00, TU: 0.00, usesForklift: false },
  "Tapicería":    { TD: 34.74, TA: 0.00,  TL: 2.25, TU: 0.10, usesForklift: true },
};

const CATEGORY_SYNONYMS: Record<string, string> = {
  "asientos": "Asientos", "sillas": "Asientos", "asiento": "Asientos", "silla": "Asientos",
  "baño": "Baño", "bano": "Baño", "sanitarios": "Baño", "sanitario": "Baño",
  "cocina": "Cocina", "encimeras": "Cocina", "encimera": "Cocina",
  "colchonería": "Colchonería", "colchoneria": "Colchonería", "colchon": "Colchonería",
  "colchones": "Colchonería", "descanso": "Colchonería", "colchón": "Colchonería",
  "electro": "Electro", "electrodomesticos": "Electro", "electrodomésticos": "Electro",
  "electrodomestico": "Electro", "electrodoméstico": "Electro",
  "mobiliario": "Mobiliario", "canape": "Mobiliario", "canapé": "Mobiliario",
  "canapes": "Mobiliario", "canapés": "Mobiliario", "bases": "Mobiliario",
  "estructuras": "Mobiliario", "muebles": "Mobiliario", "mueble": "Mobiliario",
  "pae": "PAE", "pequeño electro": "PAE", "pequenio electro": "PAE",
  "pequeño electrodoméstico": "PAE",
  "tapicería": "Tapicería", "tapiceria": "Tapicería", "sofa": "Tapicería",
  "sofá": "Tapicería", "sofas": "Tapicería", "sofás": "Tapicería",
  "sillones": "Tapicería", "sillon": "Tapicería", "sillón": "Tapicería",
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

  return null;
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
  const A = Math.max(0, input.albaranes);
  const L = Math.max(0, input.lines);

  let rawMinutes: number;
  if (category === "Asientos") {
    rawMinutes = (U * coeff.TU) + (A * coeff.TA) + (L * coeff.TL);
  } else {
    rawMinutes = (U === 0 ? 0 : coeff.TD) + (U * coeff.TU) + (A * coeff.TA) + (L * coeff.TL);
  }

  const workMinutes = humanRound(rawMinutes);

  let forkliftsNeeded: number;
  if (!coeff.usesForklift) {
    forkliftsNeeded = 0;
  } else if (workMinutes >= 90) {
    forkliftsNeeded = 2;
  } else {
    forkliftsNeeded = 1;
  }

  let workersNeeded: number;
  if (workMinutes <= 30) workersNeeded = 1;
  else if (workMinutes <= 90) workersNeeded = 2;
  else workersNeeded = 3;

  if (category === "Tapicería" || category === "Asientos") {
    workersNeeded += 1;
  }

  workersNeeded = Math.min(workersNeeded, 4);

  return {
    categoria_elegida: category,
    work_minutes_needed: workMinutes,
    forklifts_needed: forkliftsNeeded,
    workers_needed: workersNeeded,
    duration_min: workMinutes,
  };
}

export async function runCalculator(input: CalculatorInput): Promise<CalculatorOutput> {
  const deterministicResult = calculateDeterministic(input);
  if (deterministicResult) {
    return deterministicResult;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: CALCULATOR_AGENT_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
      max_completion_tokens: 500,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from calculator agent");

    const parsed = JSON.parse(content);
    return calculatorOutputSchema.parse(parsed);
  } catch (error) {
    console.error("Calculator LLM fallback error:", error);
    return {
      categoria_elegida: "Mobiliario",
      work_minutes_needed: 60,
      forklifts_needed: 1,
      workers_needed: 2,
      duration_min: 60,
    };
  }
}
