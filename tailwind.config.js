/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#e0f7ff',
          100: '#b3edff',
          200: '#80e3ff',
          300: '#4dd9ff',
          400: '#26d1ff',
          500: '#01affe', // Main color
          600: '#019ee6',
          700: '#0186c7',
          800: '#016fa8',
          900: '#014d77',
        },
        accent: {
          50: '#fef9e7',
          100: '#fef0c7',
          200: '#fde68a',
          300: '#fcd34d', // Second color
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
