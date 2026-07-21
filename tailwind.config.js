/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── "Pika" design system ─────────────────────────────────────────
        // Warm paper ground, thick ink outlines, sun-yellow price stickers,
        // tomato deal accents, leaf-green wins. Hard offset shadows below.
        ink:  '#1a1a1a',
        paper: { DEFAULT: '#fff8ef', deep: '#fff3e2', tint: '#fdeed4' },
        sun:    { DEFAULT: '#ffd84d', deep: '#f5c400' },
        tomato: { DEFAULT: '#e63b2e', deep: '#c72c20' },
        leaf:   { DEFAULT: '#1f9d55', deep: '#157a40' },
        clay: '#9a8f80',
        sand: '#f0e4d0',
        // Legacy orange scale kept for the admin panel only.
        primary: {
          50: '#fff3e0',
          100: '#ffe0b2',
          200: '#ffcc80',
          300: '#ffb74d',
          400: '#ffa726',
          500: '#f57c00',
          600: '#e65100',
          700: '#bf360c',
          800: '#8d1c00',
          900: '#5d0e00',
        },
        orange: {
          DEFAULT: '#f57c00',
          light: '#ff9800',
          dark: '#e65100',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'pika-sm': '2px 2px 0 #1a1a1a',
        'pika':    '3px 3px 0 #1a1a1a',
        'pika-lg': '5px 5px 0 #1a1a1a',
      },
    },
  },
  plugins: [],
};
