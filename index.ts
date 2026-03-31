import "dotenv/config";
import YahooFinance from "yahoo-finance2";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

type StockData = {
  symbol: string;
  price: number | null | undefined;
  change: string;
  currentVol: number;
  avgVol20d: number;
  rvol: string;
  avgRvol20d: string;
};

// 1. 初始化 Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function getStockData(symbols: string | string[]): Promise<StockData[]> {
  const yahooFinance = new YahooFinance({
    suppressNotices: ["yahooSurvey"], // optional
  });
  const symbolList = Array.isArray(symbols) ? symbols : [symbols];

  const results = await Promise.all(
    symbolList.map(async (symbol) => {
      console.log(`正在抓取 ${symbol} 的數據...`);

      // 1. 手動計算 60 天前的日期作為 period1（要算 20 日平均 RVOL 需要更長資料）
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const chartData = await yahooFinance.chart(symbol, {
        period1: sixtyDaysAgo, // 傳入 Date 物件，套件會自動轉成 timestamp
        interval: "1d",
      });
      const quotes = chartData.quotes ?? [];

      // 取最後 20 筆成交量算平均
      const last20Days = quotes.slice(-20);
      const avgVol20d =
        last20Days.length > 0
          ? last20Days.reduce((acc, day) => acc + (day.volume || 0), 0) /
            last20Days.length
          : 0;

      // 計算「20 日平均 RVOL」：最近 20 天中，每天成交量 / 該日前 20 天均量，再取平均
      const volumes = quotes.map((q) => q.volume || 0);
      const rvolSeries: number[] = [];
      const startIndex = Math.max(20, volumes.length - 20);
      for (let i = startIndex; i < volumes.length; i += 1) {
        const prev20 = volumes.slice(i - 20, i);
        const prev20Avg =
          prev20.length > 0
            ? prev20.reduce((acc, vol) => acc + vol, 0) / prev20.length
            : 0;
        const dailyRvol = prev20Avg > 0 ? volumes[i] / prev20Avg : 0;
        rvolSeries.push(dailyRvol);
      }
      const avgRvol20d =
        rvolSeries.length > 0
          ? (
              rvolSeries.reduce((acc, v) => acc + v, 0) / rvolSeries.length
            ).toFixed(2)
          : "0.00";

      // 2. 獲取即時數據 (含盤前)
      // yahoo-finance2 的 quote 依然可用，它是彙整後的即時數據
      const quote = await yahooFinance.quote(symbol);

      // 關鍵：在盤前時間，regularMarketVolume 通常是 0 或尚未更新
      // 我們需要檢查是否有 preMarketVolume
      const currentVol = quote.preMarketVolume || quote.regularMarketVolume || 0;
      const price = quote.preMarketPrice || quote.regularMarketPrice;
      const change =
        quote.preMarketChangePercent || quote.regularMarketChangePercent || 0;

      const rvol = avgVol20d > 0 ? (currentVol / avgVol20d).toFixed(2) : "0.00";

      return {
        symbol,
        price,
        change: change.toFixed(2) + "%",
        currentVol,
        avgVol20d: Math.round(avgVol20d),
        rvol,
        avgRvol20d,
      };
    }),
  );

  return results;
}

async function runMonitor() {
  try {
    // keep `model` referenced to avoid accidental dead code elimination warnings
    void model;
    void genAI;

    // --- 第一步：抓取數據 ---
    const symbols = ["FLNC", "LEU", "NVX", "APLD", "LAC"]; // 你可以換成任何個股
    const dataList = await getStockData(symbols);

    // --- 第二步：把數據餵給 AI ---
    const prompts = dataList.map(
      (data) => `
            你是一個專業的美股分析助手。以下是 ${data.symbol} 的即時數據：
            - 當前價格: ${data.price}
            - 漲跌幅: ${data.change}
            - 當前成交量: ${data.currentVol}
            - 20日平均成交量: ${data.avgVol20d}
            - 相對成交量 (RVOL): ${data.rvol}
            - 20日平均 RVOL: ${data.avgRvol20d}
            
            請根據 RVOL 指標（若大於 1.5 代表異常放量）簡單分析是否有機構進場跡象，並用 100 字以內的正體中文總結建議。
        `,
    );
    const aiResponses = await Promise.all(prompts.map(getAiAnalysis));

    // --- 第三步：透過 Webhook 送到 Discord ---
    const discordPayload = {
      embeds: dataList.map((data, index) => ({
        title: `📊 WhalePulse 監控報告: ${data.symbol}`,
        color: Number(data.rvol) > 1.5 ? 0xff0000 : 0x00ff00, // 高 RVOL 顯示紅色
        fields: [
          {
            name: "價格 / 漲跌",
            value: `${data.price} (${data.change})`,
            inline: true,
          },
          { name: "RVOL", value: data.rvol.toString(), inline: true },
          {
            name: "20日平均 RVOL",
            value: data.avgRvol20d.toString(),
            inline: true,
          },
          {
            name: "當前成交量",
            value: data.currentVol.toString(),
            inline: true,
          },
          {
            name: "20日平均成交量",
            value: data.avgVol20d.toString(),
            inline: true,
          },
          { name: "AI 判讀", value: aiResponses[index] },
        ],
        footer: { text: `執行時間: ${new Date().toLocaleString()}` },
      })),
    };

    await axios.post(process.env.DISCORD_WEBHOOK_URL || "", discordPayload);
    console.log("✅ 報告已成功送到 Discord！");
  } catch (error) {
    console.error("❌ 發生錯誤:", error);
  }
}

async function getAiAnalysis(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  return response.text || "";
}

runMonitor();
