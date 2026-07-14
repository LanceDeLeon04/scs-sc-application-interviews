/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nu: {
          950: "#040F22",
          900: "#0A2050",
          800: "#0E2C6B",
          700: "#123E7C",
          600: "#1A4E96",
          500: "#2560AF",
          100: "#E7EEF9",
          50: "#F4F7FC",
        },
        gold: {
          700: "#9C7A1E",
          600: "#B4901F",
          500: "#D4AF37",
          400: "#E4C767",
          300: "#F0D571",
          100: "#FBF1D2",
        },
        paper: "#F6F8FB",
        ink: "#0F1B2D",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,32,80,0.06), 0 8px 24px -8px rgba(10,32,80,0.15)",
        gold: "0 0 0 1px rgba(212,175,55,0.4), 0 8px 24px -8px rgba(212,175,55,0.35)",
      },
      backgroundImage: {
        "seal-ring": "conic-gradient(from 180deg, #D4AF37, #F0D571, #9C7A1E, #D4AF37)",
      },
    },
  },
  plugins: [],
}
