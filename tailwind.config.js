const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), band: v('band'), ink: v('ink'), muted: v('muted'),
        line: v('line'), primary: v('primary'), onprimary: v('onprimary'), gold: v('gold'),
        goldink: v('goldink'), good: v('good'), warn: v('warn'), bad: v('bad'),
      },
      fontFamily: {
        sans: ['Manrope', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        ar: ['"IBM Plex Sans Arabic"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '14px', ctl: '10px' },
      boxShadow: { card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -12px rgb(var(--shadow) / 0.18)' },
    },
  },
  plugins: [],
};
