/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Space Grotesk', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#38bdf8',
          dim: '#0ea5e9',
          cyan: '#22d3ee',
          purple: '#a855f7',
        },
        cosmic: {
          bg: '#050508',
          surface: '#0f0f16',
          elevated: '#15151e',
          border: 'rgba(255,255,255,0.06)',
        },
      },
      animation: {
        'scan': 'scan-line 2.4s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'cosmic-float': 'cosmic-float 6s ease-in-out infinite',
        'particle-twinkle': 'particle-twinkle 4s ease-in-out infinite',
        'orbit-spin': 'orbital-spin 12s linear infinite',
        'orbit-spin-reverse': 'orbital-spin 16s linear infinite reverse',
        'breathe': 'breathe 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      gridTemplateColumns: {
        'main': '1fr 1.45fr',
      },
      backgroundImage: {
        'cosmic-gradient': 'radial-gradient(ellipse 60% 50% at 15% 20%, rgba(56,189,248,0.04) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 85% 80%, rgba(168,85,247,0.04) 0%, transparent 70%)',
        'neon-glow': 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(168,85,247,0.1))',
      },
      boxShadow: {
        'cosmic-glow': '0 0 24px rgba(56,189,248,0.25), 0 0 48px rgba(56,189,248,0.08)',
        'cosmic-card': 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
