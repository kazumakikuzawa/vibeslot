import assert from 'node:assert/strict';
import test from 'node:test';
import { SYMBOLS, createSpin, evaluateSpin, pickWeightedSymbol } from '../src/gameLogic.js';

test('weighted picker returns a valid symbol at both boundaries', () => {
  assert.equal(pickWeightedSymbol(() => 0), SYMBOLS[0]);
  assert.equal(pickWeightedSymbol(() => 0.999999), SYMBOLS.at(-1));
});

test('jackpot awards 1,000 credits', () => {
  const result = evaluateSpin([SYMBOLS[0], SYMBOLS[0], SYMBOLS[0]]);
  assert.equal(result.payout, 1000);
  assert.equal(result.tier, 'jackpot');
  assert.equal(result.nextStreak, 1);
});

test('a third consecutive win activates the streak multiplier', () => {
  const result = evaluateSpin([SYMBOLS[2], SYMBOLS[2], SYMBOLS[2]], 2);
  assert.equal(result.multiplier, 1.25);
  assert.equal(result.payout, 375);
});

test('ordinary misses reset the streak', () => {
  const result = evaluateSpin([SYMBOLS[1], SYMBOLS[2], SYMBOLS[3]], 4);
  assert.equal(result.payout, 0);
  assert.equal(result.nextStreak, 0);
});

test('forced triple branch produces three matching symbols', () => {
  const values = [0.01, 0.1];
  const spin = createSpin(() => values.shift() ?? 0.1);
  assert.ok(spin.every((symbol) => symbol.id === spin[0].id));
});
