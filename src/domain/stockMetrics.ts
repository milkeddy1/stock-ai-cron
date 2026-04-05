import type { ComputedLiquidityMetrics, VolumeSeries } from "./types.js";

export const DEFAULT_VOLUME_WINDOW = 20;

/**
 * 最近 n 根 K 的成交量平均；n 大於序列長度時以實際長度平均；空序列為 0。
 */
export function computeAvgVolumeLastN(
  volumes: VolumeSeries,
  n: number,
): number {
  if (n <= 0 || volumes.length === 0) return 0;
  const slice = volumes.slice(-n);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return sum / slice.length;
}

/**
 * 對序列中每個索引 i：當日 RVOL = volumes[i] / 前 window 日均量（不含當日）。
 * 起算索引與既有邏輯一致：`max(window, length - window)`。
 */
export function computeDailyRvolSeries(
  volumes: VolumeSeries,
  window: number = DEFAULT_VOLUME_WINDOW,
): number[] {
  const rvolSeries: number[] = [];
  const startIndex = Math.max(window, volumes.length - window);
  for (let i = startIndex; i < volumes.length; i += 1) {
    const prev = volumes.slice(i - window, i);
    const prevAvg =
      prev.length > 0
        ? prev.reduce((acc, vol) => acc + vol, 0) / prev.length
        : 0;
    const dailyRvol = prevAvg > 0 ? volumes[i]! / prevAvg : 0;
    rvolSeries.push(dailyRvol);
  }
  return rvolSeries;
}

export function average(numbers: readonly number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((acc, v) => acc + v, 0) / numbers.length;
}

export function formatRvolRatio(ratio: number): string {
  return ratio.toFixed(2);
}

export function formatAvgRvol20d(rvolSeries: readonly number[]): string {
  if (rvolSeries.length === 0) return "0.00";
  return formatRvolRatio(average(rvolSeries));
}

/** 當日成交量相對於參考均量（通常為 20 日均量）的 RVOL 字串。 */
export function computeSnapshotRvol(
  currentVol: number,
  referenceAvgVolume: number,
): string {
  return referenceAvgVolume > 0
    ? formatRvolRatio(currentVol / referenceAvgVolume)
    : "0.00";
}

/**
 * 由歷史成交量序列與當日有效成交量一次算出流動性指標（純函式、無 I/O）。
 * RVOL 使用未四捨五入的均量計算，與原本 `getStockData` 行為一致。
 */
export function computeLiquidityMetrics(
  volumes: VolumeSeries,
  currentVol: number,
  window: number = DEFAULT_VOLUME_WINDOW,
): ComputedLiquidityMetrics {
  const avgVol20dRaw = computeAvgVolumeLastN(volumes, window);
  const rvolSeries = computeDailyRvolSeries(volumes, window);
  return {
    avgVol20d: Math.round(avgVol20dRaw),
    rvol: computeSnapshotRvol(currentVol, avgVol20dRaw),
    avgRvol20d: formatAvgRvol20d(rvolSeries),
  };
}
