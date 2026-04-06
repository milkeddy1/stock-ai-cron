import type { VolumeSeries } from "../../domain/types.js";

/** Chart API mapped to domain-friendly inputs (oldest bar first). */
export type YahooChartQuotes = {
  volumes: VolumeSeries;
  /** Session date per bar, same order and length as `volumes`. */
  barDates: readonly Date[];
};

/** Quote API mapped for liquidity + display (no Yahoo-specific field names). */
export type YahooQuoteSnapshot = {
  currentVol: number;
  price: number | null | undefined;
  /** Raw percent change for the active session (pre or regular). */
  changePercent: number;
};
