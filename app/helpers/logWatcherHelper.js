import fs from 'fs/promises';

import config from '../../config/default.js';
import { postToChat, postToEvents } from './forumHelper.js';
import {
  chatRelayLine,
  firstJoinText,
  musicEventLine,
  nightSkipText,
  petDeathLine,
  serverStartedText,
  serverStoppingText,
  worldEventLine,
  advancementLine,
  HTML_NO_PREVIEW,
} from './copyHelper.js';
import {
  parseChatLine,
  parseEasyAuthLine,
  parseJoinLeaveLine,
  parseMusicEventLine,
  parseNightSkipLine,
  parsePlayerUuidLine,
  parseServerLifecycleLine,
  parseWorldEventLine,
} from './minecraftHelper.js';
import { notifyJoinLeave } from './joinNotifyHelper.js';
import { onEasyAuth } from './rewardHelper.js';
import { startPolling } from './pollHelper.js';
import { notePlayerUuid, recordAdvancement, recordDeath, recordJoin, recordLeave } from './worldStatsHelper.js';
import { translateDeathMessage } from './langHelper.js';

const MAX_READ_BYTES = 512 * 1024;

function mergeMusicEvents(rawEvents) {
  const merged = [];
  let pendingStart = null;

  for (const event of rawEvents) {
    if (event.type === 'music_started') {
      if (pendingStart) {
        merged.push(pendingStart);
      }
      pendingStart = event;
      continue;
    }

    if (event.type === 'music_now_playing') {
      if (pendingStart) {
        merged.push({
          type: 'music_play',
          name: event.name || pendingStart.name,
          title: event.title,
          volume: pendingStart.volume,
        });
        pendingStart = null;
      } else {
        merged.push({
          type: 'music_play',
          name: event.name,
          title: event.title,
        });
      }
      continue;
    }

    if (pendingStart) {
      merged.push(pendingStart);
      pendingStart = null;
    }
    merged.push(event);
  }

  if (pendingStart) {
    merged.push(pendingStart);
  }
  return merged;
}

function classifyLogLines(lines) {
  const chatMessages = [];
  const joinLeaveEvents = [];
  const deaths = [];
  const advancements = [];
  const petDeaths = [];
  const firstJoins = [];
  const nightSkips = [];
  const serverLifecycle = [];
  const musicRaw = [];
  const authEvents = [];

  for (const line of lines) {
    const auth = parseEasyAuthLine(line);
    if (auth) {
      authEvents.push(auth);
      continue;
    }
    const lifecycle = parseServerLifecycleLine(line);
    if (lifecycle) {
      serverLifecycle.push(lifecycle);
      continue;
    }

    const nightSkip = parseNightSkipLine(line);
    if (nightSkip) {
      nightSkips.push(nightSkip);
      continue;
    }

    const uuidLine = parsePlayerUuidLine(line);
    if (uuidLine) {
      if (notePlayerUuid(uuidLine.uuid, uuidLine.name)) {
        firstJoins.push(uuidLine.name);
      }
      continue;
    }

    const joinLeave = parseJoinLeaveLine(line);
    if (joinLeave) {
      joinLeaveEvents.push(joinLeave);
      if (joinLeave.type === 'join') {
        recordJoin(joinLeave.name);
      } else {
        recordLeave(joinLeave.name);
      }
      continue;
    }

    const music = parseMusicEventLine(line);
    if (music) {
      musicRaw.push(music);
      continue;
    }

    const chat = parseChatLine(line);
    if (chat?.message) {
      chatMessages.push(chatRelayLine(chat.name, chat.message.slice(0, 400)));
      continue;
    }

    const event = parseWorldEventLine(line);
    if (event) {
      if (event.type === 'advancement') {
        recordAdvancement(event.name);
        advancements.push(advancementLine(event));
      } else if (event.type === 'pet_death') {
        petDeaths.push(petDeathLine({ ...event, text: translateDeathMessage(event.text) }));
      } else {
        recordDeath(event.name);
        deaths.push(worldEventLine({ ...event, text: translateDeathMessage(event.text) }));
      }
    }
  }

  return {
    chatMessages,
    joinLeaveEvents,
    deaths,
    advancements,
    petDeaths,
    firstJoins,
    nightSkips,
    serverLifecycle,
    musicEvents: mergeMusicEvents(musicRaw),
    authEvents,
  };
}

async function forwardLogEvents(telegram, events) {
  const {
    chatMessages,
    joinLeaveEvents,
    deaths,
    advancements,
    petDeaths,
    firstJoins,
    nightSkips,
    serverLifecycle,
    musicEvents,
    authEvents,
  } = events;
  const joinedCount = joinLeaveEvents.filter((event) => event.type === 'join').length;
  const leftCount = joinLeaveEvents.filter((event) => event.type === 'leave').length;

  console.info(`[log] matched chat=${chatMessages.length} join=${joinedCount} leave=${leftCount} deaths=${deaths.length} advancements=${advancements.length} pets=${petDeaths.length} first=${firstJoins.length} night=${nightSkips.length} lifecycle=${serverLifecycle.length} music=${musicEvents.length} auth=${authEvents.length}`);

  for (const event of serverLifecycle) {
    await postToEvents(
      telegram,
      event.type === 'server_up' ? serverStartedText() : serverStoppingText(),
    );
  }
  if (firstJoins.length) {
    await postToEvents(telegram, firstJoins.map(firstJoinText).join('\n'));
  }
  if (nightSkips.length) {
    await postToEvents(telegram, nightSkipText());
  }
  if (musicEvents.length) {
    await postToEvents(telegram, musicEvents.map(musicEventLine).join('\n'), HTML_NO_PREVIEW);
  }
  await postToChat(telegram, chatMessages.join('\n'));
  await postToEvents(telegram, deaths.join('\n'));
  await postToEvents(telegram, petDeaths.join('\n'));
  await postToEvents(telegram, advancements.join('\n'), HTML_NO_PREVIEW);
  await notifyJoinLeave(telegram, { events: joinLeaveEvents });
  for (const event of authEvents) {
    await onEasyAuth(telegram, event);
  }
}

export function startLogWatcher(telegram) {
  let readOffset = null;
  let incompleteLine = '';
  let textDecoder = new TextDecoder('utf-8');
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
    await forwardLogEvents(telegram, classifyLogLines(lines));
  };

  console.info(`[log] starting watcher path=${config.server.logPath} poll=${config.server.logPollMs}ms`);

  return startPolling(async () => {
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
        return;
      }
      throw err;
    }
  }, config.server.logPollMs, { name: 'log' });
}
