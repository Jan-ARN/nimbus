/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    container: { center: true, padding: '1.25rem' },
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        // Wetter-Semantik
        hot: 'var(--hot)',
        cool: 'var(--cool)',
        good: 'var(--good)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      fontFamily: {
        display: ['Bricolage Grotesque', 'Hanken Grotesk', 'system-ui', 'sans-serif'],
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--reka-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--reka-accordion-content-height)' },
          to: { height: '0' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        twinkle: { '0%,100%': { opacity: '0.25' }, '50%': { opacity: '1' } },
        drift: { from: { transform: 'translateX(-5%)' }, to: { transform: 'translateX(5%)' } },
        shimmer: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.7' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        rise: 'rise 0.6s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
