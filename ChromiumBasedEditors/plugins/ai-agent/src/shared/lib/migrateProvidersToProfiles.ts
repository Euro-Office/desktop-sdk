import type {
  Model,
  Profile,
  ProviderType,
  TProvider,
} from "@/shared/lib/types.ts";

// Migration-specific localStorage keys (inlined — not part of the library contract)
const PROVIDERS_LOCAL_STORAGE_KEY = "providers";
const CURRENT_PROVIDER_KEY = "current-provider";
const CURRENT_MODEL_KEY = "current-model";
const DEFAULT_PROFILE_KEY = "default-profile";

import type { StorageAdapter } from "@onlyoffice/ai-chat";

type MigrationModel = {
  id: string;
  displayName: string;
  reasoning?: true;
};

type MigrationProviderInfo = {
  name: string;
  models: MigrationModel[];
};

// Snapshot of provider/model configuration at the time this migration was introduced.
// Do NOT import from info.ts — this data must remain stable regardless of future changes.
const MIGRATION_PROVIDERS: Partial<
  Record<ProviderType, MigrationProviderInfo>
> = {
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
      {
        id: "claude-sonnet-4-5",
        displayName: "Claude Sonnet 4.5",
        reasoning: true,
      },
      {
        id: "claude-opus-4-5",
        displayName: "Claude Opus 4.5",
        reasoning: true,
      },
    ],
  },
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-5.2-2025-12-11", displayName: "GPT-5.2", reasoning: true },
    ],
  },
  together: {
    name: "TogetherAI",
    models: [{ id: "deepseek-ai/DeepSeek-V3.1", displayName: "DeepSeek V3.1" }],
  },
  openrouter: {
    name: "OpenRouter",
    models: [
      { id: "openai/gpt-5.2", displayName: "GPT-5.2", reasoning: true },
      { id: "anthropic/claude-haiku-4.5", displayName: "Claude Haiku 4.5" },
      {
        id: "anthropic/claude-sonnet-4.5",
        displayName: "Claude Sonnet 4.5",
        reasoning: true,
      },
      {
        id: "anthropic/claude-opus-4.5",
        displayName: "Claude Opus 4.5",
        reasoning: true,
      },
      { id: "x-ai/grok-4", displayName: "Grok 4" },
      {
        id: "x-ai/grok-4.1-fast",
        displayName: "Grok 4.1 Fast",
        reasoning: true,
      },
      {
        id: "qwen/qwen3-235b-a22b-2507",
        displayName: "Qwen3",
        reasoning: true,
      },
      { id: "qwen/qwen3-max", displayName: "Qwen3 Max", reasoning: true },
      {
        id: "deepseek/deepseek-v3.1-terminus",
        displayName: "DeepSeek V3.1 Terminus",
        reasoning: true,
      },
      {
        id: "google/gemini-3-pro-preview",
        displayName: "Gemini 3 Pro Preview",
        reasoning: true,
      },
      {
        id: "google/gemini-3-flash-preview",
        displayName: "Gemini 3 Flash Preview",
        reasoning: true,
      },
    ],
  },
  genai: {
    name: "Google AI",
    models: [
      { id: "gemini-3-pro-preview", displayName: "Gemini 3 Pro" },
      { id: "gemini-3-flash-preview", displayName: "Gemini 3 Flash" },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    models: [
      { id: "deepseek-chat", displayName: "DeepSeek Chat" },
      { id: "deepseek-reasoner", displayName: "DeepSeek Reasoner" },
    ],
  },
  xai: {
    name: "xAI",
    models: [
      { id: "grok-4-1-fast-non-reasoning", displayName: "Grok 4.1 Fast" },
      { id: "grok-4-1-fast-reasoning", displayName: "Grok 4.1 Fast Reasoning" },
      { id: "grok-4-0709", displayName: "Grok 4" },
    ],
  },
  mistral: {
    name: "Mistral",
    models: [
      { id: "mistral-large-latest", displayName: "Mistral Large" },
      { id: "mistral-medium-latest", displayName: "Mistral Medium" },
      { id: "mistral-small-latest", displayName: "Mistral Small" },
    ],
  },
  // ollama, lm-studio, openaicompatible — skipped (local/dynamic models, unknown at migration time)
};

