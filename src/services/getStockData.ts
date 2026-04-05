import { computeLiquidityMetrics } from "../domain/stockMetrics.js";
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

      const { volumes } = await yahoo.fetchChartQuotes(symbol);
      const quote = await yahoo.fetchQuote(symbol);

      const metrics = computeLiquidityMetrics(volumes, quote.currentVol);

      return {
        symbol,
        price: quote.price,
        change: quote.changePercent.toFixed(2) + "%",
        currentVol: quote.currentVol,
        ...metrics,
      };
    }),
  );

  return results;
}
