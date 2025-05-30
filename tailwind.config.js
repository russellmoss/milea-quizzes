/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./src/**/*.css"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb', // blue-600
        'primary-dark': '#1d4ed8', // blue-700
        darkBrownHover: '#654321',
        background: '#F5F5DC'
      },
      fontFamily: {
        'gilda': ['Gilda Display', 'serif']
      }
    }
  },
  plugins: []
} 