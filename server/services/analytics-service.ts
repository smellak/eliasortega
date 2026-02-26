import { prisma } from "../db/client";

export interface CategoryAccuracy {
  category: string;
  sampleSize: number;
  avgEstimated: number;
  avgActual: number;
  mae: number;
  mape: number;
  bias: number;
  r2: number | null;
}

export interface ProviderProfile {
  providerName: string;
  deliveryCount: number;
  avgDurationMin: number;
  avgUnits: number;
  avgPredictionError: number;
  reliability: "fast" | "normal" | "slow";
}

type AccuracyRow = {
  goodsType: string | null;
  workMinutesNeeded: number;
  actualDurationMin: number | null;
  predictionErrorMin: number | null;
};

type ProviderRow = {
  providerName: string;
  workMinutesNeeded: number;
  units: number | null;
  actualDurationMin: number | null;
  predictionErrorMin: number | null;
};

export async function getPredictionAccuracy(filters?: {
  from?: string;
  to?: string;
  category?: string;
}): Promise<CategoryAccuracy[]> {
  const where: any = {
    actualDurationMin: { not: null },
    actualStartUtc: { not: null },
    actualEndUtc: { not: null },
    goodsType: { not: null },
  };

  if (filters?.from) {
    where.actualStartUtc = { ...where.actualStartUtc, gte: new Date(filters.from) };
  }
  if (filters?.to) {
    where.actualEndUtc = { ...where.actualEndUtc, lte: new Date(filters.to + "T23:59:59Z") };
  }
  if (filters?.category) {
    where.goodsType = { equals: filters.category, mode: "insensitive" };
  }

  const appointments: AccuracyRow[] = await prisma.appointment.findMany({
    where,
    select: {
      goodsType: true,
      workMinutesNeeded: true,
      actualDurationMin: true,
      predictionErrorMin: true,
    },
  });

  // Group by goodsType
  const byCategory: Record<string, AccuracyRow[]> = {};
  for (const a of appointments) {
    const cat = a.goodsType || "Desconocido";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  }

  const results: CategoryAccuracy[] = [];
  const categories = Object.keys(byCategory);
  for (let ci = 0; ci < categories.length; ci++) {
    const category = categories[ci];
    const items = byCategory[category];
    const n = items.length;
    const predicted: number[] = items.map((a: AccuracyRow) => a.workMinutesNeeded);
    const actual: number[] = items.map((a: AccuracyRow) => a.actualDurationMin!);
    const errors: number[] = items.map((a: AccuracyRow) => a.predictionErrorMin!);

    let sumPredicted = 0, sumActual = 0, sumAbsErr = 0, sumBias = 0;
    for (let i = 0; i < n; i++) {
      sumPredicted += predicted[i];
      sumActual += actual[i];
      sumAbsErr += Math.abs(errors[i]);
      sumBias += errors[i];
    }

    const avgEstimated = sumPredicted / n;
    const avgActual = sumActual / n;
    const mae = sumAbsErr / n;
    const bias = sumBias / n;

    let sumMape = 0;
    for (let i = 0; i < n; i++) {
      if (actual[i] > 0) sumMape += Math.abs(errors[i]) / actual[i];
    }
    const mape = (sumMape / n) * 100;

    // R-squared
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      ssTot += (actual[i] - avgActual) ** 2;
      ssRes += (actual[i] - predicted[i]) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : null;

    results.push({
      category,
      sampleSize: n,
      avgEstimated: Math.round(avgEstimated * 100) / 100,
      avgActual: Math.round(avgActual * 100) / 100,
      mae: Math.round(mae * 100) / 100,
      mape: Math.round(mape * 100) / 100,
      bias: Math.round(bias * 100) / 100,
      r2: r2 !== null ? Math.round(r2 * 10000) / 10000 : null,
    });
  }

  return results.sort((a: CategoryAccuracy, b: CategoryAccuracy) => b.sampleSize - a.sampleSize);
}

export async function getProviderProfiles(): Promise<ProviderProfile[]> {
  const appointments: ProviderRow[] = await prisma.appointment.findMany({
    where: {
      actualDurationMin: { not: null },
    },
    select: {
      providerName: true,
      actualDurationMin: true,
      units: true,
      predictionErrorMin: true,
      workMinutesNeeded: true,
    },
  });

  // Group by provider
  const byProvider: Record<string, ProviderRow[]> = {};
  for (const a of appointments) {
    if (!byProvider[a.providerName]) byProvider[a.providerName] = [];
    byProvider[a.providerName].push(a);
  }

  const results: ProviderProfile[] = [];
  const providerNames = Object.keys(byProvider);
  for (let pi = 0; pi < providerNames.length; pi++) {
    const providerName = providerNames[pi];
    const items = byProvider[providerName];
    if (items.length < 3) continue;

    const n = items.length;
    let sumDuration = 0, sumUnits = 0, sumError = 0;
    for (let i = 0; i < n; i++) {
      sumDuration += items[i].actualDurationMin!;
      sumUnits += items[i].units || 0;
      sumError += items[i].predictionErrorMin || 0;
    }

    const avgDurationMin = sumDuration / n;
    const avgUnits = sumUnits / n;
    const avgPredictionError = sumError / n;

    let reliability: "fast" | "normal" | "slow";
    if (avgPredictionError > 15) {
      reliability = "slow";
    } else if (avgPredictionError < -15) {
      reliability = "fast";
    } else {
      reliability = "normal";
    }

    results.push({
      providerName,
      deliveryCount: n,
      avgDurationMin: Math.round(avgDurationMin * 10) / 10,
      avgUnits: Math.round(avgUnits * 10) / 10,
      avgPredictionError: Math.round(avgPredictionError * 10) / 10,
      reliability,
    });
  }

  return results.sort((a: ProviderProfile, b: ProviderProfile) => b.deliveryCount - a.deliveryCount);
}