function isValidProvidersList(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isValidProvider(value: unknown): value is TProvider {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.baseUrl === "string" &&
    (p.key === undefined || typeof p.key === "string")
  );
}

function isValidCurrentProvider(value: unknown): value is TProvider {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.type === "string" && typeof p.baseUrl === "string";
}

function isValidCurrentModel(value: unknown): value is Model {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return typeof m.id === "string";
}

export async function migrateProvidersToProfiles(
  storage: StorageAdapter
): Promise<void> {
  const providersRaw = localStorage.getItem(PROVIDERS_LOCAL_STORAGE_KEY);

  if (!providersRaw) {
    // No providers stored — nothing to migrate, clean up stale keys just in case
    localStorage.removeItem(CURRENT_PROVIDER_KEY);
    localStorage.removeItem(CURRENT_MODEL_KEY);
    return;
  }

  try {
    const oldProviders: unknown = JSON.parse(providersRaw);

    const currentProviderRaw = localStorage.getItem(CURRENT_PROVIDER_KEY);
    const currentModelRaw = localStorage.getItem(CURRENT_MODEL_KEY);
    const currentProviderParsed: unknown = currentProviderRaw
      ? JSON.parse(currentProviderRaw)
      : null;
    const currentModelParsed: unknown = currentModelRaw
      ? JSON.parse(currentModelRaw)
      : null;

    const currentProvider = isValidCurrentProvider(currentProviderParsed)
      ? currentProviderParsed
      : null;
    const currentModel = isValidCurrentModel(currentModelParsed)
      ? currentModelParsed
      : null;

    if (!isValidProvidersList(oldProviders)) return;

    const profilesToCreate: Omit<Profile, "id" | "createdAt">[] = [];

    for (const oldProvider of oldProviders) {
      if (!isValidProvider(oldProvider)) continue;

      const info = MIGRATION_PROVIDERS[oldProvider.type];
      if (!info) continue;

      for (const model of info.models) {
        profilesToCreate.push({
          name: `${info.name} ${model.displayName}`,
          providerType: oldProvider.type,
          baseUrl: oldProvider.baseUrl,
          key: oldProvider.key,
          modelId: model.id,
          reasoning: model.reasoning,
        });
      }
    }

    profilesToCreate.sort((a, b) => a.name.localeCompare(b.name));

    const createdProfiles = await storage.profiles.createMany(profilesToCreate);

    if (
      createdProfiles.length > 0 &&
      !localStorage.getItem(DEFAULT_PROFILE_KEY)
    ) {
      let defaultProfile = createdProfiles[0];

      if (currentProvider && currentModel) {
        const matched = createdProfiles.find(
          (p) =>
            p.providerType === currentProvider.type &&
            p.baseUrl === currentProvider.baseUrl &&
            p.modelId === currentModel.id &&
            p.key === currentProvider.key
        );
        if (matched) defaultProfile = matched;
      }

      localStorage.setItem(DEFAULT_PROFILE_KEY, defaultProfile.id);
    }

    localStorage.removeItem(PROVIDERS_LOCAL_STORAGE_KEY);
    localStorage.removeItem(CURRENT_PROVIDER_KEY);
    localStorage.removeItem(CURRENT_MODEL_KEY);
  } catch {
    // Migration failed (corrupted data or IndexedDB error) — clear old keys to prevent
    // repeated failed attempts on next app start
    localStorage.removeItem(PROVIDERS_LOCAL_STORAGE_KEY);
    localStorage.removeItem(CURRENT_PROVIDER_KEY);
    localStorage.removeItem(CURRENT_MODEL_KEY);
  }
}
