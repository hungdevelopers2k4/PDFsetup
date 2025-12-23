// Small CommonJS bootstrap to dynamically import the ESM main file.
(async () => {
  try {
    await import('./main.js');
  } catch (err) {
    console.error('Failed to load ESM main:', err);
    process.exit(1);
  }
})();
