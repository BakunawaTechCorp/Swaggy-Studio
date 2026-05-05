import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        "bg-base": "#0a0820",
        "bg-canvas": "#0d0a26",
        "bg-card": "#0f0b2a",
        "bg-elevated": "#1a1440",
        "bg-overlay": "#221a4f",
        border: "#2a1f5e",
        "border-subtle": "#1f1745",
        "border-strong": "#3d2d80",
        "brand-purple": "#7b2ff7",
        "brand-purple-soft": "#a855f7",
        "brand-pink": "#f059c0",
        "brand-cyan": "#67e8f9",
        "brand-yellow": "#f7c948",
        "joestar-yellow": "#f7c948",
        "text-primary": "#f5f3ff",
        "text-secondary": "rgba(245, 243, 255, 0.72)",
        "text-tertiary": "rgba(245, 243, 255, 0.48)",
        "text-muted": "rgba(245, 243, 255, 0.32)",
        success: "#34d399",
        warning: "#fbbf24",
        error: "#f87171",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: [
          "var(--font-serif)",
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
      },
      fontSize: {
        "display-xl": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["32px", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "display-md": ["22px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        lg: ["17px", { lineHeight: "1.5" }],
        base: ["15px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.45" }],
        xs: ["12px", { lineHeight: "1.4" }],
        micro: ["11px", { lineHeight: "1.3" }],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.7)" },
          "60%": { opacity: "1", transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s linear infinite",
        "fade-in": "fade-in 300ms ease-out both",
        float: "float 3s ease-in-out infinite",
        "pop-in": "pop-in 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "slide-in-right": "slide-in-right 240ms ease-out both",
      },
      transitionDuration: {
        DEFAULT: "300ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #7b2ff7 0%, #a855f7 50%, #f059c0 100%)",
        "yellow-pink-gradient":
          "linear-gradient(135deg, #f7c948 0%, #f059c0 100%)",
        "cyan-purple-gradient":
          "linear-gradient(135deg, #67e8f9 0%, #7b2ff7 100%)",
        "cosmic-gradient":
          "radial-gradient(ellipse at top left, rgba(123, 47, 247, 0.25) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(240, 89, 192, 0.18) 0%, transparent 50%), #0a0820",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(10, 8, 32, 0.4)",
        md: "0 4px 12px rgba(10, 8, 32, 0.5)",
        lg: "0 12px 32px rgba(10, 8, 32, 0.6)",
        glow: "0 0 40px -8px rgba(123, 47, 247, 0.55)",
        "glow-purple": "0 0 40px -8px rgba(123, 47, 247, 0.55)",
        "glow-pink": "0 0 32px -10px rgba(240, 89, 192, 0.5)",
        "glow-yellow": "0 0 28px -10px rgba(247, 201, 72, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
