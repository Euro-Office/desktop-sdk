import type { ProviderConstructor } from "@onlyoffice/ai-chat";
import { instantiateProviderClass } from "./eval.ts";

export type ValidationOk = { ok: true; Ctor: ProviderConstructor };
export type ValidationFail = { ok: false; reason: string };
export type ValidationResult = ValidationOk | ValidationFail;

export function validateProvider(source: string): ValidationResult {
  try {
    const Ctor = instantiateProviderClass(source);
    return { ok: true, Ctor };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Invalid provider source",
    };
  }
}

export function isDesktopOnlyProvider(Ctor: ProviderConstructor): boolean {
  const fn = (Ctor as unknown as { isDesktopOnly?: () => boolean })
    .isDesktopOnly;
  return typeof fn === "function" && fn() === true;
}
