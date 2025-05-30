/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{html,js}",
    "./src/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B4513', // Warm brown color
        'primary-dark': '#6B3410', // Darker brown
        background: '#F5F5DC', // Beige background
        secondary: '#D2691E', // Chocolate color
        'secondary-dark': '#A0522D' // Dark chocolate
      },
      fontFamily: {
        'gilda': ['Gilda Display', 'serif']
      }
    }
  },
  plugins: []
} 