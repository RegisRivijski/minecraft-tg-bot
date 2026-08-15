import { rconSend } from './rconClient.js';
import { notifyChatIds } from '../constants/access.js';
import { HTML, joinLeaveText } from '../helpers/copy.js';
import { parsePlayerList } from '../helpers/minecraft.js';
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
        if (joined.length || left.length) {
          const text = joinLeaveText(joined, left, current);
          await Promise.all(notifyChatIds().map((chatId) => (
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
