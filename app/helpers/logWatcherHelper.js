import fs from 'fs/promises';

import config from '../../config/default.js';
import { postToChannel } from './channelHelper.js';
import { chatRelayLine, worldEventLine } from './copyHelper.js';
import { parseChatLine, parseJoinLeaveLine, parseWorldEventLine } from './minecraftHelper.js';
import { notifyJoinLeave } from './joinNotifyHelper.js';

const MAX_READ_BYTES = 512 * 1024;

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

function classifyLogLines(lines) {
  const chatMessages = [];
  const joinLeaveEvents = [];
  const deaths = [];
  const advancements = [];

  for (const line of lines) {
    const joinLeave = parseJoinLeaveLine(line);
    if (joinLeave) {
      console.info(`[log] parsed ${joinLeave.type}: ${joinLeave.name}`);
      joinLeaveEvents.push(joinLeave);
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

  return {
    chatMessages, joinLeaveEvents, deaths, advancements,
  };
}

async function forwardLogEvents(telegram, events) {
  const {
    chatMessages, joinLeaveEvents, deaths, advancements,
  } = events;
  const joinedCount = joinLeaveEvents.filter((event) => event.type === 'join').length;
  const leftCount = joinLeaveEvents.filter((event) => event.type === 'leave').length;

  console.info(`[log] matched chat=${chatMessages.length} join=${joinedCount} leave=${leftCount} deaths=${deaths.length} advancements=${advancements.length}`);

  await postToChannel(telegram, chatMessages.join('\n'));
  await postToChannel(telegram, deaths.join('\n'));
  await postToChannel(telegram, advancements.join('\n'));
  await notifyJoinLeave(telegram, { events: joinLeaveEvents });
}

export function startLogWatcher(telegram) {
  let readOffset = null;
  let incompleteLine = '';
  let textDecoder = new TextDecoder('utf-8');
  let timer = null;
  let inFlight = false;
  let missingLogged = false;
  let watchingLogged = false;

  const resetReadState = (offset) => {
    readOffset = offset;
    incompleteLine = '';
    textDecoder = new TextDecoder('utf-8');
  };

  const processNewLogLines = async (lines) => {
    if (!lines.length) {
      return;
    }
    console.info(`[log] ${lines.length} new line(s)`);
    previewLines(lines);
    await forwardLogEvents(telegram, classifyLogLines(lines));
  };

  console.info(`[log] starting watcher path=${config.server.logPath} poll=${config.server.logPollMs}ms`);

  const pollLogFile = async () => {
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

      if (readOffset == null || stat.size < readOffset) {
        console.info(`[log] ${readOffset == null ? 'start at end of file' : 'log rotated'}, offset=${stat.size}`);
        resetReadState(stat.size);
        return;
      }
      if (stat.size === readOffset) {
        return;
      }

      const handle = await fs.open(config.server.logPath, 'r');
      try {
        const chunkSize = Math.min(stat.size - readOffset, MAX_READ_BYTES);
        const buffer = Buffer.alloc(chunkSize);
        await handle.read(buffer, 0, chunkSize, readOffset);
        console.info(`[log] read ${chunkSize} bytes at offset ${readOffset}`);
        readOffset += chunkSize;
        incompleteLine += textDecoder.decode(buffer, { stream: true });
      } finally {
        await handle.close();
      }

      const parts = incompleteLine.split(/\r?\n/);
      incompleteLine = parts.pop() || '';
      await processNewLogLines(parts);
    } catch (err) {
      if (err.code === 'ENOENT') {
        resetReadState(null);
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

  timer = setInterval(pollLogFile, config.server.logPollMs);
  pollLogFile();

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
