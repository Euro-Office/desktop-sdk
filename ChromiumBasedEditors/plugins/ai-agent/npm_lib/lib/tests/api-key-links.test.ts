import { describe, expect, it } from "vitest";
import { getApiKeyLink } from "../api-key-links";

describe("getApiKeyLink", () => {
  it("returns correct URL for anthropic", () => {
    expect(getApiKeyLink("anthropic")).toBe(
      "https://console.anthropic.com/settings/keys",
    );
  });

  it("returns correct URL for openai", () => {
    expect(getApiKeyLink("openai")).toBe(
      "https://platform.openai.com/api-keys",
    );
  });

  it("returns correct URL for Exa", () => {
    expect(getApiKeyLink("Exa")).toBe("https://dashboard.exa.ai/api-keys");
  });

  it("returns undefined for unknown provider", () => {
    expect(getApiKeyLink("unknown-provider")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getApiKeyLink("")).toBeUndefined();
  });
});
