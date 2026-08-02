/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest:  "#2D6A4F",
        moss:    "#40916C",
        sage:    "#74C69D",
        mint:    "#D8F3DC",
        cream:   "#FAFAF8",
        ink:     "#1A1A18",
        stone:   "#5F6B5A",
        fog:     "#8A9985",
        coral:   "#E63946",
        amber:   "#F4A261",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl:  "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};
