export default {
  plugins: {
    // Ensure we use the standard Tailwind PostCSS plugin so the build
    // and Tailwind CLI/extensions can locate and process the directives.
    // Order matters: postcss-import before tailwind, then nested/autoprefixer.
    'postcss-import': {},
    // Use the new PostCSS wrapper package for Tailwind
    '@tailwindcss/postcss': {},
    'postcss-nested': {},
    'autoprefixer': {},
  }
}