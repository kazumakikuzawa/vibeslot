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
