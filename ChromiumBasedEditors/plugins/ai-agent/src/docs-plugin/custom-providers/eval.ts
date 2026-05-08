import type { ProviderConstructor } from "@onlyoffice/ai-chat";
import { AbstractBaseProvider } from "@onlyoffice/ai-chat";
import { mapFetchError, ProviderErrors } from "@onlyoffice/ai-chat/providers";

const SDK_EXPORTS = {
  AbstractBaseProvider,
  ProviderErrors,
  mapFetchError,
} as const;

export class CustomProviderEvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomProviderEvalError";
  }
}

export function instantiateProviderClass(source: string): ProviderConstructor {
  let Ctor: unknown;
  try {
    const factory = new Function(
      "sdk",
      `"use strict";\nconst { AbstractBaseProvider, ProviderErrors, mapFetchError } = sdk;\n${source}`
    ) as (sdk: typeof SDK_EXPORTS) => unknown;
    Ctor = factory(SDK_EXPORTS);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new CustomProviderEvalError(
      `Failed to evaluate provider source: ${detail}`
    );
  }

  if (typeof Ctor !== "function") {
    throw new CustomProviderEvalError(
      "Provider file must end with `return Provider;` returning the class constructor."
    );
  }

  const proto = (Ctor as { prototype?: unknown }).prototype;
  if (!proto || !(proto instanceof AbstractBaseProvider)) {
    throw new CustomProviderEvalError(
      "Provider class must extend `AbstractBaseProvider`."
    );
  }

  for (const method of [
    "getName",
    "getBaseUrl",
    "checkProvider",
    "getProviderModels",
  ] as const) {
    if (
      typeof (Ctor as unknown as Record<string, unknown>)[method] !== "function"
    ) {
      throw new CustomProviderEvalError(
        `Provider class is missing required static method \`${method}\`.`
      );
    }
  }

  return Ctor as ProviderConstructor;
}
