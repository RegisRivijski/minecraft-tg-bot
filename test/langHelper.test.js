import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAdvancement, translateDeathMessage } from '../app/helpers/langHelper.js';

describe('translateDeathMessage', () => {
  it('keeps the nick and translates vanilla English deaths', () => {
    assert.equal(translateDeathMessage('Steve was slain by Zombie'), 'Steve был убит: зомби');
    assert.equal(translateDeathMessage('Alex drowned'), 'Alex утонул');
    assert.equal(
      translateDeathMessage('Steve was obliterated by a sonically-charged shriek of Warden'),
      'Steve стёрт криком Хранителя (хранитель)',
    );
  });

  it('leaves unknown lines unchanged', () => {
    assert.equal(translateDeathMessage('Steve did a backflip'), 'Steve did a backflip');
  });
});

describe('resolveAdvancement', () => {
  it('maps English and Russian titles to the wiki', () => {
    const fromEn = resolveAdvancement('Stone Age');
    assert.equal(fromEn.id, 'story/mine_stone');
    assert.equal(fromEn.ru, 'Каменный век');
    assert.equal(fromEn.url, `https://ru.minecraft.wiki/w/${encodeURIComponent('Каменный_век')}`);

    const fromRu = resolveAdvancement('Каменный век');
    assert.equal(fromRu.id, 'story/mine_stone');
  });

  it('accepts known title aliases', () => {
    assert.equal(resolveAdvancement('Cover Me with Diamonds').id, 'story/shiny_gear');
  });

  it('falls back to the raw title', () => {
    const unknown = resolveAdvancement('Custom Pack Goal');
    assert.equal(unknown.id, null);
    assert.equal(unknown.ru, 'Custom Pack Goal');
  });
});
