import OpenAI from "openai";
import type { AiProvider, GenerateArgs } from "./types";

export function createOpenAIProvider(): AiProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const client = new OpenAI({ apiKey });

  return {
    name: "openai",
    async generate({ system, prompt, maxTokens = 2048 }: GenerateArgs) {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });
      return completion.choices[0]?.message?.content ?? "";
    },
    async embed(text: string) {
      const res = await client.embeddings.create({
        model: "text-embedding-3-large",
        dimensions: 1536,
        input: text,
      });
      return res.data[0]?.embedding ?? [];
    },
  };
}
