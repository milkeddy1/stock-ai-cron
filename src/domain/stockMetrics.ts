import { Buffer } from "node:buffer";
import type { ComputedLiquidityMetrics, VolumeSeries } from "./types.js";

export const DEFAULT_VOLUME_WINDOW = 20;
/** Wilder ATR 常用週期。 */
export const DEFAULT_ATR_PERIOD = 14;
/** RVOL 柱狀圖涵蓋的最近交易日數（分母仍為 `DEFAULT_VOLUME_WINDOW` 日均量）。 */
export const RVOL_TREND_DAY_COUNT = 14;

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

/** ATR ÷ 現價 × 100，顯示為百分比字串；價格無效時為「—」。 */
export function formatAtrPercentOfPrice(
  atr: number,
  currentPrice: number | null | undefined,
): string {
  if (!Number.isFinite(atr) || atr < 0) return "0.00%";
  if (
    currentPrice == null ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0
  ) {
    return "—";
  }
  const pct = (atr / currentPrice) * 100;
  return `${pct.toFixed(2)}%`;
}

/**
 * 各日 True Range；與 volumes 索引對齊。首日僅用 H−L。
 */
export function computeTrueRanges(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
): number[] {
  if (
    highs.length !== lows.length ||
    lows.length !== closes.length ||
    highs.length === 0
  ) {
    return [];
  }
  const tr: number[] = [];
  for (let i = 0; i < highs.length; i += 1) {
    const h = highs[i]!;
    const l = lows[i]!;
    if (i === 0) {
      tr.push(Math.max(h - l, 0));
      continue;
    }
    const prevC = closes[i - 1]!;
    tr.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
  }
  return tr;
}

/**
 * 每根 K 收盤時的 Wilder ATR；`i < period - 1` 時為 0（尚未形成完整 ATR）。
 */
export function computeWilderAtrPerBar(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period: number = DEFAULT_ATR_PERIOD,
): number[] {
  const tr = computeTrueRanges(highs, lows, closes);
  const L = tr.length;
  const out = new Array<number>(L).fill(0);
  if (L < period || period <= 0) return out;
  let atr = 0;
  for (let i = 0; i < period; i += 1) {
    atr += tr[i]!;
  }
  atr /= period;
  out[period - 1] = atr;
  for (let i = period; i < L; i += 1) {
    atr = (atr * (period - 1) + tr[i]!) / period;
    out[i] = atr;
  }
  return out;
}

/**
 * 最後一根 K 對應的 Wilder ATR（先以首 `period` 根 TR 簡單平均為種子，再平滑至最末）。
 */
export function computeLatestWilderAtr(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period: number = DEFAULT_ATR_PERIOD,
): number {
  const series = computeWilderAtrPerBar(highs, lows, closes, period);
  if (series.length === 0) return 0;
  return series[series.length - 1] ?? 0;
}

/** 第 `index` 日 RVOL：當日量 ÷ 前 `window` 日均量（不含當日）。 */
export function computeDailyRvolAtIndex(
  volumes: VolumeSeries,
  index: number,
  window: number = DEFAULT_VOLUME_WINDOW,
): number {
  if (index < window || index >= volumes.length) return 0;
  const prev = volumes.slice(index - window, index);
  const prevAvg =
    prev.length > 0 ? prev.reduce((acc, v) => acc + v, 0) / prev.length : 0;
  return prevAvg > 0 ? volumes[index]! / prevAvg : 0;
}

const QUICKCHART_BASE = "https://quickchart.io/chart";

/** Base64 `c` 參數可大幅縮短字串，避免 Discord embed field（≤1024）與 embed 總字數上限。 */
function buildQuickChartUrl(chartConfig: Record<string, unknown>): string {
  const json = JSON.stringify(chartConfig);
  const c = encodeURIComponent(
    Buffer.from(json, "utf8").toString("base64"),
  );
  return `${QUICKCHART_BASE}?w=400&h=220&devicePixelRatio=1&v=3&encoding=base64&c=${c}`;
}

/**
 * 近 `dayCount` 個交易日每日 RVOL 的 QuickChart 柱狀圖連結（20 日均量基準與既有 RVOL 一致）。
 */
