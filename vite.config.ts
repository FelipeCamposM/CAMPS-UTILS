import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  // "@" → src/. Existe porque o shadcn/React Bits gera imports com esse alias
  // (ver components.json). Espelhado em tsconfig.json > paths.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  clearScreen: false,
  server: {
    port: 1520,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1521 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Restringe a descoberta aos testes frontend. O pytest mantém seu cache na
    // raiz e, no Windows, outro processo pode deixá-lo sem permissão de leitura.
    dir: "src",
    // Os testes de App usam animações/transições e ficam instáveis quando
    // vários arquivos jsdom disputam CPU. Execução serial é mais lenta, porém
    // reproduzível no Windows e no CI.
    fileParallelism: false,
  },
});
