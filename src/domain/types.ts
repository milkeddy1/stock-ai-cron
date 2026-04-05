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
};
