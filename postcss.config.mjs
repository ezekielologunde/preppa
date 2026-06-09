// Tailwind v4 is wired through PostCSS. autoprefixer is not needed (lightningcss handles it).
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
