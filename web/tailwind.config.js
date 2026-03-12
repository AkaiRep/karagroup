/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07080d',
        card: '#111318',
        border: '#1e2029',
        accent: '#7c3aed',
        'accent-hover': '#6d28d9',
        muted: '#64748b',
      },
    },
  },
  plugins: [],
}
