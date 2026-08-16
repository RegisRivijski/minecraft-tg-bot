import mongoose from 'mongoose';

import minecraftTgBot from '../../classes/MongooseSignletons/MongooseMinecraftTgBotSingleton.js';

const chatsSchema = new mongoose.Schema({
  chatId: {
    type: Number,
    required: true,
    unique: true,
  },
  kind: {
    type: String,
    enum: ['private', 'group'],
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'revoked'],
  },
  title: {
    type: String,
    default: '',
  },
  username: {
    type: String,
    default: '',
  },
  firstName: {
    type: String,
    default: '',
  },
  lastName: {
    type: String,
    default: '',
  },
  requestedBy: {
    type: Number,
  },
  requestedAt: {
    type: Date,
  },
  decidedBy: {
    type: Number,
  },
  decidedAt: {
    type: Date,
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
