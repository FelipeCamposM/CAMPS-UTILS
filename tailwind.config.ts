import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0e0e14",
          surface: "#16161e",
          elevated: "#1e1e28",
        },
        border: {
          subtle: "#2a2a36",
          DEFAULT: "#36364a",
        },
        accent: {
          DEFAULT: "#818cf8",
          hover: "#6366f1",
          muted: "#818cf820",
        },
        text: {
          primary: "#e2e2ec",
          secondary: "#8888a8",
          muted: "#55556a",
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Cascadia Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
