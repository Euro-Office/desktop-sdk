import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDocs = mode === "docs";

  return {
    plugins: [
      react(),
      tailwindcss(),
      svgr({
        svgrOptions: {
          exportType: "default",
        },
        include: "**/*.svg?react",
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: "./",
    publicDir: isDocs ? false : "public",
    build: {
      outDir: isDocs ? "dist-docs" : "dist",
      cssCodeSplit: true,
      assetsInlineLimit: 8192,
      rollupOptions: {
        input: isDocs
          ? {
              "engine-shim": path.resolve(
                __dirname,
                "src/legacy/engine-shim.ts"
              ),
              chat: path.resolve(__dirname, "src/docs-plugin/chat.tsx"),
              settings: path.resolve(__dirname, "src/docs-plugin/settings.tsx"),
            }
          : undefined,
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: (chunkInfo) => {
            if (isDocs) {
              // Only check facadeModuleId: vendor (from manualChunks) has
              // no facade, and we don't want to pull it into shiki/ just
              // because some shiki language imports a vendored dep.
              const id = (chunkInfo.facadeModuleId || "").replace(/\\/g, "/");
              if (id.includes("/@shikijs/") || id.includes("/shiki/")) {
                return "shiki/[name].js";
              }
            }
            return "[name].js";
          },
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || "";
            if (isDocs && name.endsWith(".wasm")) {
              return "shiki/[name][extname]";
            }
            return "[name][extname]";
          },
          manualChunks: isDocs
            ? (id) => {
                if (id.includes("node_modules")) {
                  if (/[\\/](?:@shikijs|shiki)[\\/]/.test(id)) return undefined;
                  return "vendor";
                }
                // Pin shared app code (e.g. shared CSS imported by both
                // chat and settings entries) to a stable chunk name so
                // HTML shells can reference its CSS without worrying about
                // chunk renames as the entries' import graph shifts.
                const norm = id.replace(/\\/g, "/");
                if (norm.includes("/src/shared/")) return "shared";
                return undefined;
              }
            : undefined,
        },
      },
    },
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.ts"],
        exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      },
    },
  };
});
