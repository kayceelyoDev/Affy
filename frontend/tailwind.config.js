/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          light: '#FFFFFF',
          dark: '#000000',
        },
        surface: {
          light: '#FAFAFA',
          dark: '#0A0A0A',
        },
        raised: {
          light: '#FFFFFF',
          dark: '#141414',
        },
        hairline: {
          light: 'rgba(0, 0, 0, 0.08)',
          dark: 'rgba(255, 255, 255, 0.10)',
        },
        txt: {
          primary: {
            light: '#0A0A0A',
            dark: '#F5F5F5',
          },
          secondary: {
            light: '#6B6B6B',
            dark: '#A1A1A1',
          },
          tertiary: {
            light: '#9A9A9A',
            dark: '#6E6E6E',
          },
        },
      },
      borderRadius: {
        'control': '10px',
        'card': '14px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro"', '"Inter"', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.01em',
      },
    },
  },
  plugins: [],
}
