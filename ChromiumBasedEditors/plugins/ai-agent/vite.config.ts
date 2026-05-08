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
    publicDir: isDocs
      ? path.resolve(__dirname, "src/docs-plugin/public")
      : "public",
    build: {
      outDir: isDocs ? "dist-docs" : "dist",
      rollupOptions: {
        input: isDocs
          ? {
              "docs-plugin": path.resolve(
                __dirname,
                "src/docs-plugin/main.tsx"
              ),
              chat: path.resolve(__dirname, "src/docs-plugin/chat.tsx"),
              settings: path.resolve(__dirname, "src/docs-plugin/settings.tsx"),
              "translation-settings": path.resolve(
                __dirname,
                "src/docs-plugin/translation-settings.tsx"
              ),
              "summarization-dialog": path.resolve(
                __dirname,
                "src/docs-plugin/summarization-dialog.tsx"
              ),
              "custom-action-dialog": path.resolve(
                __dirname,
                "src/docs-plugin/custom-action-dialog.tsx"
              ),
              "custom-action-delete-dialog": path.resolve(
                __dirname,
                "src/docs-plugin/custom-action-delete-dialog.tsx"
              ),
              "custom-assistant-dialog": path.resolve(
                __dirname,
                "src/docs-plugin/custom-assistant-dialog.tsx"
              ),
              "custom-assistant-delete-dialog": path.resolve(
                __dirname,
                "src/docs-plugin/custom-assistant-delete-dialog.tsx"
              ),
              "custom-providers-dialog": path.resolve(
                __dirname,
                "src/docs-plugin/custom-providers-dialog.tsx"
              ),
              "docs-plugin-styles": path.resolve(
                __dirname,
                "src/docs-plugin/style.css"
              ),
            }
          : undefined,
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "[name].[ext]",
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
