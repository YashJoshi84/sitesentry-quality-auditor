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
        // Professional engineering developer tool palette (neutral dark theme)
        app: {
          bg: '#17191B',
          surface: '#202325',
          raised: '#25282B',
          overlay: '#2A2E31',
          border: '#35393A',
          'border-hover': '#484E50',
          'border-active': '#5A6265',
        },
        text: {
          primary: '#E6E8E6',
          secondary: '#A0A6A2',
          tertiary: '#777E79',
          muted: '#777E79',
        },
        // Neutral monochrome accent (removes generic purple)
        accent: {
          DEFAULT: '#E6E8E6',
          hover: '#FFFFFF',
          muted: 'rgba(230, 232, 230, 0.08)',
          border: '#35393A',
        },
        status: {
          success: '#48C78E',
          'success-bg': 'rgba(72, 199, 142, 0.10)',
          'success-border': 'rgba(72, 199, 142, 0.25)',
          warning: '#E5B84B',
          'warning-bg': 'rgba(229, 184, 75, 0.10)',
          'warning-border': 'rgba(229, 184, 75, 0.25)',
          error: '#F16B68',
          'error-bg': 'rgba(241, 107, 104, 0.10)',
          'error-border': 'rgba(241, 107, 104, 0.25)',
          info: '#7E97A6',
          'info-bg': 'rgba(126, 151, 166, 0.10)',
          'info-border': 'rgba(126, 151, 166, 0.25)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'card': '8px',
        'subtle': '6px',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.35)',
        'elevated': '0 4px 16px rgba(0, 0, 0, 0.45)',
      },
      transitionDuration: {
        'default': '150ms',
      }
    },
  },
  plugins: [],
}
