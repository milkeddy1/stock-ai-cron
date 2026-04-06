/**
 * Domain nouns: shapes used by metrics and the job layer, not Yahoo API types.
 */

/** Daily bar volumes in chronological order (oldest first). */
export type VolumeSeries = readonly number[];

/** RVOL / average-volume results from historical volumes + current session volume. */
export type ComputedLiquidityMetrics = {
  /** 20 日平均成交量（顯示用，與既有行為一致採四捨五入為整數） */
  avgVol20d: number;
  rvol: string;
  avgRvol20d: string;
  /** 上個日曆月各交易日 RVOL（當日量／前 window 日均量）之平均；資料不足時為 "0.00"。 */
  avgRvolPrevMonth: string;
};

/** 監控任務組裝後要給 AI / Discord 的標的資料。 */
export type StockData = {
  symbol: string;
  price: number | null | undefined;
  change: string;
  currentVol: number;
  avgVol20d: number;
  rvol: string;
  avgRvol20d: string;
  avgRvolPrevMonth: string;
  /** Wilder ATR(14) ÷ 當前價 × 100% 之字串（如 "3.45%"）；價格無效時為「—」。 */
  atr: string;
  /** QuickChart 柱狀圖 URL：近 14 交易日每日 RVOL（分母為前 20 日均量、不含當日）。 */
  rvol14dTrendChartUrl: string;
  /** QuickChart 柱狀圖 URL：近 14 交易日每日 ATR(14)÷收盤×100%。 */
  atr14dTrendChartUrl: string;
};
