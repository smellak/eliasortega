// Ratios de estimación calculados de datos históricos reales (mar-may 2025)
// Fuente: Tiempos_medios_descargas_CHS.xlsx del consultor
// Se usan cuando el proveedor no sabe líneas y/o albaranes

export interface CategoryRatio {
  linesPerUnit: number;        // líneas = unidades × este ratio
  defaultDeliveryNotes: number; // albaranes por defecto (mediana histórica)
  sampleSize: number;           // número de muestras del histórico
  correlation: number;          // R del modelo del consultor para esta categoría
}

export const ESTIMATION_RATIOS: Record<string, CategoryRatio> = {
  "Asientos":     { linesPerUnit: 0.149, defaultDeliveryNotes: 4,  sampleSize: 21,  correlation: 0.65 },
  "Baño":         { linesPerUnit: 0.889, defaultDeliveryNotes: 1,  sampleSize: 4,   correlation: 0.94 },
  "Cocina":       { linesPerUnit: 0.119, defaultDeliveryNotes: 2,  sampleSize: 10,  correlation: 0.97 },
  "Colchonería":  { linesPerUnit: 0.369, defaultDeliveryNotes: 3,  sampleSize: 44,  correlation: 0.86 },
  "Electro":      { linesPerUnit: 0.617, defaultDeliveryNotes: 34, sampleSize: 40,  correlation: 0.47 },
  "Mobiliario":   { linesPerUnit: 0.370, defaultDeliveryNotes: 4,  sampleSize: 108, correlation: 0.79 },
  "PAE":          { linesPerUnit: 0.002, defaultDeliveryNotes: 2,  sampleSize: 6,   correlation: 0.89 },
  "Tapicería":    { linesPerUnit: 0.467, defaultDeliveryNotes: 6,  sampleSize: 60,  correlation: 0.65 },
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
  // Match directo por nombre canónico
  if (ESTIMATION_RATIOS[input]) return input;
  // Match por alias exacto
  if (CATEGORY_ALIASES[lower]) return CATEGORY_ALIASES[lower];
  // Match parcial
  for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) return canonical;
  }
  return null;
}

export function estimateLines(category: string, units: number): number {
  const ratio = ESTIMATION_RATIOS[category];
  if (!ratio) return Math.max(1, Math.round(units * 0.3)); // fallback genérico
  return Math.max(1, Math.round(units * ratio.linesPerUnit));
}

export function estimateDeliveryNotes(category: string): number {
  const ratio = ESTIMATION_RATIOS[category];
  if (!ratio) return 1; // fallback genérico
  return ratio.defaultDeliveryNotes;
}
