import type { Config } from 'tailwindcss';

// Approved palette: #5D6B6B · #F1F7F7 · #D5E5E5 · #C0D9D9 · #F7CBCA · #D9D0D0
// Ramps below are built around those six values (marked ★) so every shade stays in the family.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50: '#F1F7F7', // ★ primary background
          100: '#E5EFEF',
          200: '#D5E5E5', // ★ secondary background
          300: '#C0D9D9', // ★ accent mint
          400: '#9DB5B5',
          500: '#7A8C8C',
          600: '#5D6B6B', // ★ primary dark
          700: '#4B5757',
          800: '#3A4444',
          900: '#283030',
        },
        ink: {
          900: '#1D2626', 800: '#2B3535', 700: '#3D4848', 600: '#536060', 500: '#6A7777',
          400: '#95A1A1', 300: '#C2CCCC', 200: '#DCE6E6', 100: '#EAF1F1', 50: '#F5F9F9',
        },
        rose: {
          50: '#FDF3F3', 100: '#FBE5E4',
          200: '#F7CBCA', // ★ soft pink — attention
          300: '#EFAAA8', 400: '#E38E8B', 500: '#D1716E', 600: '#B4524F', 700: '#953F3D',
        },
        sand: {
          50: '#F8F6F6', 100: '#EEE9E9',
          200: '#D9D0D0', // ★ warm neutral
          400: '#B0A3A3', 600: '#7D6F6F', 700: '#635757',
        },
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        card: '0 1px 2px rgba(40,48,48,.04), 0 2px 8px -2px rgba(40,48,48,.06)',
        lift: '0 12px 32px -8px rgba(40,48,48,.28), 0 4px 10px -4px rgba(40,48,48,.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
