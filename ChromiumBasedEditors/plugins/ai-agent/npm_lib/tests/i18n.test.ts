import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInit = vi.fn();
const mockUse = vi.fn().mockReturnThis();

vi.mock("i18next", () => ({
  default: { use: mockUse, init: mockInit },
}));

vi.mock("react-i18next", () => ({
  initReactI18next: "initReactI18next-mock",
}));

describe("initAIChatI18n", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUse.mockReturnThis();
  });

  it("calls i18n.use and i18n.init", async () => {
    const { initAIChatI18n } = await import("../i18n");
    await initAIChatI18n();

    expect(mockUse).toHaveBeenCalledWith("initReactI18next-mock");
    expect(mockInit).toHaveBeenCalledOnce();
  });

  it("uses fallbackLng 'en' by default", async () => {
    const { initAIChatI18n } = await import("../i18n");
    await initAIChatI18n();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackLng: "en" })
    );
  });

  it("passes lng when locale option is provided", async () => {
    const { initAIChatI18n } = await import("../i18n");
    await initAIChatI18n({ locale: "ru" });

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ lng: "ru" })
    );
  });

  it("merges custom resources with loaded locales", async () => {
    const { initAIChatI18n } = await import("../i18n");
    const custom = { "ko-KR": { translation: { hello: "world" } } };
    await initAIChatI18n({ resources: custom });

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: expect.objectContaining({
          en: expect.objectContaining({ translation: expect.any(Object) }),
          "ko-KR": { translation: { hello: "world" } },
        }),
      })
    );
  });

  it("does not re-initialize on second call", async () => {
    const { initAIChatI18n } = await import("../i18n");
    await initAIChatI18n();
    await initAIChatI18n({ locale: "fr" });

    expect(mockInit).toHaveBeenCalledOnce();
  });

  it("exports bundledLocaleKeys with all locale keys", async () => {
    const { bundledLocaleKeys } = await import("../i18n");

    expect(Array.isArray(bundledLocaleKeys)).toBe(true);
    expect(bundledLocaleKeys).toContain("en");
    expect(bundledLocaleKeys).toContain("ru");
    expect(bundledLocaleKeys).toContain("ar-SA");
  });
});
