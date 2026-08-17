import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { parsePlayerList } from './minecraftHelper.js';
import { notifyJoinLeave } from './joinNotifyHelper.js';
import { recordPlayerSnapshot } from './worldStatsHelper.js';
import config from '../../config/default.js';

export function startPlayerWatcher(telegram) {
  let previousPlayers = null;
  let timer = null;
  let inFlight = false;
  let lastWarnAt = 0;

  const pollPlayerList = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const current = parsePlayerList(await rconSend('list'));
      if (!current.ok) {
        if (Date.now() - lastWarnAt > 60000) {
          console.warn('[watcher] unexpected list response:', current.raw);
          lastWarnAt = Date.now();
        }
        return;
      }

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
    } catch (err) {
      console.warn('[watcher]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(pollPlayerList, config.server.pollIntervalMs);
  pollPlayerList();

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
