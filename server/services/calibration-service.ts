import { prisma } from "../db/client";

const DEFAULT_CATEGORIES: Record<string, { TD: number; TA: number; TL: number; TU: number }> = {
  "Asientos":     { TD: 48.88, TA: 5.49,  TL: 0.00, TU: 1.06 },
  "Baño":         { TD: 3.11,  TA: 11.29, TL: 0.61, TU: 0.00 },
  "Cocina":       { TD: 10.67, TA: 0.00,  TL: 4.95, TU: 0.04 },
  "Colchonería":  { TD: 14.83, TA: 0.00,  TL: 4.95, TU: 0.12 },
  "Electro":      { TD: 33.49, TA: 0.81,  TL: 0.00, TU: 0.31 },
  "Mobiliario":   { TD: 23.20, TA: 0.00,  TL: 2.54, TU: 0.25 },
  "PAE":          { TD: 6.67,  TA: 8.33,  TL: 0.00, TU: 0.00 },
  "Tapicería":    { TD: 34.74, TA: 0.00,  TL: 2.25, TU: 0.10 },
};

export interface CalibrationResult {
  category: string;
  sampleSize: number;
  oldCoeffs: { TD: number; TA: number; TL: number; TU: number };
  newCoeffs: { TD: number; TA: number; TL: number; TU: number };
  maeOld: number;
  maeNew: number;
  improvement: number;
  snapshotId: string;
}

// ── Linear algebra helpers ──────────────────────────────────────────

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length, cols = B[0].length, inner = B.length;
  const C: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < inner; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

function transpose(A: number[][]): number[][] {
  const rows = A.length, cols = A[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      T[j][i] = A[i][j];
  return T;
}

function invertMatrix(M: number[][]): number[][] | null {
  const n = M.length;
  const aug: number[][] = M.map((row, i) => {
    const ext = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) ext[j] = row[j];
    ext[n + i] = 1;
    return ext;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) return null;

    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map(row => row.slice(n));
}

// ── Coefficient management ──────────────────────────────────────────

export async function getCurrentCoeffs(category: string): Promise<{ TD: number; TA: number; TL: number; TU: number }> {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key: `calc_coeff_${category}` },
    });
    if (config) {
      return JSON.parse(config.value);
    }
  } catch { /* fallback to defaults */ }
  return DEFAULT_CATEGORIES[category] || { TD: 15, TA: 1, TL: 1, TU: 0.2 };
}

// ── Core calibration ────────────────────────────────────────────────

export async function calculateCalibration(category: string): Promise<CalibrationResult> {
  const appointments = await prisma.appointment.findMany({
    where: {
      goodsType: { equals: category, mode: "insensitive" },
      actualDurationMin: { not: null },
      actualStartUtc: { not: null },
      actualEndUtc: { not: null },
    },
    select: {
      units: true,
      lines: true,
      deliveryNotesCount: true,
      actualDurationMin: true,
      workMinutesNeeded: true,
    },
  });

  if (appointments.length < 20) {
    throw new Error(`Muestras insuficientes para "${category}": ${appointments.length} (mínimo 20)`);
  }

  const oldCoeffs = await getCurrentCoeffs(category);
  const isAsientos = category === "Asientos";

  // Build design matrix X and target vector y
  // Columns: [intercept(TD), albaranes(TA), lines(TL), units(TU)]
  const n = appointments.length;
  const X: number[][] = [];
  const y: number[] = [];

  for (const a of appointments) {
    const U = a.units || 0;
    const A = a.deliveryNotesCount || 1;
    const L = a.lines || 1;
    const actual = a.actualDurationMin!;

    if (isAsientos) {
      X.push([0, A, 0, U]); // No TD for Asientos
    } else {
      X.push([U > 0 ? 1 : 0, A, L, U]);
    }
    y.push(actual);
  }

  // Solve: beta = (X^T X)^-1 X^T y
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = invertMatrix(XtX);

  if (!XtXinv) {
    throw new Error(`Matriz singular para "${category}". Los datos carecen de variedad suficiente.`);
  }

  const Xty = matMul(Xt, y.map(v => [v]));
  const beta = matMul(XtXinv, Xty).map(row => row[0]);

  const newCoeffs = {
    TD: Math.max(0, Math.round(beta[0] * 100) / 100),
    TA: Math.max(0, Math.round(beta[1] * 100) / 100),
    TL: Math.max(0, Math.round(beta[2] * 100) / 100),
    TU: Math.max(0, Math.round(beta[3] * 100) / 100),
  };

  // Calculate MAE for old and new
  let maeOldSum = 0;
  let maeNewSum = 0;
  for (let i = 0; i < n; i++) {
    const actual = y[i];
    const predictedOld = X[i][0] * oldCoeffs.TD + X[i][1] * oldCoeffs.TA + X[i][2] * oldCoeffs.TL + X[i][3] * oldCoeffs.TU;
    const predictedNew = X[i][0] * newCoeffs.TD + X[i][1] * newCoeffs.TA + X[i][2] * newCoeffs.TL + X[i][3] * newCoeffs.TU;
    maeOldSum += Math.abs(actual - predictedOld);
    maeNewSum += Math.abs(actual - predictedNew);
  }
  const maeOld = maeOldSum / n;
  const maeNew = maeNewSum / n;
  const improvement = maeOld > 0 ? ((maeOld - maeNew) / maeOld) * 100 : 0;

  // Save snapshot with Prisma-generated UUID
  const snapshot = await prisma.calibrationSnapshot.create({
    data: {
      category,
      sampleSize: n,
      newTD: newCoeffs.TD, newTA: newCoeffs.TA, newTL: newCoeffs.TL, newTU: newCoeffs.TU,
      oldTD: oldCoeffs.TD, oldTA: oldCoeffs.TA, oldTL: oldCoeffs.TL, oldTU: oldCoeffs.TU,
      maeOld: Math.round(maeOld * 100) / 100,
      maeNew: Math.round(maeNew * 100) / 100,
      status: "pending",
    },
  });

  return {
    category,
    sampleSize: n,
    oldCoeffs,
    newCoeffs,
    maeOld: Math.round(maeOld * 100) / 100,
    maeNew: Math.round(maeNew * 100) / 100,
    improvement: Math.round(improvement * 100) / 100,
    snapshotId: snapshot.id,
  };
}

export async function applyCalibration(snapshotId: string, appliedBy: string): Promise<void> {
  const snapshot = await prisma.calibrationSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) throw new Error("Snapshot de calibración no encontrado");
  if (snapshot.status !== "pending") throw new Error(`El snapshot ya está ${snapshot.status}`);

  const coeffs = {
    TD: snapshot.newTD,
    TA: snapshot.newTA,
    TL: snapshot.newTL,
    TU: snapshot.newTU,
  };

  await prisma.appConfig.upsert({
    where: { key: `calc_coeff_${snapshot.category}` },
    update: { value: JSON.stringify(coeffs) },
    create: {
      key: `calc_coeff_${snapshot.category}`,
      value: JSON.stringify(coeffs),
      description: `Coeficientes calibrados para ${snapshot.category} (aplicado ${new Date().toISOString()})`,
    },
  });

  await prisma.calibrationSnapshot.update({
    where: { id: snapshotId },
    data: {
      status: "applied",
      appliedAt: new Date(),
      appliedBy,
    },
  });
}
