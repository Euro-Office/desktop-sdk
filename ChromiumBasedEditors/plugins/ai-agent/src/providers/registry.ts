import type { ProviderType } from "@/lib/types";
import { type AnthropicProvider, anthropicProvider } from "./anthropic";
import { type GenAIProvider, genaiProvider } from "./genai";
import { type OllamaProvider, ollamaProvider } from "./ollama";
import { type OpenAIProvider, openaiProvider } from "./openai";
import { type OpenRouterProvider, openrouterProvider } from "./openrouter";
import { type TogetherProvider, togetherProvider } from "./together";

export type BaseProvider =
  | AnthropicProvider
  | OllamaProvider
  | OpenAIProvider
  | TogetherProvider
  | OpenRouterProvider
  | GenAIProvider;

/**
 * Registry mapping provider types to their singleton instances.
 * This eliminates switch statements throughout the codebase.
 */
export const providerRegistry: Record<ProviderType, BaseProvider> = {
  anthropic: anthropicProvider,
  ollama: ollamaProvider,
  openai: openaiProvider,
  together: togetherProvider,
  openrouter: openrouterProvider,
  genai: genaiProvider,
};

/**
 * Type-safe provider lookup.
 * Returns undefined for invalid types instead of throwing.
 */
export const getProvider = (type: ProviderType): BaseProvider | undefined => {
  return providerRegistry[type];
};

/**
 * Check if a provider type is supported.
 */
export const isValidProviderType = (type: string): type is ProviderType => {
  return type in providerRegistry;
};

/**
 * Get all supported provider types.
 */
export const getSupportedProviderTypes = (): ProviderType[] => {
  return Object.keys(providerRegistry) as ProviderType[];
};
