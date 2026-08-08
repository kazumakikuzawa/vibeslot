import assert from 'node:assert/strict';
import test from 'node:test';
import { PAYLINES, SYMBOLS, createCoinTimeline, createGridSpin, createSpin, evaluateGridSpin, evaluateSpin, pickWeightedSymbol } from '../src/gameLogic.js';

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

test('grid exposes four horizontal, five vertical, and four diagonal paylines', () => {
  assert.equal(PAYLINES.filter((line) => line.type === 'horizontal').length, 4);
  assert.equal(PAYLINES.filter((line) => line.type === 'vertical').length, 5);
  assert.equal(PAYLINES.filter((line) => line.type === 'diagonal').length, 4);
});

test('grid evaluation finds crossing horizontal and vertical wins', () => {
  const grid = Array.from({ length: 20 }, (_, index) => SYMBOLS[(index + 1) % SYMBOLS.length]);
  PAYLINES[0].cells.forEach((cell) => { grid[cell] = SYMBOLS[0]; });
  PAYLINES[4].cells.forEach((cell) => { grid[cell] = SYMBOLS[0]; });
  const result = evaluateGridSpin(grid);
  assert.ok(result.wins.some((win) => win.lineIndex === 0));
  assert.ok(result.wins.some((win) => win.lineIndex === 4));
  assert.ok(result.payout > 0);
});

test('grid spin always returns twenty symbols', () => {
  assert.equal(createGridSpin(() => 0.9).length, 20);
});

test('coin timeline distributes every coin across the width and finishes within two seconds', () => {
  const timeline = createCoinTimeline(120);
  assert.equal(timeline.length, 120);
  assert.ok(timeline[0].x < 1);
  assert.ok(timeline.at(-1).x > 99);
  assert.ok(timeline.every((coin) => coin.delay + coin.duration <= 2));
  assert.ok(new Set(timeline.map((coin) => coin.delay)).size > 10);
});
