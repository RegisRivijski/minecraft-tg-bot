import fs from 'fs/promises';

import config from '../../config/default.js';
import { HTML, chatRelayLine } from './copyHelper.js';
import { parseChatLine, parseJoinLeaveLine } from './minecraftHelper.js';
import { listChatRelay } from './chatRelayHelper.js';
import { notifyJoinLeave } from './joinNotifyHelper.js';

export function startLogWatcher(telegram) {
  let offset = null;
  let leftover = '';
  let timer = null;
  let inFlight = false;
  let missingLogged = false;
  let watchingLogged = false;

  const sendLines = async (lines) => {
    if (!lines.length) {
      return;
    }

    const chatMessages = [];
    const joined = [];
    const left = [];

    for (const line of lines) {
      const joinLeave = parseJoinLeaveLine(line);
      if (joinLeave) {
        if (joinLeave.type === 'join') {
          joined.push(joinLeave.name);
        } else {
          left.push(joinLeave.name);
        }
        continue;
      }

      const chat = parseChatLine(line);
      if (chat?.message) {
        chatMessages.push(chatRelayLine(chat.name, chat.message.slice(0, 400)));
      }
    }

    const chatChats = listChatRelay();
    if (chatMessages.length && chatChats.length) {
      const text = chatMessages.join('\n');
      await Promise.all(chatChats.map((chatId) => (
        telegram.sendMessage(chatId, text, HTML).catch((err) => {
          console.warn(`[chat] chat ${chatId}:`, err.message);
        })
      )));
    }

    await notifyJoinLeave(telegram, { joined, left });
  };

  const tick = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const stat = await fs.stat(config.server.logPath);
      if (!watchingLogged) {
        console.info('[chat] watching', config.server.logPath);
        watchingLogged = true;
      }
      missingLogged = false;

      if (offset == null || stat.size < offset) {
        offset = stat.size;
        leftover = '';
        return;
      }
      if (stat.size === offset) {
        return;
      }

      const handle = await fs.open(config.server.logPath, 'r');
      try {
        const length = stat.size - offset;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, offset);
        offset = stat.size;
        leftover += buffer.toString('utf8');
      } finally {
        await handle.close();
      }

      const parts = leftover.split(/\r?\n/);
      leftover = parts.pop() || '';
      await sendLines(parts);
    } catch (err) {
      if (err.code === 'ENOENT') {
        offset = null;
        leftover = '';
        if (!missingLogged) {
          console.warn('[chat] waiting for', config.server.logPath);
          missingLogged = true;
          watchingLogged = false;
        }
      } else {
        console.warn('[chat]', err.message);
      }
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(tick, config.server.logPollMs);
  tick();

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
