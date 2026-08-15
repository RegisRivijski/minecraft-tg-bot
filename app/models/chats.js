import mongoose from 'mongoose';

import minecraftTgBot from '../classes/MongooseSingleton.js';

const chatSchema = new mongoose.Schema({
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
  updated: {
    type: Date,
    default: Date.now,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

export default minecraftTgBot.model('chats', chatSchema);
