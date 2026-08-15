import fs from 'fs/promises';

import config from '../../config/default.js';
import { HTML, chatRelayLine, worldEventLine } from './copyHelper.js';
import { parseChatLine, parseJoinLeaveLine, parseWorldEventLine } from './minecraftHelper.js';
import { listAdvancementRelay, listChatRelay, listDeathRelay, listJoinRelay } from './chatRelayHelper.js';
import { notifyJoinLeave } from './joinNotifyHelper.js';

function previewLines(lines) {
  const limit = 20;
  const shown = lines.slice(0, limit);
  for (const line of shown) {
    console.info('[log]', line.slice(0, 300) || '(empty)');
  }
  if (lines.length > limit) {
    console.info(`[log] … and ${lines.length - limit} more lines`);
  }
}

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

    console.info(`[log] ${lines.length} new line(s)`);
    previewLines(lines);

    const chatMessages = [];
    const joined = [];
    const left = [];
    const deaths = [];
    const advancements = [];

    for (const line of lines) {
      const joinLeave = parseJoinLeaveLine(line);
      if (joinLeave) {
        console.info(`[log] parsed ${joinLeave.type}: ${joinLeave.name}`);
        if (joinLeave.type === 'join') {
          joined.push(joinLeave.name);
        } else {
          left.push(joinLeave.name);
        }
        continue;
      }

      const chat = parseChatLine(line);
      if (chat?.message) {
        console.info(`[log] parsed chat: <${chat.name}> ${chat.message.slice(0, 120)}`);
        chatMessages.push(chatRelayLine(chat.name, chat.message.slice(0, 400)));
        continue;
      }

      const event = parseWorldEventLine(line);
      if (event) {
        console.info(`[log] parsed ${event.type}: ${event.text.slice(0, 160)}`);
        const formatted = worldEventLine(event);
        if (event.type === 'advancement') {
          advancements.push(formatted);
        } else {
          deaths.push(formatted);
        }
      }
    }

    const chatChats = listChatRelay();
    const joinChats = listJoinRelay();
    const deathChats = listDeathRelay();
    const advancementChats = listAdvancementRelay();
    console.info(`[log] matched chat=${chatMessages.length} join=${joined.length} leave=${left.length} deaths=${deaths.length} advancements=${advancements.length}; relays chat=[${chatChats.join(', ') || '—'}] joins=[${joinChats.join(', ') || '—'}] deaths=[${deathChats.join(', ') || '—'}] advancements=[${advancementChats.join(', ') || '—'}]`);

    if (chatMessages.length && !chatChats.length) {
      console.info('[log] skip chat: /chat is off for all chats');
    }
    if ((joined.length || left.length) && !joinChats.length) {
      console.info('[log] skip join/leave: /joins is off for all chats');
    }
    if (deaths.length && !deathChats.length) {
      console.info('[log] skip deaths: /deaths is off for all chats');
    }
    if (advancements.length && !advancementChats.length) {
      console.info('[log] skip advancements: /advancements is off for all chats');
    }

    const send = async (chatIds, text, label) => {
      if (!text || !chatIds.length) {
        return;
      }
      await Promise.all(chatIds.map((chatId) => (
        telegram.sendMessage(chatId, text, HTML).catch((err) => {
          console.warn(`[${label}] chat ${chatId}:`, err.message);
        })
      )));
      console.info(`[log] sent ${label} to ${chatIds.length} chat(s)`);
    };

    await send(chatChats, chatMessages.join('\n'), 'chat');
    await send(deathChats, deaths.join('\n'), 'deaths');
    await send(advancementChats, advancements.join('\n'), 'advancements');

    await notifyJoinLeave(telegram, { joined, left });
  };

  console.info(`[log] starting watcher path=${config.server.logPath} poll=${config.server.logPollMs}ms`);

  const tick = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const stat = await fs.stat(config.server.logPath);
      if (!watchingLogged) {
        console.info(`[log] watching ${config.server.logPath} (${stat.size} bytes)`);
        watchingLogged = true;
      }
      missingLogged = false;

      if (offset == null || stat.size < offset) {
        console.info(`[log] ${offset == null ? 'start at end of file' : 'log rotated'}, offset=${stat.size}`);
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
        console.info(`[log] read ${length} bytes at offset ${offset}`);
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
          console.warn('[log] waiting for', config.server.logPath);
          missingLogged = true;
          watchingLogged = false;
        }
      } else {
        console.warn('[log]', err.message);
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
