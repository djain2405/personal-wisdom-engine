import { createClaudeProvider } from "./claude";
import { createGeminiProvider } from "./gemini";
import { createOpenAIProvider } from "./openai";
import {
  getConfiguredProviderName,
  type AiProvider,
  type ProviderName,
} from "./types";

/** Uses AI_PROVIDER from .env.local (claude | openai | gemini). */
export function getAiProvider(_override?: ProviderName | string | null): AiProvider {
  const name = getConfiguredProviderName();
  switch (name) {
    case "gemini":
      return createGeminiProvider();
    case "openai":
      return createOpenAIProvider();
    case "claude":
    default:
      return createClaudeProvider();
  }
}

export async function getEmbeddingProvider(): Promise<AiProvider | null> {
  if (process.env.OPENAI_API_KEY) {
    return createOpenAIProvider();
  }
  return null;
}
