import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['var(--font-inter)',      'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia',    'serif'],
      },
      colors: {
        warm: {
          50:  '#FAF8F3',
          100: '#F4EFE6',
          200: '#E9DFCE',
          300: '#D6C9B2',
          400: '#BBA994',
          500: '#9E8A76',
          600: '#7D6B59',
          700: '#5C4D3D',
          800: '#3D3028',
          900: '#1E1510',
        },
      },
    },
  },
  plugins: [],
}

export default config
