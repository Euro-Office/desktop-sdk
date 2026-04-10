import type { ProviderType } from "../types";
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

export type BuiltinProvider =
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

// biome-ignore lint/suspicious/noExplicitAny: custom providers can have any generic params
export type BaseProvider =
  | BuiltinProvider
  | import("./base").AbstractBaseProvider<any, any, any>;

/**
 * Built-in registry mapping provider types to their singleton instances.
 */
const builtinProviders: Record<ProviderType, BuiltinProvider> = {
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
 * Dynamic registry for custom providers added at runtime.
 */
const customProviders: Map<string, BaseProvider> = new Map();

/**
 * Register a custom provider at runtime.
 */
export const registerProvider = (
  type: string,
  provider: BaseProvider
): void => {
  customProviders.set(type, provider);
};

/**
 * Unregister a custom provider.
 */
export const unregisterProvider = (type: string): void => {
  customProviders.delete(type);
};

/**
 * Provider lookup — checks builtin first, then custom.
 */
export const getProvider = (type: string): BaseProvider | undefined => {
  return builtinProviders[type as ProviderType] ?? customProviders.get(type);
};

/**
 * Check if a provider type is supported (builtin or custom).
 */
export const isValidProviderType = (type: string): boolean => {
  return type in builtinProviders || customProviders.has(type);
};

/**
 * Get all supported provider types (builtin + custom).
 */
export const getSupportedProviderTypes = (): string[] => {
  return [...Object.keys(builtinProviders), ...customProviders.keys()];
};

// Keep backward compat export
export const providerRegistry = builtinProviders;
