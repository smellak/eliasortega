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
    console.log(`[Calculator] Using estimated lines for ${category}: ${L} (from ${U} units)`);
  }

  // Resolve albaranes — use provided value or estimate
  let A: number;
  if (input.albaranes != null && input.albaranes >= 0) {
    A = input.albaranes;
  } else {
    A = estimateDeliveryNotes(category);
    estimatedFields.push("deliveryNotes");
    console.log(`[Calculator] Using estimated deliveryNotes for ${category}: ${A}`);
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

  // LLM fallback for unknown categories — fill in lines/albaranes with defaults
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
    if (!textBlock || textBlock.type !== "text") throw new Error("No response from calculator agent");

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
