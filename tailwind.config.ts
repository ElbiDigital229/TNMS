import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        primary: {
          50: "#effcf9",
          100: "#c7f7ec",
          200: "#93efdd",
          300: "#55dfca",
          400: "#24c9b2",
          500: "#0ea899",
          600: "#07897e",
          700: "#096e68",
          800: "#0b5753",
          900: "#0e4744",
          950: "#032b2b",
        },
        sidebar: {
          DEFAULT: "#0D2637",
          hover: "#143345",
          active: "#1A4058",
          border: "#1C3D52",
          text: "#8BA4B8",
        },
      },
      keyframes: {
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
