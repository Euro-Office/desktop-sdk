import {
  getProvider,
  registerProvider,
  unregisterProvider,
} from "@onlyoffice/ai-chat";
import { isDesktopEditor } from "@/shared/lib/utils.ts";
import type { IndexedDBStorage } from "@/shared/storage/indexeddb/index.ts";
// import { crossPluginBus } from "@/shared/sync/crossPluginBus.ts";
import type { CustomProviderRecord } from "./types.ts";
import { isDesktopOnlyProvider, validateProvider } from "./validate.ts";

const CUSTOM_INTERNAL_TYPE_PREFIX = "custom-internal:";

const registered = new Set<string>();

export function customInternalProviderType(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return CUSTOM_INTERNAL_TYPE_PREFIX + (sanitized || "unnamed");
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
  const type = customInternalProviderType(record.name);
  registerProvider(type, result.Ctor);
  registered.add(type);
  return true;
}

export async function bootstrapCustomProviders(
  storage: IndexedDBStorage
): Promise<void> {
  for (const type of registered) unregisterProvider(type);
  registered.clear();

  const records = await storage.customProviders.getAll();
  for (const record of records) tryRegister(record);
}

export type RegisterCustomProviderResult =
  | { ok: true; type: string; name: string }
  | { ok: false; reason: string };

export async function registerCustomProvider(
  storage: IndexedDBStorage,
  source: string
): Promise<RegisterCustomProviderResult> {
  const result = validateProvider(source);
  if (!result.ok) return { ok: false, reason: result.reason };

  const Ctor = result.Ctor;
  const name = Ctor.getName().trim();
  if (!name) {
    return {
      ok: false,
      reason: "Provider class returned an empty getName()",
    };
  }

  const type = customInternalProviderType(name);
  if (getProvider(type)) {
    return {
      ok: false,
      reason: `Provider '${name}' is already registered`,
    };
  }

  if (isDesktopOnlyProvider(Ctor) && !isDesktopEditor()) {
    return {
      ok: false,
      reason: `Provider '${name}' is desktop-only and cannot be used in the web editor`,
    };
  }

  await storage.customProviders.upsert({
    name,
    source,
    createdAt: Date.now(),
  });

  registerProvider(type, Ctor);
  registered.add(type);

  // const records = await storage.customProviders.getAll();
  // crossPluginBus.publish("customProvidersUpdated", {
  //   providers: records.map((r) => r.name),
  // });

  return { ok: true, type, name };
}

export async function applyCustomProvidersDelta(
  storage: IndexedDBStorage,
  nextNames: string[]
): Promise<void> {
  const nextTypes = new Set(nextNames.map(customInternalProviderType));
  const records = await storage.customProviders.getAll();
  const recordByType = new Map(
    records.map((r) => [customInternalProviderType(r.name), r] as const)
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
