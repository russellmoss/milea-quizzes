/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        primary: '#8B4513',
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