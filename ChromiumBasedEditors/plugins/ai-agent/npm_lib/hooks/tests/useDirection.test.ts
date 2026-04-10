import { describe, expect, it, vi } from "vitest";

let mockLanguage = "en";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: mockLanguage },
    t: (k: string) => k,
  }),
}));

import { useDirection } from "../useDirection";

describe("useDirection", () => {
  it("returns isRTL=false and direction='ltr' for English", () => {
    mockLanguage = "en";
    const { isRTL, direction } = useDirection();
    expect(isRTL).toBe(false);
    expect(direction).toBe("ltr");
  });

  it("returns isRTL=true and direction='rtl' for Arabic (ar-SA)", () => {
    mockLanguage = "ar-SA";
    const { isRTL, direction } = useDirection();
    expect(isRTL).toBe(true);
    expect(direction).toBe("rtl");
  });

  it("returns isRTL=false for French", () => {
    mockLanguage = "fr";
    const { isRTL } = useDirection();
    expect(isRTL).toBe(false);
  });

  it("returns isRTL=false for Russian", () => {
    mockLanguage = "ru";
    const { isRTL } = useDirection();
    expect(isRTL).toBe(false);
  });
});
