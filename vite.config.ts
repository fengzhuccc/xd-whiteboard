import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * 移除 Excalidraw 的 esm.sh fallback URL。
 * 当网络较慢时，Chrome 可能会尝试 font-face src 列表中的 fallback 地址，
 * 导致请求 https://esm.sh 并被 CSP 拦截。去掉 fallback 后只使用本地字体。
 */
const removeExcalidrawFontFallback = () => ({
  name: "remove-excalidraw-font-fallback",
  closeBundle() {
    const distAssets = path.resolve(__dirname, "dist/assets");
    if (!fs.existsSync(distAssets)) return;
    const files = fs.readdirSync(distAssets);
    for (const file of files) {
      if (!file.startsWith("percentages") || !file.endsWith(".js")) continue;
      const filePath = path.join(distAssets, file);
      let code = fs.readFileSync(filePath, "utf-8");
      if (!code.includes("ASSETS_FALLBACK_URL")) continue;
      // 去掉 push fallback URL 的代码：a.push(new URL(n,Id.ASSETS_FALLBACK_URL)),a
      const updated = code.replace(
        /a\.push\(new URL\(n,\s*[A-Za-z_$]+\.ASSETS_FALLBACK_URL\)\),a/g,
        "a"
      );
      if (updated !== code) {
        fs.writeFileSync(filePath, updated);
      }
    }
  },
});

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), removeExcalidrawFontFallback()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  // Test configuration for Vitest
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
}));
