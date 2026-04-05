import YahooFinance from "yahoo-finance2";
import type { YahooChartQuotes, YahooQuoteSnapshot } from "./types.js";

/** Matches prior `getStockData` chart window (enough bars for 20d RVOL stats). */
const DEFAULT_CHART_LOOKBACK_DAYS = 60;

/** Aligns with `yahoo-finance2` NOTICE_IDS for `suppressNotices`. */
type YahooNoticeId = "yahooSurvey" | "ripHistorical";

const DEFAULT_SUPPRESS_NOTICES: YahooNoticeId[] = ["yahooSurvey"];

export type YahooClient = {
  fetchChartQuotes: (symbol: string) => Promise<YahooChartQuotes>;
  fetchQuote: (symbol: string) => Promise<YahooQuoteSnapshot>;
};

export function createYahooClient(options?: {
  suppressNotices?: YahooNoticeId[];
}): YahooClient {
  const yf = new YahooFinance({
    suppressNotices: options?.suppressNotices ?? DEFAULT_SUPPRESS_NOTICES,
  });

  return {
    async fetchChartQuotes(symbol: string): Promise<YahooChartQuotes> {
      const period1 = new Date();
      period1.setDate(period1.getDate() - DEFAULT_CHART_LOOKBACK_DAYS);
      const chartData = await yf.chart(symbol, {
        period1,
        interval: "1d",
      });
      const quotes = chartData.quotes ?? [];
      const volumes = quotes.map((q) => q.volume || 0);
      return { volumes };
    },

    async fetchQuote(symbol: string): Promise<YahooQuoteSnapshot> {
      const quote = await yf.quote(symbol);
      return {
        currentVol:
          quote.preMarketVolume || quote.regularMarketVolume || 0,
        price: quote.preMarketPrice || quote.regularMarketPrice,
        changePercent:
          quote.preMarketChangePercent ||
          quote.regularMarketChangePercent ||
          0,
      };
    },
  };
}
