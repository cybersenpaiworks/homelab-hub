import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 24px 80px rgba(56, 189, 248, 0.18)",
      },
      colors: {
        accent: {
          400: "#38bdf8",
          500: "#0ea5e9",
        },
      },
    },
  },
  plugins: [],
};

export default config;
