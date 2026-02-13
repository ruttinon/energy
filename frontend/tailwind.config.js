/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        inter: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        gold: {
          DEFAULT: '#FFD700',
          bright: '#FFC107',
          dark: '#B8860B',
          amber: '#FFA500'
        }
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'scan': 'scan 2s linear infinite',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(400%)', opacity: '0' },
        }
      }
    }
  },
  plugins: []
}

