import { describe, expect, it } from "vitest";
import {
  customExternalProviderType,
  customInternalProviderType,
  isCustomExternalProviderType,
  isCustomInternalProviderType,
  sanitizeProviderTypeName,
} from "../providerType.ts";

describe("sanitizeProviderTypeName", () => {
  it("lowercases and dashes non-alphanumerics", () => {
    expect(sanitizeProviderTypeName("Foo Bar")).toBe("foo-bar");
    expect(sanitizeProviderTypeName("Acme/Provider!")).toBe("acme-provider");
  });

  it("trims leading/trailing dashes", () => {
    expect(sanitizeProviderTypeName("  --Foo--  ")).toBe("foo");
  });

  it("falls back to 'unnamed' on empty", () => {
    expect(sanitizeProviderTypeName("")).toBe("unnamed");
    expect(sanitizeProviderTypeName("!!!")).toBe("unnamed");
  });
});

describe("customInternalProviderType / customExternalProviderType", () => {
  it("uses distinct prefixes", () => {
    expect(customInternalProviderType("Foo")).toBe("custom-internal:foo");
    expect(customExternalProviderType("Foo")).toBe("custom-external:foo");
  });

  it("type guards match", () => {
    expect(isCustomInternalProviderType("custom-internal:x")).toBe(true);
    expect(isCustomInternalProviderType("custom-external:x")).toBe(false);
    expect(isCustomExternalProviderType("custom-external:x")).toBe(true);
    expect(isCustomExternalProviderType("custom-internal:x")).toBe(false);
  });
});
