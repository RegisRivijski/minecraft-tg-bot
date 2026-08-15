import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { listJoinRelay } from './chatRelayHelper.js';
import { HTML, joinLeaveText } from './copyHelper.js';
import { parsePlayerList } from './minecraftHelper.js';
import config from '../../config/default.js';

export function startPlayerWatcher(telegram) {
  let known = null;
  let timer = null;
  let inFlight = false;

  const tick = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const current = parsePlayerList(await rconSend('list'));
      if (!current.ok) {
        console.warn('[watcher] unexpected list response:', current.raw);
        return;
      }
      const next = new Set(current.players);

      if (known) {
        const joined = current.players.filter((name) => !known.has(name));
        const left = [...known].filter((name) => !next.has(name));
        const chats = listJoinRelay();
        if ((joined.length || left.length) && chats.length) {
          const text = joinLeaveText(joined, left, current);
          await Promise.all(chats.map((chatId) => (
            telegram.sendMessage(chatId, text, HTML).catch((err) => {
              console.warn(`[notify] chat ${chatId}:`, err.message);
            })
          )));
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
