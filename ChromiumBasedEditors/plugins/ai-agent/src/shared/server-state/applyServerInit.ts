import {
  getProvider,
  type ProviderConstructor,
  registerProvider,
  unregisterProvider,
} from "@onlyoffice/ai-chat";
import { validateProvider } from "@/shared/custom-providers/validate.ts";
import { customExternalProviderType } from "@/shared/lib/providerType.ts";
import type { RuntimeOverlayStorage } from "./RuntimeOverlayStorage.ts";
import type {
  ServerInitPayload,
  ServerProviderSpec,
  ServerProvidersPayload,
} from "./types.ts";

function isSourceSpec(
  spec: ServerProviderSpec
): spec is { name: string; source: string } {
  return "source" in spec && typeof spec.source === "string";
}

function makeNamedAlias(
  baseCtor: ProviderConstructor,
  displayName: string
): ProviderConstructor {
  const Base = baseCtor as unknown as new (...args: unknown[]) => object;
  class Alias extends Base {}
  Object.defineProperty(Alias, "getName", {
    value: () => displayName,
    configurable: true,
    writable: true,
  });
  return Alias as unknown as ProviderConstructor;
}

function applyProviders(
  specs: ServerProviderSpec[],
  registered: Set<string>
): void {
  for (const type of registered) unregisterProvider(type);
  registered.clear();

  for (const spec of specs) {
    const type = customExternalProviderType(spec.name);
    if (isSourceSpec(spec)) {
      const result = validateProvider(spec.source);
      if (!result.ok) {
        console.warn(
          `[server-state] provider "${spec.name}" not registered: ${result.reason}`
        );
        continue;
      }
      registerProvider(type, result.Ctor);
      registered.add(type);
    } else {
      // basedOn: register an alias of the existing provider class so the
      // server-injected provider appears as a distinct entry in the UI
      // dropdown — matches the legacy AI.addExternalProvider behavior.
      const baseCtor = getProvider(spec.basedOn);
      if (!baseCtor) {
        console.warn(
          `[server-state] provider "${spec.name}" basedOn="${spec.basedOn}" — base provider not found in registry`
        );
        continue;
      }
      registerProvider(type, makeNamedAlias(baseCtor, spec.name));
      registered.add(type);
    }
  }
}

export function applyServerInit(
  storage: RuntimeOverlayStorage,
  payload: ServerInitPayload,
  registered: Set<string>
): void {
  applyProviders(payload.providers ?? [], registered);
  storage.applyServerSnapshot({
    profiles: payload.profiles ?? [],
    assignments: payload.assignments ?? {},
    override: payload.assignmentsOverride ?? true,
  });
}

export function applyServerProviders(
  payload: ServerProvidersPayload,
  registered: Set<string>
): void {
  applyProviders(payload.providers ?? [], registered);
}
