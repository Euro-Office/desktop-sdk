import { describe, expect, it } from "vitest";
import type { ImageCollections } from "../images";
import {
  darkImages,
  getImageSrc,
  getProviderImageSrc,
  lightImages,
} from "../images";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("images", () => {
  describe("lightImages / darkImages", () => {
    it("lightImages is a non-empty object", () => {
      expect(typeof lightImages).toBe("object");
      expect(Object.keys(lightImages).length).toBeGreaterThan(0);
    });

    it("darkImages is a non-empty object", () => {
      expect(typeof darkImages).toBe("object");
      expect(Object.keys(darkImages).length).toBeGreaterThan(0);
    });

    it("each entry in lightImages is an array of { scale, src }", () => {
      for (const [_name, entries] of Object.entries(
        lightImages as ImageCollections
      )) {
        expect(Array.isArray(entries)).toBe(true);
        for (const entry of entries) {
          expect(entry).toHaveProperty("scale");
          expect(entry).toHaveProperty("src");
          expect(typeof entry.scale).toBe("number");
          expect(typeof entry.src).toBe("string");
        }
      }
    });

    it("entries are sorted by scale ascending", () => {
      for (const entries of Object.values(lightImages as ImageCollections)) {
        for (let i = 1; i < entries.length; i++) {
          expect(entries[i].scale).toBeGreaterThanOrEqual(entries[i - 1].scale);
        }
      }
    });
  });

  describe("getImageSrc", () => {
    it("returns null for unknown image name", () => {
      expect(getImageSrc("nonexistent-image-xyz", "light", 1)).toBeNull();
    });

    it("returns null for unknown image name in dark theme", () => {
      expect(getImageSrc("nonexistent-image-xyz", "dark", 1)).toBeNull();
    });

    it("returns ImageResult for a known image (arrow.bottom)", () => {
      const result = getImageSrc("arrow.bottom", "light", 1);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("src");
      expect(result).toHaveProperty("isSvg");
      expect(typeof result?.src).toBe("string");
    });

    it("returns ImageResult for dark theme", () => {
      const result = getImageSrc("arrow.bottom", "dark", 1);
      expect(result).not.toBeNull();
      expect(typeof result?.src).toBe("string");
    });

    it("prefers scale >= requested", () => {
      // Request scale 2 — should find @2x or higher
      const result = getImageSrc("arrow.bottom", "light", 2);
      expect(result).not.toBeNull();
    });

    it("falls back to highest scale when requested scale exceeds available", () => {
      // Request an extremely high scale
      const result = getImageSrc("arrow.bottom", "light", 100);
      expect(result).not.toBeNull();
      expect(typeof result?.src).toBe("string");
    });

    it("marks svg images with isSvg = true", () => {
      // SVG images have scale set to 2.5 (VECTOR_IMAGE_SCALE)
      const svgNames = Object.entries(lightImages as ImageCollections)
        .filter(([, entries]) => entries.some((e) => e.scale === 2.5))
        .map(([name]) => name);

      if (svgNames.length > 0) {
        const result = getImageSrc(svgNames[0], "light", 2.5);
        expect(result).not.toBeNull();
        expect(result?.isSvg).toBe(true);
      }
    });
  });

  describe("getProviderImageSrc", () => {
    it("returns a string for known provider (openai)", () => {
      const src = getProviderImageSrc("openai");
      expect(typeof src).toBe("string");
      expect(src.length).toBeGreaterThan(0);
    });

    it("falls back to openai for unknown provider type", () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing unknown provider fallback
      const unknown = getProviderImageSrc("totally-unknown-provider" as any);
      const openai = getProviderImageSrc("openai");
      expect(unknown).toBe(openai);
    });

    it("accepts theme parameter", () => {
      const lightSrc = getProviderImageSrc("openai", "light");
      const darkSrc = getProviderImageSrc("openai", "dark");
      expect(typeof lightSrc).toBe("string");
      expect(typeof darkSrc).toBe("string");
    });

    it("accepts scale parameter", () => {
      const src = getProviderImageSrc("openai", "light", 2);
      expect(typeof src).toBe("string");
    });

    it("returns string for anthropic provider", () => {
      const src = getProviderImageSrc("anthropic");
      expect(typeof src).toBe("string");
      expect(src.length).toBeGreaterThan(0);
    });
  });
});
