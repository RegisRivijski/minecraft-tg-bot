import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  commandArgs,
  describeDaytime,
  describeMoonPhase,
  escapeHtml,
  isMinecraftNick,
  parseChatLine,
  parseJoinLeaveLine,
  parseMusicEventLine,
  parseNightSkipLine,
  parsePlayerList,
  parsePlayerUuidLine,
  parseSeed,
  parseServerLifecycleLine,
  parseTimeQuery,
  parseTpsWindows,
  parseWeatherQuery,
  parseWhitelistList,
  parseWorldEventLine,
  speakerName,
  stripMcColor,
  ticksToClock,
} from '../app/helpers/minecraftHelper.js';

const log = (payload) => `[18:00:00] [Server thread/INFO]: ${payload}`;

describe('escapeHtml / stripMcColor', () => {
  it('escapes Telegram HTML', () => {
    assert.equal(escapeHtml('<Steve> & co'), '&lt;Steve&gt; &amp; co');
  });

  it('strips section and ANSI colors', () => {
    assert.equal(stripMcColor('§aSteve§r \u001b[0mhi'), 'Steve hi');
  });
});

describe('parsePlayerList', () => {
  it('parses vanilla / Fabric list output', () => {
    const list = parsePlayerList('There are 2 of a max of 16 players online: Steve, Alex');
    assert.deepEqual(list, {
      ok: true,
      online: 2,
      max: 16,
      players: ['Steve', 'Alex'],
      raw: 'There are 2 of a max of 16 players online: Steve, Alex',
    });
  });

  it('returns an empty roster when nobody is online', () => {
    const list = parsePlayerList('There are 0 of a max of 16 players online:');
    assert.equal(list.ok, true);
    assert.equal(list.online, 0);
    assert.deepEqual(list.players, []);
  });

  it('drops non-nicks from the name list', () => {
    const list = parsePlayerList('There are 1 of a max of 16 players online: Steve (fake), not a nick!');
    assert.deepEqual(list.players, ['Steve']);
  });
});

describe('RCON parsers', () => {
  it('reads daytime ticks', () => {
    assert.equal(parseTimeQuery('The time is 6000'), 6000);
    assert.equal(parseTimeQuery('Incorrect argument for command'), null);
  });

  it('maps ticks to clock and phase', () => {
    assert.equal(ticksToClock(0), '06:00');
    assert.equal(describeDaytime(6000).phase, 'noon');
    assert.equal(describeDaytime(18000).phase, 'midnight');
  });

  it('maps moon phases from day number', () => {
    assert.equal(describeMoonPhase(0).key, 'full');
    assert.equal(describeMoonPhase(4).key, 'new');
  });

  it('parses Spark TPS using the 1m/5m/15m windows', () => {
    const spark = [
      'TPS from last 5s, 10s, 1m, 5m, 15m:',
      '20.0, 19.9, 19.8, 19.7, 19.6',
    ].join('\n');
    assert.deepEqual(parseTpsWindows(spark), {
      current: 19.8,
      windows: [19.8, 19.7, 19.6],
    });
  });

  it('parses Paper TPS on one line', () => {
    assert.deepEqual(
      parseTpsWindows('TPS from last 1m, 5m, 15m: 20.0, 19.5, 19.0'),
      { current: 20, windows: [20, 19.5, 19] },
    );
  });

  it('parses weather, seed, and whitelist', () => {
    assert.equal(parseWeatherQuery('The weather is raining'), 'rain');
    assert.equal(parseSeed('Seed: [123456789]'), '123456789');
    const whitelist = parseWhitelistList('There are 2 whitelisted players: Steve, Alex');
    assert.equal(whitelist.ok, true);
    assert.deepEqual(whitelist.players, ['Steve', 'Alex']);
  });
});

