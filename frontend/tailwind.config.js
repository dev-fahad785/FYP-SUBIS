/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7aa2ff',
        'primary-dark': '#5f7bff',
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#0b1020',
        },
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '12px',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'bus-ripple': {
          '0%': {
            transform: 'scale(0.5)',
            opacity: '0.8',
          },
          '70%': {
            transform: 'scale(1.3)',
            opacity: '0',
          },
          '100%': {
            transform: 'scale(1.3)',
            opacity: '0',
          },
        },
        'pulse-highlight': {
          '0%, 100%': {
            filter: 'drop-shadow(0 0 8px rgba(122, 162, 255, 0.6)) drop-shadow(0 0 16px rgba(122, 162, 255, 0.3))',
          },
          '50%': {
            filter: 'drop-shadow(0 0 12px rgba(122, 162, 255, 0.8)) drop-shadow(0 0 24px rgba(122, 162, 255, 0.5))',
          },
        },
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bus-ripple': 'bus-ripple 1.8s ease-out infinite',
        'pulse-highlight': 'pulse-highlight 2s ease-in-out infinite',
      },
      backgroundImage: {
        'gradient-dark': 'radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.08), transparent 25%), radial-gradient(circle at 80% 0%, rgba(255, 255, 255, 0.05), transparent 20%), linear-gradient(135deg, #0f172a 0%, #0b1020 60%, #0a0f1b 100%)',
      },
    },
  },
  darkMode: 'class',
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
