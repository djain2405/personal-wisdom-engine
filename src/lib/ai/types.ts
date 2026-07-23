export type GenerateArgs = {
  system: string;
  prompt: string;
  maxTokens?: number;
};

export type AiProvider = {
  name: string;
  generate: (args: GenerateArgs) => Promise<string>;
  embed?: (text: string) => Promise<number[]>;
};

export type ProviderName = "claude" | "gemini" | "openai";

export function getConfiguredProviderName(): ProviderName {
  const raw = (process.env.AI_PROVIDER || "claude").toLowerCase();
  if (raw === "gemini" || raw === "openai" || raw === "claude") return raw;
  return "claude";
}
