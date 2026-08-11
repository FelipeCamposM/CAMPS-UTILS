// vite.config.ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "file:///D:/PROGRAMACAO/PROJETOS/python/PDF-TO-MARKDOWN/node_modules/vite/dist/node/index.js";
import react from "file:///D:/PROGRAMACAO/PROJETOS/python/PDF-TO-MARKDOWN/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///D:/PROGRAMACAO/PROJETOS/python/PDF-TO-MARKDOWN/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///D:/PROGRAMACAO/PROJETOS/python/PDF-TO-MARKDOWN/node_modules/autoprefixer/lib/autoprefixer.js";
var __vite_injected_original_import_meta_url = "file:///D:/PROGRAMACAO/PROJETOS/python/PDF-TO-MARKDOWN/vite.config.ts";
var host = process.env.TAURI_DEV_HOST;
var vite_config_default = defineConfig({
  plugins: [react()],
  // "@" → src/. Existe porque o shadcn/React Bits gera imports com esse alias
  // (ver components.json). Espelhado em tsconfig.json > paths.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer]
    }
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : void 0,
    watch: { ignored: ["**/src-tauri/**"] }
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQUk9HUkFNQUNBT1xcXFxQUk9KRVRPU1xcXFxweXRob25cXFxcUERGLVRPLU1BUktET1dOXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxQUk9HUkFNQUNBT1xcXFxQUk9KRVRPU1xcXFxweXRob25cXFxcUERGLVRPLU1BUktET1dOXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9QUk9HUkFNQUNBTy9QUk9KRVRPUy9weXRob24vUERGLVRPLU1BUktET1dOL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gXCJ0YWlsd2luZGNzc1wiO1xuaW1wb3J0IGF1dG9wcmVmaXhlciBmcm9tIFwiYXV0b3ByZWZpeGVyXCI7XG5cbmNvbnN0IGhvc3QgPSBwcm9jZXNzLmVudi5UQVVSSV9ERVZfSE9TVDtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICAvLyBcIkBcIiBcdTIxOTIgc3JjLy4gRXhpc3RlIHBvcnF1ZSBvIHNoYWRjbi9SZWFjdCBCaXRzIGdlcmEgaW1wb3J0cyBjb20gZXNzZSBhbGlhc1xuICAvLyAodmVyIGNvbXBvbmVudHMuanNvbikuIEVzcGVsaGFkbyBlbSB0c2NvbmZpZy5qc29uID4gcGF0aHMuXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IGZpbGVVUkxUb1BhdGgobmV3IFVSTChcIi4vc3JjXCIsIGltcG9ydC5tZXRhLnVybCkpLFxuICAgIH0sXG4gIH0sXG4gIGNzczoge1xuICAgIHBvc3Rjc3M6IHtcbiAgICAgIHBsdWdpbnM6IFt0YWlsd2luZGNzcywgYXV0b3ByZWZpeGVyXSxcbiAgICB9LFxuICB9LFxuICBjbGVhclNjcmVlbjogZmFsc2UsXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDE0MjAsXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICBob3N0OiBob3N0IHx8IGZhbHNlLFxuICAgIGhtcjogaG9zdFxuICAgICAgPyB7IHByb3RvY29sOiBcIndzXCIsIGhvc3QsIHBvcnQ6IDE0MjEgfVxuICAgICAgOiB1bmRlZmluZWQsXG4gICAgd2F0Y2g6IHsgaWdub3JlZDogW1wiKiovc3JjLXRhdXJpLyoqXCJdIH0sXG4gIH0sXG4gIGVudlByZWZpeDogW1wiVklURV9cIiwgXCJUQVVSSV9FTlZfKlwiXSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6XG4gICAgICBwcm9jZXNzLmVudi5UQVVSSV9FTlZfUExBVEZPUk0gPT09IFwid2luZG93c1wiID8gXCJjaHJvbWUxMDVcIiA6IFwic2FmYXJpMTNcIixcbiAgICBtaW5pZnk6ICFwcm9jZXNzLmVudi5UQVVSSV9FTlZfREVCVUcgPyBcImVzYnVpbGRcIiA6IGZhbHNlLFxuICAgIHNvdXJjZW1hcDogISFwcm9jZXNzLmVudi5UQVVSSV9FTlZfREVCVUcsXG4gIH0sXG4gIHRlc3Q6IHtcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIGVudmlyb25tZW50OiBcImpzZG9tXCIsXG4gICAgc2V0dXBGaWxlczogW1wiLi9zcmMvdGVzdC9zZXR1cC50c1wiXSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzVSxTQUFTLGVBQWUsV0FBVztBQUN6VyxTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxrQkFBa0I7QUFKb0wsSUFBTSwyQ0FBMkM7QUFNOVAsSUFBTSxPQUFPLFFBQVEsSUFBSTtBQUV6QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUE7QUFBQTtBQUFBLEVBR2pCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssY0FBYyxJQUFJLElBQUksU0FBUyx3Q0FBZSxDQUFDO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxTQUFTO0FBQUEsTUFDUCxTQUFTLENBQUMsYUFBYSxZQUFZO0FBQUEsSUFDckM7QUFBQSxFQUNGO0FBQUEsRUFDQSxhQUFhO0FBQUEsRUFDYixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixNQUFNLFFBQVE7QUFBQSxJQUNkLEtBQUssT0FDRCxFQUFFLFVBQVUsTUFBTSxNQUFNLE1BQU0sS0FBSyxJQUNuQztBQUFBLElBQ0osT0FBTyxFQUFFLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRTtBQUFBLEVBQ3hDO0FBQUEsRUFDQSxXQUFXLENBQUMsU0FBUyxhQUFhO0FBQUEsRUFDbEMsT0FBTztBQUFBLElBQ0wsUUFDRSxRQUFRLElBQUksdUJBQXVCLFlBQVksY0FBYztBQUFBLElBQy9ELFFBQVEsQ0FBQyxRQUFRLElBQUksa0JBQWtCLFlBQVk7QUFBQSxJQUNuRCxXQUFXLENBQUMsQ0FBQyxRQUFRLElBQUk7QUFBQSxFQUMzQjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsWUFBWSxDQUFDLHFCQUFxQjtBQUFBLEVBQ3BDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
