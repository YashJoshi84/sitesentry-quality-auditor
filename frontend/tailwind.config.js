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
        // Linear / Vercel inspired minimalist dark palette
        app: {
          bg: '#0D0F12',
          surface: '#14171B',
          raised: '#191D22',
          overlay: '#20252B',
          border: '#292E35',
          'border-hover': '#383F49',
          'border-active': '#454C58',
        },
        text: {
          primary: '#F1F3F5',
          secondary: '#969EAA',
          tertiary: '#656D7A',
        },
        accent: {
          DEFAULT: '#8175F5',
          hover: '#7063E8',
          muted: 'rgba(129, 117, 245, 0.12)',
          border: 'rgba(129, 117, 245, 0.35)',
        },
        status: {
          success: '#34D399',
          'success-bg': 'rgba(52, 211, 153, 0.10)',
          'success-border': 'rgba(52, 211, 153, 0.22)',
          warning: '#FBBF24',
          'warning-bg': 'rgba(251, 191, 36, 0.10)',
          'warning-border': 'rgba(251, 191, 36, 0.22)',
          error: '#F87171',
          'error-bg': 'rgba(248, 113, 113, 0.10)',
          'error-border': 'rgba(248, 113, 113, 0.22)',
          info: '#60A5FA',
          'info-bg': 'rgba(96, 165, 250, 0.10)',
          'info-border': 'rgba(96, 165, 250, 0.22)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'card': '10px',
        'subtle': '6px',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.25)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.35)',
      },
      transitionDuration: {
        'default': '180ms',
      }
    },
  },
  plugins: [],
}
