import {
  buildAtrPct14dTrendQuickChartUrl,
  buildRvol14dTrendQuickChartUrl,
  computeLatestWilderAtr,
  computeLiquidityMetrics,
  DEFAULT_VOLUME_WINDOW,
  formatAtrPercentOfPrice,
} from "../domain/stockMetrics.js";
import type { StockData } from "../domain/types.js";
import type { YahooClient } from "../providers/yahoo/index.js";

/**
 * Fetches chart + quote via Yahoo, runs domain liquidity metrics, returns `StockData`.
 */
export async function getStockData(
  yahoo: YahooClient,
  symbols: string | string[],
): Promise<StockData[]> {
  const symbolList = Array.isArray(symbols) ? symbols : [symbols];

  const results = await Promise.all(
    symbolList.map(async (symbol) => {
      console.log(`正在抓取 ${symbol} 的數據...`);

      const { volumes, barDates, highs, lows, closes } =
        await yahoo.fetchChartQuotes(symbol);
      const quote = await yahoo.fetchQuote(symbol);

      const metrics = computeLiquidityMetrics(
        volumes,
        quote.currentVol,
        DEFAULT_VOLUME_WINDOW,
        barDates,
      );

      const atrRaw = computeLatestWilderAtr(highs, lows, closes);
      const atr = formatAtrPercentOfPrice(atrRaw, quote.price);
      const rvol14dTrendChartUrl = buildRvol14dTrendQuickChartUrl(
        volumes,
        barDates,
        DEFAULT_VOLUME_WINDOW,
      );
      const atr14dTrendChartUrl = buildAtrPct14dTrendQuickChartUrl(
        highs,
        lows,
        closes,
        barDates,
      );

      return {
        symbol,
        price: quote.price,
        change: quote.changePercent.toFixed(2) + "%",
        currentVol: quote.currentVol,
        ...metrics,
        atr,
        rvol14dTrendChartUrl,
        atr14dTrendChartUrl,
      };
    }),
  );

  return results;
}
