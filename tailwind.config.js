/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand (matches existing web app's purple/pink identity)
        brand: {
          DEFAULT: '#8b5cf6', // purple-500 — PWA theme_color
          pink: '#ec4899', // pink-500
        },
        // Event color roles (getEventColorClass in the legacy web app) —
        // confirmed against public/css/styles.css (month-grid variant, picked
        // as the canonical one where the source itself had drifted).
        event: {
          user1: '#3b82f6', // blue-500 — "Ich"
          user2: '#ec4899', // pink-500 — partner
          both: '#8b5cf6', // violet-500 — shared / brand
          birthday: '#f97316', // orange-500
          anniversary: '#f59e0b', // amber-500
        },
      },
      fontFamily: {
        display: ['Poppins'],
      },
    },
  },
  plugins: [],
};
