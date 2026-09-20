import config from '../../config/default.js';
import { postToEvents } from './forumHelper.js';
import { startPolling } from './pollHelper.js';
import { startStatusBoard } from './statusBoardHelper.js';
import {
  dailyRecapText,
  emptyWorldText,
  tpsAlertText,
  tpsRecoveredText,
  weeklyRecapText,
} from './copyHelper.js';
import {
  takeDailyRecap,
  takeEmptyWorldAnnouncement,
  takeWeeklyRecap,
  zonedParts,
} from './worldStatsHelper.js';

export function startChannelWatchers(telegram) {
  const noteTps = createTpsAlerter();
  const stopSchedule = startScheduleWatcher(telegram);
  const stopStatus = startStatusBoard(telegram, {
    onSnapshot: (snapshot) => noteTps(telegram, snapshot.tps),
  });
  return () => {
    stopSchedule();
    stopStatus();
  };
}

function createTpsAlerter() {
  let lagging = null;
  return async function noteTps(telegram, tps) {
    if (tps == null) {
      return;
    }
    if (lagging == null) {
      lagging = tps < config.server.tpsAlertBelow;
      return;
    }
    if (!lagging && tps < config.server.tpsAlertBelow) {
      lagging = true;
      console.info(`[tps] alert ${tps.toFixed(1)}`);
      await postToEvents(telegram, tpsAlertText(tps));
      return;
    }
    if (lagging && tps >= config.server.tpsRecoverAt) {
      lagging = false;
      console.info(`[tps] recovered ${tps.toFixed(1)}`);
      await postToEvents(telegram, tpsRecoveredText(tps));
    }
  };
}

function startScheduleWatcher(telegram) {
  console.info(`[schedule] daily ${config.server.dailyRecapHour}:00 ${config.server.timeZone}, empty at ${config.server.emptyWorldHours.join('/')}h then daily`);
  return startPolling(async () => {
    const empty = takeEmptyWorldAnnouncement();
    if (empty) {
      console.info(`[empty] ${empty.days ? `${empty.days}d` : `${empty.hours}h`}`);
      await postToEvents(telegram, emptyWorldText(empty));
    }

    const parts = zonedParts();
    const daily = takeDailyRecap(parts);
    if (daily) {
      console.info(`[recap] daily players=${daily.players.length} deaths=${daily.deaths}`);
      await postToEvents(telegram, dailyRecapText(daily));
    }

    const weekly = takeWeeklyRecap(parts);
    if (weekly) {
      console.info(`[recap] weekly play=${weekly.playTop.length} deaths=${weekly.deathTop.length}`);
      await postToEvents(telegram, weeklyRecapText(weekly));
    }
  }, config.server.recapPollMs, { name: 'schedule' });
}
