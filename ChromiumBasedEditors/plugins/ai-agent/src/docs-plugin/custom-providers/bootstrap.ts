import { registerProvider, unregisterProvider } from "@onlyoffice/ai-chat";
import { CustomProviderEvalError, instantiateProviderClass } from "./eval";
import { loadProviders } from "./storage";
import type { CustomProviderRecord } from "./types";

const CUSTOM_TYPE_PREFIX = "custom:";

const registered = new Set<string>();

export function customProviderType(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return CUSTOM_TYPE_PREFIX + (sanitized || "unnamed");
}

function tryRegister(record: CustomProviderRecord): boolean {
  const type = customProviderType(record.name);
  try {
    const Ctor = instantiateProviderClass(record.source);
    registerProvider(type, Ctor);
    registered.add(type);
    return true;
  } catch (err) {
    if (err instanceof CustomProviderEvalError) {
      console.warn(
        `[custom-providers] Skipping "${record.name}": ${err.message}`
      );
    } else {
      console.warn(`[custom-providers] Skipping "${record.name}":`, err);
    }
    return false;
  }
}

export function bootstrapCustomProviders(): void {
  for (const type of registered) unregisterProvider(type);
  registered.clear();

  for (const record of loadProviders()) tryRegister(record);
}

export function applyCustomProvidersDelta(nextNames: string[]): void {
  const nextTypes = new Set(nextNames.map(customProviderType));
  const records = loadProviders();
  const recordByType = new Map(
    records.map((r) => [customProviderType(r.name), r] as const)
  );

  for (const type of registered) {
    if (!nextTypes.has(type)) {
      unregisterProvider(type);
      registered.delete(type);
    }
  }

  for (const type of nextTypes) {
    if (registered.has(type)) continue;
    const record = recordByType.get(type);
    if (record) tryRegister(record);
  }
}
