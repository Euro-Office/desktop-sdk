import { describe, expect, it } from "vitest";
import type { ProviderType } from "@/lib/types";
import {
  getProvider,
  getSupportedProviderTypes,
  isValidProviderType,
  providerRegistry,
} from "../registry";

describe("Provider Registry", () => {
  describe("providerRegistry", () => {
    it("should contain all supported providers", () => {
      const expectedProviders = [
        "anthropic",
        "ollama",
        "openai",
        "together",
        "openrouter",
        "genai",
        "xai",
        "lm-studio",
      ];

      const registryKeys = Object.keys(providerRegistry);

      expectedProviders.forEach((provider) => {
        expect(registryKeys).toContain(provider);
      });
    });

    it("should have provider instances with required methods", () => {
      Object.values(providerRegistry).forEach((provider) => {
        expect(provider).toBeDefined();
        expect(provider.getName).toBeDefined();
        expect(provider.getBaseUrl).toBeDefined();
        expect(provider.setProvider).toBeDefined();
        expect(provider.checkProvider).toBeDefined();
        expect(provider.getProviderModels).toBeDefined();
        expect(provider.sendMessage).toBeDefined();
      });
    });

    it("should return correct provider for anthropic", () => {
      const provider = providerRegistry.anthropic;
      expect(provider).toBeDefined();
      expect(provider.getName()).toBe("Anthropic");
    });

    it("should return correct provider for openai", () => {
      const provider = providerRegistry.openai;
      expect(provider).toBeDefined();
      expect(provider.getName()).toBe("OpenAI");
    });

    it("should return correct provider for ollama", () => {
      const provider = providerRegistry.ollama;
      expect(provider).toBeDefined();
      expect(provider.getName()).toBe("Ollama");
    });

    it("should return correct provider for lm-studio", () => {
      const provider = providerRegistry["lm-studio"];
      expect(provider).toBeDefined();
      expect(provider.getName()).toBe("LM Studio");
    });
  });

  describe("getProvider", () => {
    it("should return provider instance for valid type", () => {
      const provider = getProvider("anthropic");
      expect(provider).toBeDefined();
      expect(provider?.getName()).toBe("Anthropic");
    });

    it("should return provider for all supported types", () => {
      const types: ProviderType[] = [
        "anthropic",
        "ollama",
        "openai",
        "together",
        "openrouter",
        "genai",
        "xai",
        "lm-studio",
      ];

      types.forEach((type) => {
        const provider = getProvider(type);
        expect(provider).toBeDefined();
        expect(typeof provider?.getName()).toBe("string");
      });
    });

    it("should return undefined for invalid type", () => {
      const provider = getProvider("invalid" as ProviderType);
      expect(provider).toBeUndefined();
    });
  });

  describe("isValidProviderType", () => {
    it("should return true for valid provider types", () => {
      expect(isValidProviderType("anthropic")).toBe(true);
      expect(isValidProviderType("openai")).toBe(true);
      expect(isValidProviderType("ollama")).toBe(true);
      expect(isValidProviderType("together")).toBe(true);
      expect(isValidProviderType("openrouter")).toBe(true);
      expect(isValidProviderType("genai")).toBe(true);
      expect(isValidProviderType("xai")).toBe(true);
      expect(isValidProviderType("lm-studio")).toBe(true);
    });

    it("should return false for invalid provider types", () => {
      expect(isValidProviderType("invalid")).toBe(false);
      expect(isValidProviderType("")).toBe(false);
      expect(isValidProviderType("unknown-provider")).toBe(false);
    });

    it("should handle case sensitivity", () => {
      expect(isValidProviderType("OpenAI")).toBe(false);
      expect(isValidProviderType("ANTHROPIC")).toBe(false);
    });
  });

  describe("getSupportedProviderTypes", () => {
    it("should return array of all supported provider types", () => {
      const types = getSupportedProviderTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it("should include all expected providers", () => {
      const types = getSupportedProviderTypes();

      expect(types).toContain("anthropic");
      expect(types).toContain("openai");
      expect(types).toContain("ollama");
      expect(types).toContain("together");
      expect(types).toContain("openrouter");
      expect(types).toContain("genai");
      expect(types).toContain("xai");
      expect(types).toContain("lm-studio");
    });

    it("should return types that match registry keys", () => {
      const types = getSupportedProviderTypes();
      const registryKeys = Object.keys(providerRegistry);

      expect(types).toEqual(registryKeys);
    });
  });
});
