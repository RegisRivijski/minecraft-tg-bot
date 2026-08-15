import mongoose from 'mongoose';

import minecraftTgBot from '../../classes/MongooseSignletons/MongooseMinecraftTgBotSingleton.js';

const chatsSchema = new mongoose.Schema({
  chatId: {
    type: Number,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    default: '',
  },
  chatRelay: {
    type: Boolean,
    default: false,
  },
  joinRelay: {
    type: Boolean,
    default: false,
  },
  eventRelay: {
    type: Boolean,
    default: false,
  },
  deathRelay: {
    type: Boolean,
  },
  advancementRelay: {
    type: Boolean,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

export default minecraftTgBot.model('chats', chatsSchema);
