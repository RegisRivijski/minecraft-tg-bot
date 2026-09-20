import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import config from '../../config/default.js';
import { kitTellraw, kitText } from './copyHelper.js';
import { postToEvents } from './forumHelper.js';
import { isMinecraftNick, parseGiveResult } from './minecraftHelper.js';
import {
  confirmDailyLoginBonus,
  confirmStarterKit,
  releaseDailyLoginBonus,
  releaseStarterKit,
  tryClaimDailyLoginBonus,
  tryClaimStarterKit,
} from './worldStatsHelper.js';

const GIVE_ATTEMPTS = 3;
const GIVE_RETRY_MS = 1500;

const STARTER_ITEMS = [
  { id: 'minecraft:white_bed', count: 1, label: 'кровать' },
  { id: 'minecraft:iron_pickaxe', count: 1, label: 'железная кирка' },
  { id: 'minecraft:iron_axe', count: 1, label: 'железный топор' },
  { id: 'minecraft:bread', count: 16, label: 'хлеб ×16' },
  { id: 'minecraft:torch', count: 16, label: 'факелы ×16' },
  { id: 'minecraft:oak_log', count: 16, label: 'дуб ×16' },
  { id: 'minecraft:cooked_beef', count: 8, label: 'стейки ×8' },
  { id: 'minecraft:emerald', count: 8, label: 'изумруды ×8' },
];

const WEEKDAY_DAILY = {
  1: [{ id: 'minecraft:emerald', count: 12, label: '12 изумрудов' }],
  2: [{ id: 'minecraft:cooked_beef', count: 16, label: '16 стейков' }],
  3: [{ id: 'minecraft:iron_ingot', count: 8, label: '8 железа' }],
  4: [{ id: 'minecraft:oak_log', count: 32, label: '32 дуба' }],
  5: [{ id: 'minecraft:gold_ingot', count: 4, label: '4 золота' }],
  6: [
    { id: 'minecraft:golden_apple', count: 1, label: 'золотое яблоко' },
    { id: 'minecraft:emerald', count: 8, label: '8 изумрудов' },
  ],
  0: [{ id: 'minecraft:diamond', count: 1, label: 'алмаз' }],
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function giveItem(name, item) {
  let lastRaw = '';
  for (let attempt = 1; attempt <= GIVE_ATTEMPTS; attempt += 1) {
    lastRaw = await rconSend(`give ${name} ${item.id} ${item.count}`).catch(() => '');
    if (parseGiveResult(lastRaw)) {
      return true;
    }
    if (attempt < GIVE_ATTEMPTS) {
      await sleep(GIVE_RETRY_MS);
    }
  }
  console.warn(`[kit] give failed ${name} ${item.id}:`, String(lastRaw).slice(0, 200));
  return false;
}

async function giveItems(name, items) {
  let given = 0;
  for (const item of items) {
    if (await giveItem(name, item)) {
      given += 1;
    }
  }
  return given;
}

export function dailyRewardFor(weekday, streak) {
  const items = [...(WEEKDAY_DAILY[weekday] || WEEKDAY_DAILY[1])];
  if (streak === 3) {
    items.push({ id: 'minecraft:golden_apple', count: 1, label: 'яблоко за 3 дня' });
  }
  if (streak > 0 && streak % 7 === 0) {
    items.push({ id: 'minecraft:diamond', count: 1, label: `алмаз за ${streak} дней` });
  }
  return items;
}

async function deliverKit(telegram, name, {
  items, title, claim, confirm, release, logTag,
}) {
  if (!isMinecraftNick(name) || !items?.length) {
    return false;
  }
  if (!claim()) {
    return false;
  }
  try {
    const given = await giveItems(name, items);
    if (!given) {
      release();
      return false;
    }
    confirm();
    const labels = items.map((item) => item.label);
    await rconSend(`tellraw ${name} ${kitTellraw(title, labels)}`).catch(() => '');
    console.info(`[${logTag}] ${name} ${labels.join(', ')}`);
    await postToEvents(telegram, kitText(name, title, labels));
    return true;
  } catch (err) {
    release();
    console.warn(`[${logTag}]`, err.message);
    return false;
  }
}

export async function grantStarterKit(telegram, name) {
  if (!config.server.starterKit) {
    return false;
  }
  return deliverKit(telegram, name, {
    items: STARTER_ITEMS,
    title: 'Стартовый набор',
    claim: () => tryClaimStarterKit(name),
    confirm: confirmStarterKit,
    release: () => releaseStarterKit(name),
    logTag: 'starter',
  });
}

export async function grantDailyLoginReward(telegram, name) {
  if (!config.server.dailyLoginEmeralds || !isMinecraftNick(name)) {
    return false;
  }
  const claim = tryClaimDailyLoginBonus(name);
  if (!claim) {
    return false;
  }
  const items = dailyRewardFor(claim.weekday, claim.streak);
  return deliverKit(telegram, name, {
    items,
    title: `Ежедневка · ${claim.streak} дн. подряд`,
    claim: () => true,
    confirm: () => confirmDailyLoginBonus(name),
    release: () => releaseDailyLoginBonus(name),
    logTag: 'daily',
  });
}

export async function onEasyAuth(telegram, event) {
  if (event.type === 'register') {
    await grantStarterKit(telegram, event.name);
    await grantDailyLoginReward(telegram, event.name);
    return;
  }
  if (event.type === 'login') {
    await grantDailyLoginReward(telegram, event.name);
  }
}