describe('log lines', () => {
  it('parses join and leave', () => {
    assert.deepEqual(parseJoinLeaveLine(log('Steve joined the game')), { type: 'join', name: 'Steve' });
    assert.deepEqual(parseJoinLeaveLine(log('Steve left the game')), { type: 'leave', name: 'Steve' });
    assert.deepEqual(
      parseJoinLeaveLine(log('Steve присоединился к игре')),
      { type: 'join', name: 'Steve' },
    );
  });

  it('parses chat and server say', () => {
    assert.deepEqual(parseChatLine(log('<Steve> hello')), { name: 'Steve', message: 'hello' });
    assert.deepEqual(parseChatLine(log('[Not Secure] <Steve> hi')), { name: 'Steve', message: 'hi' });
    assert.deepEqual(parseChatLine(log('[Server] restart soon')), { name: 'Server', message: 'restart soon' });
  });

  it('parses advancements and deaths', () => {
    assert.deepEqual(
      parseWorldEventLine(log('Steve has made the advancement [Stone Age]')),
      {
        type: 'advancement',
        kind: 'advancement',
        name: 'Steve',
        title: 'Stone Age',
        text: 'Steve has made the advancement [Stone Age]',
      },
    );
    assert.deepEqual(
      parseWorldEventLine(log('Steve was slain by Zombie')),
      { type: 'death', name: 'Steve', text: 'Steve was slain by Zombie' },
    );
  });

  it('parses named pet deaths and ignores noise', () => {
    const pet = parseWorldEventLine(
      log("Named entity Wolf['Buddy'/12, uuid='abc'] died, message: 'Buddy was slain by Zombie'"),
    );
    assert.equal(pet?.type, 'pet_death');
    assert.equal(pet.name, 'Buddy');
    assert.equal(pet.entityType, 'Wolf');
    assert.equal(parseWorldEventLine(log("UUID of player Steve is 069a79f4-44e9-4726-a5be-fca374d1aa12")), null);
    assert.equal(parseWorldEventLine(log("Can't keep up! Is the server overloaded?")), null);
  });

  it('parses music, night skip, UUID, and lifecycle', () => {
    assert.deepEqual(
      parseMusicEventLine(log('[Music] Artur started playback at volume 50')),
      { type: 'music_started', name: 'Artur', volume: 50 },
    );
    assert.deepEqual(
      parseMusicEventLine(log('[Music] Now playing: Song (requested by Artur)')),
      { type: 'music_now_playing', title: 'Song', name: 'Artur' },
    );
    assert.equal(parseNightSkipLine(log('Skipping the night because all players are sleeping'))?.type, 'night_skip');
    assert.deepEqual(
      parsePlayerUuidLine(log('UUID of player Steve is 069a79f4-44e9-4726-a5be-fca374d1aa12')),
      { name: 'Steve', uuid: '069a79f4-44e9-4726-a5be-fca374d1aa12' },
    );
    assert.equal(parseServerLifecycleLine(log('Done (4.2s)! For help, type "help"'))?.type, 'server_up');
    assert.equal(parseServerLifecycleLine(log('Stopping the server'))?.type, 'server_down');
  });
});

describe('nicks and command args', () => {
  it('accepts vanilla nicks only', () => {
    assert.equal(isMinecraftNick('Steve'), true);
    assert.equal(isMinecraftNick('too_long_for_minecraft'), false);
    assert.equal(isMinecraftNick('Steve!'), false);
  });

  it('strips the slash command from message text', () => {
    assert.equal(commandArgs({ message: { text: '/time day' } }), 'day');
    assert.equal(commandArgs({ message: { text: '/whitelist@Bot add Steve' } }), 'add Steve');
  });

  it('reads a speaker name from Telegram context', () => {
    assert.equal(speakerName({ from: { first_name: 'Art', last_name: 'Petrov' } }), 'Art Petrov');
    assert.equal(speakerName({ message: { sender_chat: { title: 'Forum' } } }), 'Forum');
    assert.equal(speakerName({ from: { id: 42 } }), '42');
  });
});
