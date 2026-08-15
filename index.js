import app from './app/index.js';

app().catch((error) => {
  console.error('[startup]', error);
  process.exit(1);
});
