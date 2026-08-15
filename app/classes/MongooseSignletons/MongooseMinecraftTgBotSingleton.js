import mongoose from 'mongoose';

import config from '../../../config/default.js';

const minecraftTgBot = mongoose.createConnection(
  config.db.mongodb.url,
  config.db.mongodb.options,
);

minecraftTgBot.on('connected', () => {
  console.info('[mongo] connected');
});

minecraftTgBot.on('error', (error) => {
  console.error('[mongo] connection error', error);
});

export default minecraftTgBot;
