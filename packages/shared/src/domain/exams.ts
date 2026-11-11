export interface ExamComponentScore {
  maxMarks: number;
  weight: number;
  obtained: number | null;
}

export function weightedTotal(components: ExamComponentScore[]): {
  obtained: number;
  max: number;
  percentage: number;
} {
  let weightedObtained = 0;
  let weightedMax = 0;
  for (const c of components) {
    if (c.obtained === null) continue;
    const ratio = c.maxMarks > 0 ? c.obtained / c.maxMarks : 0;
    weightedObtained += ratio * c.weight;
    weightedMax += c.weight;
  }
  if (weightedMax === 0) {
    return { obtained: 0, max: 0, percentage: 0 };
  }
  const percentage = Math.round((weightedObtained / weightedMax) * 10000) / 100;
  return {
    obtained: Math.round(weightedObtained * 100) / 100,
    max: Math.round(weightedMax * 100) / 100,
    percentage,
  };
}

export function assertMarkWithinMax(
  obtained: number | null,
  maxMarks: number,
): { ok: true } | { ok: false; message: string } {
  if (obtained === null) return { ok: true };
  if (!Number.isFinite(obtained) || obtained < 0) {
    return { ok: false, message: 'Marks cannot be negative' };
  }
  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    return { ok: false, message: 'Maximum marks must be positive' };
  }
  if (obtained > maxMarks) {
    return { ok: false, message: 'Marks cannot exceed the maximum' };
  }
  return { ok: true };
}

export interface GradeBand {
  minPercent: number;
  maxPercent: number;
  grade: string;
  isPass: boolean;
}

export function gradeFromScale(
  percentage: number,
  bands: GradeBand[],
  passPercent: number,
): { grade: string; isPass: boolean } {
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  for (const band of sorted) {
    if (percentage >= band.minPercent && percentage <= band.maxPercent) {
      return { grade: band.grade, isPass: band.isPass && percentage >= passPercent };
    }
  }
  return { grade: 'N/A', isPass: percentage >= passPercent };
}
