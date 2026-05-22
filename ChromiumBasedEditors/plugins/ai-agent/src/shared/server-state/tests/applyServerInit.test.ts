import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@onlyoffice/ai-chat", () => ({
  getProvider: vi.fn(),
  registerProvider: vi.fn(),
  unregisterProvider: vi.fn(),
}));

vi.mock("@/shared/custom-providers/validate.ts", () => ({
  validateProvider: vi.fn(),
}));

import {
  getProvider,
  registerProvider,
  unregisterProvider,
} from "@onlyoffice/ai-chat";
import { validateProvider } from "@/shared/custom-providers/validate.ts";
import { applyServerInit, applyServerProviders } from "../applyServerInit.ts";
import { RuntimeOverlayStorage } from "../RuntimeOverlayStorage.ts";

function makeStorage(): RuntimeOverlayStorage {
  const passthrough = {} as never;
  return new RuntimeOverlayStorage({
    profiles: {} as never,
    assignments: {} as never,
    threads: passthrough,
    messages: passthrough,
    prompts: passthrough,
    promptFolders: passthrough,
    preferences: passthrough,
    mcpServers: passthrough,
    toolPrefs: passthrough,
    webSearch: passthrough,
    attachments: passthrough,
    init: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  });
}

describe("applyServerInit / applyServerProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a source-based provider under the custom-external prefix", () => {
    const Ctor = class {} as never;
    (validateProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: true,
      Ctor,
    });

    const registered = new Set<string>();
    applyServerInit(
      makeStorage(),
      { providers: [{ name: "Foo Bar", source: "..." }] },
      registered
    );

    expect(registerProvider).toHaveBeenCalledWith(
      "custom-external:foo-bar",
      Ctor
    );
    expect(registered.has("custom-external:foo-bar")).toBe(true);
  });

  it("registers basedOn provider as a named alias of the base class", () => {
    // biome-ignore lint/complexity/noStaticOnlyClass: stand-in for a ProviderConstructor — the alias subclasses it, so a real class is needed.
    class BaseCtor {
      static getName() {
        return "BaseCtor";
      }
    }
    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue(BaseCtor);

    const registered = new Set<string>();
    applyServerInit(
      makeStorage(),
      { providers: [{ name: "Acme Hosted", basedOn: "openai" }] },
      registered
    );

    expect(registerProvider).toHaveBeenCalledWith(
      "custom-external:acme-hosted",
      expect.any(Function)
    );
    const [, registeredCtor] = (registerProvider as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [string, { getName(): string }];
    expect(registeredCtor.getName()).toBe("Acme Hosted");
    expect(Object.getPrototypeOf(registeredCtor)).toBe(BaseCtor);
    expect(registered.has("custom-external:acme-hosted")).toBe(true);
  });

  it("skips basedOn provider when base class is missing", () => {
    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const registered = new Set<string>();
    applyServerInit(
      makeStorage(),
      { providers: [{ name: "Mystery", basedOn: "no-such" as never }] },
      registered
    );

    expect(registerProvider).not.toHaveBeenCalled();
    expect(registered.size).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it("re-init unregisters previously registered external providers", () => {
    const Ctor = class {} as never;
    (validateProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: true,
      Ctor,
    });

    const registered = new Set<string>();
    applyServerInit(
      makeStorage(),
      { providers: [{ name: "Old", source: "..." }] },
      registered
    );
    expect(registered.has("custom-external:old")).toBe(true);

    applyServerInit(
      makeStorage(),
      { providers: [{ name: "New", source: "..." }] },
      registered
    );

    expect(unregisterProvider).toHaveBeenCalledWith("custom-external:old");
    expect(registered.has("custom-external:old")).toBe(false);
    expect(registered.has("custom-external:new")).toBe(true);
  });

  it("applyServerProviders does not touch profiles/assignments", () => {
    const Ctor = class {} as never;
    (validateProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: true,
      Ctor,
    });

    const storage = makeStorage();
    const spy = vi.spyOn(storage, "applyServerSnapshot");

    applyServerProviders(
      { providers: [{ name: "X", source: "..." }] },
      new Set()
    );

    expect(spy).not.toHaveBeenCalled();
    expect(registerProvider).toHaveBeenCalledWith("custom-external:x", Ctor);
  });
});
