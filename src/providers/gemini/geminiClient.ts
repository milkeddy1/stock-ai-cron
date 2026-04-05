import { GoogleGenAI } from "@google/genai";

export type GeminiClient = {
  generateAnalysis(prompt: string): Promise<string>;
};

export function createGeminiClient(options: {
  apiKey: string;
  model?: string;
}): GeminiClient {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const model = options.model ?? "gemini-2.5-flash";

  return {
    async generateAnalysis(prompt: string) {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text ?? "";
    },
  };
}
