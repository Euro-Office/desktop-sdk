import {
  getProvider,
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

function applyProviders(
  specs: ServerProviderSpec[],
  registered: Set<string>
): void {
  for (const type of registered) unregisterProvider(type);
  registered.clear();

  for (const spec of specs) {
    if (isSourceSpec(spec)) {
      const result = validateProvider(spec.source);
      if (!result.ok) {
        console.warn(
          `[server-state] provider "${spec.name}" not registered: ${result.reason}`
        );
        continue;
      }
      const type = customExternalProviderType(spec.name);
      registerProvider(type, result.Ctor);
      registered.add(type);
    } else {
      if (!getProvider(spec.basedOn)) {
        console.warn(
          `[server-state] provider "${spec.name}" basedOn="${spec.basedOn}" — base provider not found in registry`
        );
      }
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
