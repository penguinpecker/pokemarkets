import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pkmn: {
          red: "#E8000D",
          "red-dark": "#AA0008",
          "red-glow": "rgba(232,0,13,0.15)",
          yellow: "#FFCB05",
          "yellow-dim": "#BF9A04",
          "yellow-glow": "rgba(255,203,5,0.1)",
          white: "#E8E6DF",
        },
        surface: {
          base: "#0d0e18",
          card: "#12131f",
          elevated: "#181a28",
          input: "#1e2030",
        },
        border: {
          DEFAULT: "#252738",
          light: "#2e3148",
        },
        txt: {
          primary: "#E8E6DF",
          mid: "#8B8D9E",
          dim: "#5A5C70",
        },
        bull: "#22C55E",
        bear: "#E8000D",
      },
      fontFamily: {
        display: ["'Righteous'", "sans-serif"],
        body: ["'Nunito'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "glow-pulse": "glow 3s ease infinite",
        "slide-up": "slideUp 0.3s ease",
        "price-tick": "priceTick 0.3s ease",
      },
      keyframes: {
        glow: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(255,203,5,0.15)" },
          "50%": { boxShadow: "0 0 20px rgba(255,203,5,0.25)" },
        },
        slideUp: {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        priceTick: {
          "0%": { opacity: "0.6" },
          "100%": { opacity: "1" },
        },
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)",
        "glow-red": "0 0 20px rgba(232,0,13,0.25)",
        "glow-yellow": "0 0 20px rgba(255,203,5,0.2)",
        "glow-green": "0 0 20px rgba(34,197,94,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
