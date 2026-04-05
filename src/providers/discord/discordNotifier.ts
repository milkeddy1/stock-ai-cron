import axios from "axios";
import type { StockData } from "../../domain/types.js";

export type DiscordWebhookPayload = {
  embeds: Array<{
    title: string;
    color: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    footer: { text: string };
  }>;
};

const RVOL_ALERT_THRESHOLD = 1.5;

export function buildWhalePulseEmbeds(
  dataList: StockData[],
  aiTexts: string[],
): DiscordWebhookPayload {
  const executedAt = new Date().toLocaleString();

  return {
    embeds: dataList.map((data, index) => ({
      title: `📊 WhalePulse 監控報告: ${data.symbol}`,
      color: Number(data.rvol) > RVOL_ALERT_THRESHOLD ? 0xff0000 : 0x00ff00,
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
        { name: "AI 判讀", value: aiTexts[index] ?? "" },
      ],
      footer: { text: `執行時間: ${executedAt}` },
    })),
  };
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
): Promise<void> {
  await axios.post(webhookUrl, payload);
}
