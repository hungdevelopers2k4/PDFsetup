module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,vue}',
    './electron/**/*.{js,ts,cjs,mjs}',
    './dist/**/*.html'
  ],
  theme: {
    extend: {
      // Provide extra z-index steps used across the app so editor/IntelliSense
      // and the generated CSS know about them. Tailwind's default zIndex
      // includes 0, 10, 20, 30, 40, 50. We're adding a few extra named values
      // (60, 100, 105, 110, 120, 150, 10000) so you can safely use
      // `z-60`, `z-100`, etc. in className without warnings.
      zIndex: {
        '60': '60',
        '100': '100',
        '105': '105',
        '110': '110',
        '120': '120',
        '150': '150',
        // sometimes used for dragged portal items — prefer using a named
        // class rather than arbitrary `z-[10000]` in templates
        '10000': '10000'
      }
    }
  },
  plugins: []
};
