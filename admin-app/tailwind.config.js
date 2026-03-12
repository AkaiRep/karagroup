/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dde6ff',
          200: '#c3d1ff',
          500: '#4f73f5',
          600: '#3b5de0',
          700: '#2d47c4',
          800: '#1e3099',
          900: '#13216e',
        }
      }
    }
  },
  plugins: []
}
