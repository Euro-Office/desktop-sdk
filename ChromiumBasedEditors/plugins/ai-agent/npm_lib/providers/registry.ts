import type { ProviderType } from "../types";
import { AnthropicProvider, anthropicProvider } from "./anthropic";
import { DeepSeekProvider, deepseekProvider } from "./deepseek";
import { GenAIProvider, genaiProvider } from "./genai";
import { LMStudioProvider, lmStudioProvider } from "./lm-studio";
import { MistralProvider, mistralProvider } from "./mistral";
import { OllamaProvider, ollamaProvider } from "./ollama";
import { OpenAIProvider, openaiProvider } from "./openai";
import {
  OpenAICompatibleProvider,
  openaicompatibleProvider,
} from "./openaicompatible";
import { OpenRouterProvider, openrouterProvider } from "./openrouter";
import { TogetherProvider, togetherProvider } from "./together";
import { XAIProvider, xaiProvider } from "./xai";

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

/**
 * Factory map for creating new (non-singleton) provider instances.
 */
const builtinFactories: Record<ProviderType, () => BuiltinProvider> = {
  anthropic: () => new AnthropicProvider(),
  ollama: () => new OllamaProvider(),
  openai: () => new OpenAIProvider(),
  openaicompatible: () => new OpenAICompatibleProvider(),
  together: () => new TogetherProvider(),
  openrouter: () => new OpenRouterProvider(),
  genai: () => new GenAIProvider(),
  deepseek: () => new DeepSeekProvider(),
  xai: () => new XAIProvider(),
  "lm-studio": () => new LMStudioProvider(),
  mistral: () => new MistralProvider(),
};

/**
 * Create a new provider instance (not the shared singleton).
 * Returns undefined for unknown types.
 */
export const createProvider = (type: string): BaseProvider | undefined => {
  const factory = builtinFactories[type as ProviderType];
  return factory?.();
};

// Keep backward compat export
export const providerRegistry = builtinProviders;
