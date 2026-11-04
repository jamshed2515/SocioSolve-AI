/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#f0eeff",
          100: "#e4e0ff",
          200: "#ccc5ff",
          300: "#a99bff",
          400: "#836aff",
          500: "#6C63FF",  // brand purple
          600: "#5a4de8",
          700: "#4a3ccb",
          800: "#3d33a4",
          900: "#342d84",
        },
        accent: {
          400: "#00D4AA",
          500: "#00B896",
          600: "#009e80",
        },
        dark: {
          900: "#0d0d1a",
          800: "#12122a",
          700: "#1a1a35",
          600: "#22223f",
          500: "#2d2d52",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-gradient": "linear-gradient(135deg, #0d0d1a 0%, #12122a 50%, #1a1a35 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
