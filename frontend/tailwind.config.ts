import type { Config } from 'tailwindcss';

const ink = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

/**
 * Tokens only: every colour, size and radius used in the app is named here.
 * The palette is a set of inks, and each ink means one thing everywhere:
 * ink = content, pen = what you did or can do, mark = evidence and where to look,
 * red = the examiner's pen, tick = correct.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#fff',
      paper: ink('paper'),
      desk: ink('desk'),
      ink: { DEFAULT: ink('ink'), 2: ink('ink-2'), 3: ink('ink-3') },
      rule: { DEFAULT: ink('rule'), 2: ink('rule-2') },
      pen: { DEFAULT: ink('pen'), deep: ink('pen-deep'), wash: ink('pen-wash') },
      mark: { DEFAULT: ink('mark'), wash: ink('mark-wash') },
      red: { DEFAULT: ink('red'), wash: ink('red-wash') },
      tick: { DEFAULT: ink('tick'), wash: ink('tick-wash') },
    },
    fontFamily: {
      sans: ['"Archivo Variable"', 'system-ui', 'Segoe UI', 'sans-serif'],
      serif: ['"Literata Variable"', 'Georgia', 'serif'],
      mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'Consolas', 'monospace'],
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.8125rem', { lineHeight: '1.25rem' }],
      base: ['0.875rem', { lineHeight: '1.375rem' }],
      md: ['1rem', { lineHeight: '1.625rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.3125rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '1.875rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.375rem', { lineHeight: '2.625rem' }],
      '5xl': ['3rem', { lineHeight: '3.125rem' }],
      '6xl': ['3.75rem', { lineHeight: '3.75rem' }],
      '7xl': ['4.75rem', { lineHeight: '4.625rem' }],
    },
    borderRadius: { none: '0', sm: '4px', DEFAULT: '6px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
    extend: {
      maxWidth: { measure: '68ch', page: '76rem' },
      boxShadow: {
        // The only shadow in the system: things that float above the page.
        float: '0 1px 2px rgb(var(--ink) / 0.06), 0 12px 32px -8px rgb(var(--ink) / 0.18)',
      },
      keyframes: {
        'sweep': { from: { backgroundSize: '0% 76%' }, to: { backgroundSize: '100% 76%' } },
        'rise': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'pulse-dot': { '0%, 100%': { opacity: '0.35' }, '50%': { opacity: '1' } },
      },
      animation: {
        sweep: 'sweep 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        rise: 'rise 0.18s ease-out both',
        'pulse-dot': 'pulse-dot 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
