import type { StockData } from "../domain/types.js";
import { createGeminiClient } from "../providers/gemini/index.js";
import {
  buildWhalePulseEmbeds,
  sendDiscordWebhook,
} from "../providers/discord/index.js";
import { createYahooClient } from "../providers/yahoo/index.js";
import { getStockData } from "../services/getStockData.js";

const DEFAULT_SYMBOLS = ["FLNC", "LEU", "NVX", "APLD", "LAC", "USAR"] as const;

function parseWatchlist(): string[] {
  const raw = process.env.WATCHLIST;
  if (!raw?.trim()) return [...DEFAULT_SYMBOLS];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Each ticker uses `DISCORD_WEBHOOK_<SYMBOL>` (e.g. DISCORD_WEBHOOK_FLNC). */
function getDiscordWebhookUrlForSymbol(symbol: string): string {
  const key = `DISCORD_WEBHOOK_${symbol.toUpperCase()}`;
  const url = process.env[key]?.trim() ?? "";
  if (!url) {
    throw new Error(
      `Missing Discord webhook for ${symbol}: set ${key} in the environment`,
    );
  }
  return url;
}

function buildWhalePulsePrompt(data: StockData): string {
  return `
            你是一個專業的美股分析助手。以下是 ${data.symbol} 的即時數據：
            - 當前價格: ${data.price}
            - 漲跌幅: ${data.change}
            - 當前成交量: ${data.currentVol}
            - 20日平均成交量: ${data.avgVol20d}
            - ATR (14) 占現價比例: ${data.atr}
            - 相對成交量 (RVOL): ${data.rvol}
            - 20日平均 RVOL: ${data.avgRvol20d}
            - 上個月平均 RVOL: ${data.avgRvolPrevMonth}
            
            請根據 RVOL 指標（若大於 1.5 代表異常放量）簡單分析是否有機構進場跡象，並用 100 字以內的正體中文總結建議。
        `;
}

/**
 * 抓取 Yahoo → 流動性指標 → Gemini → Discord Webhook。
 */
export async function whalePulseJob(disableAi: boolean = false): Promise<void> {
  try {
    const geminiKey = process.env.GEMINI_API_KEY ?? "";

    const yahoo = createYahooClient();
    const gemini = createGeminiClient({ apiKey: geminiKey });

    const symbols = parseWatchlist();
    const dataList = await getStockData(yahoo, symbols);

    const prompts = dataList.map(buildWhalePulsePrompt);
    const aiResponses = disableAi
      ? prompts.map(() => "disabled")
      : await Promise.all(prompts.map((p) => gemini.generateAnalysis(p)));

    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i]!;
      const webhookUrl = getDiscordWebhookUrlForSymbol(data.symbol);
      const discordPayload = buildWhalePulseEmbeds([data], [aiResponses[i]!]);
      await sendDiscordWebhook(webhookUrl, discordPayload);
    }

    console.log("✅ 報告已成功送到 Discord！");
  } catch (error) {
    console.error("❌ 發生錯誤:", error);
    throw error;
  }
}
