import { ADVANCEMENT_ENTRIES } from '../constants/advancements.js';

function normalizeTitle(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[«»""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const advancementByTitle = new Map();
for (const [id, en, ru] of ADVANCEMENT_ENTRIES) {
  const entry = { id, en, ru };
  advancementByTitle.set(normalizeTitle(en), entry);
  advancementByTitle.set(normalizeTitle(ru), entry);
}

advancementByTitle.set(normalizeTitle('Cover Me with Diamonds'), advancementByTitle.get(normalizeTitle('Cover Me With Diamonds')));
advancementByTitle.set(normalizeTitle('Two Birds One Arrow'), advancementByTitle.get(normalizeTitle('Two Birds, One Arrow')));
advancementByTitle.set(normalizeTitle("Who's the Pillager Now"), advancementByTitle.get(normalizeTitle("Who's the Pillager Now?")));
advancementByTitle.set(normalizeTitle('Minecraft: Trial Edition'), advancementByTitle.get(normalizeTitle('Minecraft: Trial(s) Edition')));
advancementByTitle.set(normalizeTitle('мыш (кродёться)'), advancementByTitle.get(normalizeTitle('мыш (кродеться)')));

function wikiUrl(title) {
  const slug = String(title || '')
    .trim()
    .replace(/ /g, '_');
  return `https://ru.minecraft.wiki/w/${encodeURIComponent(slug)}`;
}

export function resolveAdvancement(title) {
  const raw = String(title || '').trim();
  const found = advancementByTitle.get(normalizeTitle(raw));
  const ru = found?.ru || raw;
  return {
    id: found?.id || null,
    ru,
    url: wikiUrl(ru),
  };
}

const MOB_NAMES = {
  zombie: 'зомби',
  'zombie villager': 'крестьянин-зомби',
  husk: 'кадавр',
  drowned: 'утопленник',
  skeleton: 'скелет',
  stray: 'зимогог',
  wither: 'визер',
  'wither skeleton': 'визер-скелет',
  creeper: 'крипер',
  spider: 'паук',
  'cave spider': 'пещерный паук',
  enderman: 'эндермен',
  endermite: 'эндермит',
  blaze: 'ифрит',
  ghast: 'гаст',
  slime: 'слизень',
  'magma cube': 'магмовый куб',
  witch: 'ведьма',
  silverfish: 'чешуйница',
  phantom: 'фантом',
  pillager: 'разбойник',
  vindicator: 'поборник',
  evoker: 'заклинатель',
  ravager: 'разоритель',
  vex: 'вредина',
  illusioner: 'иллюзор',
  piglin: 'пиглин',
  'piglin brute': 'брутальный пиглин',
  hoglin: 'хоглин',
  zoglin: 'зоглин',
  'zombified piglin': 'зомбифицированный пиглин',
  'zombified pigman': 'зомбифицированный пиглин',
  warden: 'хранитель',
  guardian: 'страж',
  'elder guardian': 'древний страж',
  shulker: 'шалкер',
  'ender dragon': 'эндер-дракон',
  wolf: 'волк',
  iron: 'железный голем',
  'iron golem': 'железный голем',
  villager: 'крестьянин',
  'wandering trader': 'странствующий торговец',
  bee: 'пчела',
  goat: 'коза',
  fox: 'лиса',
  panda: 'панда',
  llama: 'лама',
  trader: 'лама торговца',
  cat: 'кошка',
  parrot: 'попугай',
  horse: 'лошадь',
  donkey: 'осёл',
  mule: 'мул',
  player: 'игрок',
};

function translateMob(name) {
  const raw = String(name || '').replace(/\s+/g, ' ').trim();
  const using = raw.match(/^(.*?) using (.+)$/i);
  if (using) {
    return `${translateMob(using[1])} с помощью ${using[2]}`;
  }
  const key = raw.toLowerCase().replace(/^the /i, '');
  return MOB_NAMES[key] || raw;
}

const DEATH_TEMPLATES = [
  [/ was slain by (.+)$/i, (_, mob) => ` был убит: ${translateMob(mob)}`],
  [/ was shot by (.+)$/i, (_, mob) => ` был застрелен: ${translateMob(mob)}`],
  [/ was blown up by (.+)$/i, (_, mob) => ` был взорван: ${translateMob(mob)}`],
  [/ was fireballed by (.+)$/i, (_, mob) => ` сгорел от файербола: ${translateMob(mob)}`],
  [/ was killed by (.+?) using magic$/i, (_, mob) => ` убит магией: ${translateMob(mob)}`],
  [/ was killed by even more magic$/i, () => ' убит ещё большей магией'],
  [/ was killed by magic$/i, () => ' убит магией'],
  [/ was killed by (.+)$/i, (_, mob) => ` был убит: ${translateMob(mob)}`],
  [/ was pummeled by (.+)$/i, (_, mob) => ` избит: ${translateMob(mob)}`],
  [/ was stung to death by (.+)$/i, (_, mob) => ` умер от жала: ${translateMob(mob)}`],
  [/ was obliterated by a sonically-charged shriek(?: of (.+))?$/i, (_, mob) => (mob ? ` стёрт криком Хранителя (${translateMob(mob)})` : ' стёрт криком Хранителя')],
  [/ was poked to death by a sweet berry bush$/i, () => ' погиб в кустах сладких ягод'],
  [/ walked into a cactus whilst trying to escape (.+)$/i, (_, mob) => ` напоролся на кактус, убегая от: ${translateMob(mob)}`],
  [/ walked into danger zone due to (.+)$/i, (_, mob) => ` зашёл в опасную зону из-за: ${translateMob(mob)}`],
  [/ was doomed to fall by (.+)$/i, (_, mob) => ` был обречён на падение: ${translateMob(mob)}`],
  [/ was doomed to fall$/i, () => ' был обречён на падение'],
  [/ didn't want to live in the same world as (.+)$/i, (_, mob) => ` не захотел жить в одном мире с: ${translateMob(mob)}`],
  [/ was impaled by (.+)$/i, (_, mob) => ` пронзён: ${translateMob(mob)}`],
  [/ was impaled on a stalagmite$/i, () => ' пронзён сталагмитом'],
  [/ was skewered by a falling stalactite(?: whilst fighting (.+))?$/i, (_, mob) => (mob ? ` пронзён падающим сталактитом, сражаясь с: ${translateMob(mob)}` : ' пронзён падающим сталактитом')],
  [/ was skewered by (.+)$/i, (_, mob) => ` насажен: ${translateMob(mob)}`],
  [/ was roasted in dragon breath(?: by (.+))?$/i, (_, mob) => (mob ? ` сожжён дыханием дракона (${translateMob(mob)})` : ' сожжён дыханием дракона')],
  [/ tried to swim in lava to escape (.+)$/i, (_, mob) => ` пытался уплыть от ${translateMob(mob)} в лаве`],
  [/ walked into fire whilst fighting (.+)$/i, (_, mob) => ` зашёл в огонь, сражаясь с: ${translateMob(mob)}`],
  [/ burned to death whilst fighting (.+)$/i, (_, mob) => ` сгорел, сражаясь с: ${translateMob(mob)}`],
  [/ went up in flames$/i, () => ' сгорел'],
  [/ burned to death$/i, () => ' сгорел заживо'],
  [/ tried to swim in lava$/i, () => ' пытался плавать в лаве'],
  [/ discovered (the )?floor was lava$/i, () => ' обнаружил, что пол — это лава'],
  [/ drowned whilst trying to escape (.+)$/i, (_, mob) => ` утонул, убегая от: ${translateMob(mob)}`],
  [/ drowned$/i, () => ' утонул'],
  [/ starved to death whilst fighting (.+)$/i, (_, mob) => ` умер от голода, сражаясь с: ${translateMob(mob)}`],
  [/ starved to death$/i, () => ' умер от голода'],
  [/ suffocated in a wall whilst fighting (.+)$/i, (_, mob) => ` задохнулся в стене, сражаясь с: ${translateMob(mob)}`],
  [/ suffocated in a wall$/i, () => ' задохнулся в стене'],
  [/ withered away whilst fighting (.+)$/i, (_, mob) => ` иссох, сражаясь с: ${translateMob(mob)}`],
  [/ withered away$/i, () => ' иссох'],
  [/ was pricked to death$/i, () => ' умер, напоровшись на кактус'],
  [/ walked into a cactus$/i, () => ' напоролся на кактус'],
  [/ experienced kinetic energy whilst trying to escape (.+)$/i, (_, mob) => ` не выдержал кинетической энергии, убегая от: ${translateMob(mob)}`],
  [/ experienced kinetic energy$/i, () => ' не выдержал кинетической энергии'],
  [/ blew up$/i, () => ' взорвался'],
  [/ hit the ground too hard whilst trying to escape (.+)$/i, (_, mob) => ` слишком сильно ударился о землю, убегая от: ${translateMob(mob)}`],
  [/ hit the ground too hard$/i, () => ' слишком сильно ударился о землю'],
  [/ fell from a high place$/i, () => ' упал с высоты'],
  [/ fell too far and was squashed by a stalagmite$/i, () => ' упал слишком низко и был пронзён сталагмитом'],
  [/ fell off .+$/i, () => ' упал'],
  [/ fell while climbing$/i, () => ' сорвался при подъёме'],
  [/ fell out of the world$/i, () => ' выпал из мира'],
  [/ left the confines of this world$/i, () => ' покинул пределы этого мира'],
  [/ was squashed by a falling (anvil|block)$/i, (_, what) => ` раздавлен падающим ${what === 'anvil' ? 'наковальней' : 'блоком'}`],
  [/ was squashed .+$/i, () => ' был раздавлен'],
  [/ was squished .+$/i, () => ' был раздавлен'],
  [/ froze to death whilst fighting (.+)$/i, (_, mob) => ` замёрз насмерть, сражаясь с: ${translateMob(mob)}`],
  [/ froze to death$/i, () => ' замёрз насмерть'],
  [/ was struck by lightning whilst fighting (.+)$/i, (_, mob) => ` поражён молнией, сражаясь с: ${translateMob(mob)}`],
  [/ was struck by lightning$/i, () => ' поражён молнией'],
  [/ went off with a bang$/i, () => ' взорвался с фейерверком'],
  [/ died$/i, () => ' умер'],
];

export function translateDeathMessage(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return raw;
  }
  const name = raw.split(' ', 1)[0];
  const rest = raw.slice(name.length);
  if (!DEATH_TEMPLATES.some(([pattern]) => pattern.test(rest))) {
    return raw;
  }
  let translated = rest;
  for (const [pattern, replace] of DEATH_TEMPLATES) {
    if (pattern.test(translated)) {
      translated = translated.replace(pattern, replace);
      break;
    }
  }
  return `${name}${translated}`;
}
