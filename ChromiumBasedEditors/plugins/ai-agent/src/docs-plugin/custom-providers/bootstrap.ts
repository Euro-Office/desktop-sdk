import { registerProvider, unregisterProvider } from "@onlyoffice/ai-chat";
import { isDesktopEditor } from "@/shared/lib/utils";
import { loadProviders } from "./storage";
import type { CustomProviderRecord } from "./types";
import { isDesktopOnlyProvider, validateProvider } from "./validate";

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
  const result = validateProvider(record.source);
  if (!result.ok) {
    console.warn(
      `[custom-providers] "${record.name}" not registered: ${result.reason}`
    );
    return false;
  }
  if (isDesktopOnlyProvider(result.Ctor) && !isDesktopEditor()) {
    console.info(
      `[custom-providers] "${record.name}" is desktop-only — skipping registration`
    );
    return false;
  }
  const type = customProviderType(record.name);
  registerProvider(type, result.Ctor);
  registered.add(type);
  return true;
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
