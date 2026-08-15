import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { parsePlayerList } from './minecraftHelper.js';
import { notifyJoinLeave } from './joinNotifyHelper.js';
import config from '../../config/default.js';

export function startPlayerWatcher(telegram) {
  let known = null;
  let timer = null;
  let inFlight = false;
  let lastWarnAt = 0;

  const tick = async () => {
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
      const next = new Set(current.players);

      if (known) {
        const joined = current.players.filter((name) => !known.has(name));
        const left = [...known].filter((name) => !next.has(name));
        if (joined.length || left.length) {
          await notifyJoinLeave(telegram, { joined, left, current });
        }
      }

      known = next;
    } catch (err) {
      console.warn('[watcher]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(tick, config.server.pollIntervalMs);
  tick();

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
