import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { dailyRewardFor } from '../app/helpers/rewardHelper.js';

describe('dailyRewardFor', () => {
  it('uses weekday loot', () => {
    assert.deepEqual(dailyRewardFor(1, 1).map((item) => item.id), ['minecraft:emerald']);
    assert.deepEqual(dailyRewardFor(0, 1).map((item) => item.id), ['minecraft:diamond']);
    assert.equal(dailyRewardFor(6, 1).length, 2);
  });

  it('adds streak extras at 3 and every 7 days', () => {
    const day3 = dailyRewardFor(1, 3).map((item) => item.id);
    assert.ok(day3.includes('minecraft:golden_apple'));
    const week = dailyRewardFor(2, 7).map((item) => item.id);
    assert.ok(week.includes('minecraft:diamond'));
    assert.equal(dailyRewardFor(1, 2).some((item) => item.id === 'minecraft:golden_apple'), false);
  });
});
