import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { parsePlayerList } from './minecraftHelper.js';
import { notifyJoinLeave } from './joinNotifyHelper.js';
import { startPolling } from './pollHelper.js';
import { recordPlayerSnapshot } from './worldStatsHelper.js';
import config from '../../config/default.js';

let lastList = null;
let lastListAt = 0;

export function recentPlayerList(maxAgeMs = 8000) {
  if (!lastList?.ok || Date.now() - lastListAt > maxAgeMs) {
    return null;
  }
  return lastList;
}

export function startPlayerWatcher(telegram) {
  let previousPlayers = null;
  let lastWarnAt = 0;

  return startPolling(async () => {
    const current = parsePlayerList(await rconSend('list'));
    if (!current.ok) {
      if (Date.now() - lastWarnAt > 60000) {
        console.warn('[watcher] unexpected list response:', current.raw);
        lastWarnAt = Date.now();
      }
      return;
    }

    lastList = current;
    lastListAt = Date.now();
    const currentPlayers = new Set(current.players);
    recordPlayerSnapshot(current.players);

    // First successful poll only stores a snapshot, so a bot restart
    // does not announce everyone who is already online.
    if (previousPlayers) {
      const joined = current.players.filter((name) => !previousPlayers.has(name));
      const left = [...previousPlayers].filter((name) => !currentPlayers.has(name));
      if (joined.length || left.length) {
        await notifyJoinLeave(telegram, { joined, left, current });
      }
    }

    previousPlayers = currentPlayers;
  }, config.server.pollIntervalMs, { name: 'watcher' });
}
