import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        panel: "#111a2e",
        edge: "#1e2a44",
        accent: "#5eead4",
        gold: "#fbbf24",
      },
    },
  },
  plugins: [],
};
export default config;
