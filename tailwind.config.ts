import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Ensure gold + onyx colors are always generated
    { pattern: /bg-gold/ },
    { pattern: /text-gold/ },
    { pattern: /border-gold/ },
    { pattern: /from-gold/ },
    { pattern: /to-gold/ },
    { pattern: /via-gold/ },
    { pattern: /bg-onyx/ },
    { pattern: /text-onyx/ },
    { pattern: /border-onyx/ },
    { pattern: /shadow-gold/ },
    { pattern: /ring-gold/ },
  ],
  theme: {
    extend: {
      colors: {
        onyx: {
          DEFAULT: "#353839",
          50: "#f5f5f5",
          100: "#e0e0e0",
          200: "#b0b0b0",
          300: "#808080",
          400: "#555555",
          500: "#353839",
          600: "#2d2f30",
          700: "#242627",
          800: "#1c1d1e",
          900: "#131415",
          950: "#0a0a0b",
        },
        gold: {
          DEFAULT: "#FFD700",
          50: "#fffbeb",
          100: "#fff3c4",
          200: "#ffe588",
          300: "#ffd54f",
          400: "#ffcc02",
          500: "#FFD700",
          600: "#e6c200",
          700: "#b89900",
          800: "#8a7300",
          900: "#5c4d00",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.6s ease-out",
        "fade-in": "fadeIn 0.8s ease-out",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(255,215,0,0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(255,215,0,0.6)" },
        },
        slideUp: {
          "0%": { transform: "translateY(30px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
