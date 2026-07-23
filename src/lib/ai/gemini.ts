import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiProvider, GenerateArgs } from "./types";

export function createGeminiProvider(): AiProvider {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }
  const client = new GoogleGenerativeAI(apiKey);

  return {
    name: "gemini",
    async generate({ system, prompt, maxTokens = 2048 }: GenerateArgs) {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: system,
        generationConfig: { maxOutputTokens: maxTokens },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    },
  };
}
