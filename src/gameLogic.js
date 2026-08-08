export const SYMBOLS = [
  { id: 'seven', label: '7', color: '#ff315f', weight: 10 },
  { id: 'star', label: '★', color: '#ffd85a', weight: 13 },
  { id: 'diamond', label: '◆', color: '#42f5e6', weight: 15 },
  { id: 'bell', label: '●', color: '#ff8a34', weight: 17 },
  { id: 'cherry', label: 'CH', color: '#ff4b9b', weight: 20 },
  { id: 'bar', label: 'BAR', color: '#a96cff', weight: 25 },
];

export const STARTING_CREDITS = 1000;
export const SPIN_COST = 50;
export const GRID_ROWS = 4;
export const GRID_COLS = 5;

export const PAYLINES = [
  ...Array.from({ length: GRID_ROWS }, (_, row) => ({
    type: 'horizontal',
    cells: Array.from({ length: GRID_COLS }, (_, col) => row * GRID_COLS + col),
  })),
  ...Array.from({ length: GRID_COLS }, (_, col) => ({
    type: 'vertical',
    cells: Array.from({ length: GRID_ROWS }, (_, row) => row * GRID_COLS + col),
  })),
  { type: 'diagonal', cells: [0, 6, 12, 18] },
  { type: 'diagonal', cells: [1, 7, 13, 19] },
  { type: 'diagonal', cells: [3, 7, 11, 15] },
  { type: 'diagonal', cells: [4, 8, 12, 16] },
];

const LINE_VALUES = {
  seven: 80,
  star: 50,
  diamond: 35,
  bell: 25,
  cherry: 18,
  bar: 12,
};

export function pickWeightedSymbol(random = Math.random) {
  const total = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
  let cursor = random() * total;
  for (const symbol of SYMBOLS) {
    cursor -= symbol.weight;
    if (cursor < 0) return symbol;
  }
  return SYMBOLS.at(-1);
}

export function createSpin(random = Math.random) {
  // A small thrill-friendly nudge: occasional pairs and triples, still fully local and free-to-play.
  const roll = random();
  if (roll < 0.055) {
    const symbol = pickWeightedSymbol(random);
    return [symbol, symbol, symbol];
  }
  if (roll < 0.22) {
    const symbol = pickWeightedSymbol(random);
    const odd = pickWeightedSymbol(random);
    const layout = Math.floor(random() * 3);
    return [0, 1, 2].map((index) => (index === layout ? odd : symbol));
  }
  return [pickWeightedSymbol(random), pickWeightedSymbol(random), pickWeightedSymbol(random)];
}

export function evaluateSpin(symbols, streak = 0) {
  const [a, b, c] = symbols.map((symbol) => symbol.id);
  let base = 0;
  let tier = 'miss';

  if (a === b && b === c) {
    base = a === 'seven' ? 1000 : a === 'star' ? 500 : a === 'diamond' ? 300 : 120;
    tier = a === 'seven' ? 'jackpot' : 'triple';
  } else if ([a, b, c].filter((id) => id === 'seven').length === 2) {
    base = 50;
    tier = 'pair';
  }

  const nextStreak = base > 0 ? streak + 1 : 0;
  const multiplier = Math.min(1 + Math.floor(nextStreak / 3) * 0.25, 2);

  return {
    payout: Math.round(base * multiplier),
    base,
    multiplier,
    tier,
    nextStreak,
  };
}

export function createGridSpin(random = Math.random) {
  const grid = Array.from({ length: GRID_ROWS * GRID_COLS }, () => pickWeightedSymbol(random));
  const winRoll = random();
  const injectedLines = winRoll < 0.08 ? 2 : winRoll < 0.42 ? 1 : 0;

  for (let index = 0; index < injectedLines; index += 1) {
    const line = PAYLINES[Math.floor(random() * PAYLINES.length)];
    const symbol = pickWeightedSymbol(random);
    line.cells.forEach((cell) => { grid[cell] = symbol; });
  }

  return grid;
}

export function evaluateGridSpin(grid, streak = 0) {
  const wins = PAYLINES.flatMap((line, lineIndex) => {
    const symbols = line.cells.map((cell) => grid[cell]);
    if (!symbols.every((symbol) => symbol.id === symbols[0].id)) return [];
    const lengthBonus = line.cells.length === 5 ? 1.5 : 1;
    const payout = Math.round(LINE_VALUES[symbols[0].id] * lengthBonus);
    return [{ ...line, lineIndex, symbol: symbols[0], payout }];
  });

  const base = wins.reduce((sum, win) => sum + win.payout, 0);
  const nextStreak = base > 0 ? streak + 1 : 0;
  const multiplier = Math.min(1 + Math.floor(nextStreak / 3) * 0.25, 2);

  return {
    wins,
    base,
    payout: Math.round(base * multiplier),
    multiplier,
    nextStreak,
    tier: wins.length >= 3 ? 'jackpot' : wins.length >= 2 ? 'triple' : wins.length === 1 ? 'pair' : 'miss',
  };
}

export function createCoinTimeline(amount) {
  const total = Math.max(0, Math.round(amount));
  return Array.from({ length: total }, (_, index) => {
    const delay = Math.min((index % 17) * 0.047 + Math.floor(index / 17) * 0.012, 1.05);
    const duration = 0.62 + ((index * 29) % 31) / 100;
    return {
      x: total === 1 ? 50 : ((index + 0.5) / total) * 100,
      delay,
      duration,
      drift: ((index * 37) % 80) - 40,
    };
  });
}
