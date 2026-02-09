import type { ProviderType } from "@/lib/types";
import { type AnthropicProvider, anthropicProvider } from "./anthropic";
import { type DeepSeekProvider, deepseekProvider } from "./deepseek";
import { type GenAIProvider, genaiProvider } from "./genai";
import { type LMStudioProvider, lmStudioProvider } from "./lm-studio";
import { type MistralProvider, mistralProvider } from "./mistral";
import { type OllamaProvider, ollamaProvider } from "./ollama";
import { type OpenAIProvider, openaiProvider } from "./openai";
import {
  type OpenAICompatibleProvider,
  openaicompatibleProvider,
} from "./openaicompatible";
import { type OpenRouterProvider, openrouterProvider } from "./openrouter";
import { type TogetherProvider, togetherProvider } from "./together";
import { type XAIProvider, xaiProvider } from "./xai";

export type BaseProvider =
  | AnthropicProvider
  | OllamaProvider
  | OpenAIProvider
  | OpenAICompatibleProvider
  | TogetherProvider
  | OpenRouterProvider
  | GenAIProvider
  | DeepSeekProvider
  | XAIProvider
  | LMStudioProvider
  | MistralProvider;

/**
 * Registry mapping provider types to their singleton instances.
 * This eliminates switch statements throughout the codebase.
 */
export const providerRegistry: Record<ProviderType, BaseProvider> = {
  anthropic: anthropicProvider,
  ollama: ollamaProvider,
  openai: openaiProvider,
  openaicompatible: openaicompatibleProvider,
  together: togetherProvider,
  openrouter: openrouterProvider,
  genai: genaiProvider,
  deepseek: deepseekProvider,
  xai: xaiProvider,
  "lm-studio": lmStudioProvider,
  mistral: mistralProvider,
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