export function buildRvol14dTrendQuickChartUrl(
  volumes: VolumeSeries,
  barDates: readonly Date[],
  window: number = DEFAULT_VOLUME_WINDOW,
  dayCount: number = RVOL_TREND_DAY_COUNT,
): string {
  if (barDates.length !== volumes.length || volumes.length <= window) {
    return "";
  }
  const L = volumes.length;
  const startIndex = Math.max(window, L - dayCount);
  const labels: string[] = [];
  const data: number[] = [];
  for (let i = startIndex; i < L; i += 1) {
    const d = barDates[i]!;
    labels.push(`${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
    const raw = computeDailyRvolAtIndex(volumes, i, window);
    data.push(Number.parseFloat(formatRvolRatio(raw)));
  }
  if (data.length === 0) return "";
  const chartConfig = {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "RVOL", data }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  };
  return buildQuickChartUrl(chartConfig);
}

/**
 * 近 `dayCount` 個交易日：每日 ATR(14) ÷ 當日收盤 × 100 的 QuickChart 柱狀圖（與即時 ATR% 定義一致，僅收盤價改為歷史收盤）。
 */
export function buildAtrPct14dTrendQuickChartUrl(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  barDates: readonly Date[],
  period: number = DEFAULT_ATR_PERIOD,
  dayCount: number = RVOL_TREND_DAY_COUNT,
): string {
  if (
    highs.length !== lows.length ||
    lows.length !== closes.length ||
    barDates.length !== closes.length ||
    closes.length < period
  ) {
    return "";
  }
  const atrPerBar = computeWilderAtrPerBar(highs, lows, closes, period);
  const L = closes.length;
  const startIndex = Math.max(period - 1, L - dayCount);
  const labels: string[] = [];
  const data: number[] = [];
  for (let i = startIndex; i < L; i += 1) {
    const d = barDates[i]!;
    labels.push(`${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
    const c = closes[i]!;
    const atr = atrPerBar[i] ?? 0;
    const pct = c > 0 && Number.isFinite(atr) ? (atr / c) * 100 : 0;
    data.push(Number.parseFloat(pct.toFixed(2)));
  }
  if (data.length === 0) return "";
  const chartConfig = {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "ATR pct", data }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  };
  return buildQuickChartUrl(chartConfig);
}

export function formatAvgRvol20d(rvolSeries: readonly number[]): string {
  if (rvolSeries.length === 0) return "0.00";
  return formatRvolRatio(average(rvolSeries));
}

/** 以 UTC 年月界定「上個日曆月」（避免與 bar 的 date 解讀不一致）。 */
function previousUtcCalendarMonth(now: Date): { year: number; month: number } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (m === 0) return { year: y - 1, month: 11 };
  return { year: y, month: m - 1 };
}

/**
 * 上個日曆月內每個交易日的 RVOL（當日量／前 window 日均量，不含當日）之平均。
 * `barDates` 須與 `volumes` 等長；索引不足或該月無完整 bar 時回傳 "0.00"。
 */
export function computeAvgRvolPreviousCalendarMonth(
  volumes: VolumeSeries,
  barDates: readonly Date[],
  window: number = DEFAULT_VOLUME_WINDOW,
): string {
  if (
    barDates.length !== volumes.length ||
    volumes.length <= window
  ) {
    return formatRvolRatio(0);
  }

  const { year: targetYear, month: targetMonth } =
    previousUtcCalendarMonth(new Date());

  const dailyRvols: number[] = [];
  for (let i = window; i < volumes.length; i += 1) {
    const d = barDates[i]!;
    if (d.getUTCFullYear() !== targetYear || d.getUTCMonth() !== targetMonth) {
      continue;
    }
    const prev = volumes.slice(i - window, i);
    const prevAvg =
      prev.length > 0
        ? prev.reduce((acc, vol) => acc + vol, 0) / prev.length
        : 0;
    const dailyRvol = prevAvg > 0 ? volumes[i]! / prevAvg : 0;
    dailyRvols.push(dailyRvol);
  }

  if (dailyRvols.length === 0) return formatRvolRatio(0);
  return formatRvolRatio(average(dailyRvols));
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
  barDates?: readonly Date[],
): ComputedLiquidityMetrics {
  const avgVol20dRaw = computeAvgVolumeLastN(volumes, window);
  const rvolSeries = computeDailyRvolSeries(volumes, window);
  return {
    avgVol20d: Math.round(avgVol20dRaw),
    rvol: computeSnapshotRvol(currentVol, avgVol20dRaw),
    avgRvol20d: formatAvgRvol20d(rvolSeries),
    avgRvolPrevMonth:
      barDates && barDates.length === volumes.length
        ? computeAvgRvolPreviousCalendarMonth(volumes, barDates, window)
        : formatRvolRatio(0),
  };
}
