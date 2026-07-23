import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, GenerateArgs } from "./types";

export function createClaudeProvider(): AiProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const client = new Anthropic({ apiKey });

  return {
    name: "claude",
    async generate({ system, prompt, maxTokens = 2048 }: GenerateArgs) {
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });
      const block = message.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text : "";
    },
  };
}
