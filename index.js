import app from './app/app.js';

app().catch((error) => {
  console.error('[startup]', error);
  process.exit(1);
});
