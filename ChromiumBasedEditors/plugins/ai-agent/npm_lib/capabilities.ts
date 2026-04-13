export const CapabilitiesUI = {
  None: 0x00,
  Chat: 0x01,
  Image: 0x02,
  Embeddings: 0x04,
  Audio: 0x08,
  Vision: 0x80,
  Tools: 0x100,
} as const;

export type Capabilities = number;

/**
 * Infer capabilities from provider type and model ID.
 * Used to backfill profiles created before capabilities were tracked.
 */
export function inferCapabilities(
  providerType: string,
  modelId: string
): number {
  const id = modelId.toLowerCase();

  if (providerType === "openai") {
    if (id.includes("whisper") || id.includes("tts-1"))
      return CapabilitiesUI.Audio;
    if (id.includes("embedding")) return CapabilitiesUI.Embeddings;
    if (id === "dall-e-2" || id === "dall-e-3" || id.includes("-image-"))
      return CapabilitiesUI.Image;
    if (id.includes("gpt-3.5-turbo-instruct")) return CapabilitiesUI.Chat;
    return CapabilitiesUI.Chat | CapabilitiesUI.Vision;
  }

  if (providerType === "anthropic") {
    if (id.startsWith("claude-2")) return CapabilitiesUI.Chat;
    if (id.startsWith("claude-3-5-haiku")) return CapabilitiesUI.Chat;
    return CapabilitiesUI.Chat | CapabilitiesUI.Vision;
  }

  if (providerType === "mistral") {
    if (id.includes("mistral-embed")) return CapabilitiesUI.Embeddings;
    if (id.includes("pixtral"))
      return CapabilitiesUI.Chat | CapabilitiesUI.Vision;
    if (id.includes("mistral-small") || id.includes("mistral-medium"))
      return CapabilitiesUI.Chat;
    if (id.includes("codestral")) return CapabilitiesUI.Chat;
    return CapabilitiesUI.Chat;
  }

  if (providerType === "xai") {
    if (id.includes("vision"))
      return CapabilitiesUI.Chat | CapabilitiesUI.Vision;
    if (id.includes("image")) return CapabilitiesUI.Image;
    return CapabilitiesUI.Chat;
  }

  // together, openrouter — can't infer without API metadata, use broad default
  // deepseek, ollama, lm-studio, openaicompatible, genai — broad default
  return CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;
}

export const ActionType = {
  Chat: "Chat",
  Summarization: "Summarization",
  Translation: "Translation",
  TextAnalyze: "TextAnalyze",
  ImageGeneration: "ImageGeneration",
  OCR: "OCR",
  Vision: "Vision",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];
