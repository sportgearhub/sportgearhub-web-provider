import type { RentalTier } from '../../types';

/**
 * What a rental costs, by the rule the API actually uses.
 *
 * A tier is **a sellable block of time, not a bracket** — the field name `up_to_hours` is wrong
 * about it. A rental is charged the cheapest combination of blocks that covers its duration, so
 * with 1 ч = 100 and 8 ч = 600, nine hours is 700 (a block of eight and an hour), and twenty-four
 * is 1800 (three blocks of eight), whatever the day rate says.
 *
 * This is why the seller needs to see it: setting a day rate above what the shorter blocks already
 * charge for a day does nothing at all, and nothing in the API refuses it.
 */
export function quoteHours(tiers: RentalTier[], hours: number): number | null {
  const blocks = usable(tiers);
  if (blocks.length === 0 || hours <= 0) return null;

  // Unbounded coin-change over the blocks, where a block may overshoot the remaining time: the
  // cheapest cover of `hours`, not the cheapest exact fill.
  const best = new Array<number>(hours + 1).fill(Infinity);
  best[0] = 0;
  for (let hour = 1; hour <= hours; hour += 1) {
    for (const block of blocks) {
      const remainder = Math.max(0, hour - block.upToHours);
      const candidate = best[remainder] + block.price;
      if (candidate < best[hour]) best[hour] = candidate;
    }
  }
  return Number.isFinite(best[hours]) ? best[hours] : null;
}

/**
 * The blocks that never win.
 *
 * A block is dead when covering its own length out of the other blocks costs the same or less: at
 * 1 ч = 100 and сутки = 3000, a day is 2400 in hourly blocks and the day rate is never charged.
 * The seller believes they have set a day rate and have not.
 */
export function deadTiers(tiers: RentalTier[]): RentalTier[] {
  const blocks = usable(tiers);
  return blocks.filter(block => {
    const others = blocks.filter(item => item !== block);
    const alternative = quoteHours(others, block.upToHours);
    return alternative != null && alternative <= block.price;
  });
}

/** What the customer would pay without the length discount — the shortest block, repeated. */
export function referenceAmount(tiers: RentalTier[], hours: number): number | null {
  const blocks = usable(tiers);
  if (blocks.length === 0) return null;
  const shortest = blocks.reduce((a, b) => (a.upToHours <= b.upToHours ? a : b));
  return quoteHours([shortest], hours);
}

function usable(tiers: RentalTier[]) {
  return tiers
    .filter(tier => tier.upToHours > 0 && tier.price > 0)
    .sort((a, b) => a.upToHours - b.upToHours);
}

/** The durations worth showing a seller: an hour, a few, a shift, a day, a weekend. */
export const SAMPLE_DURATIONS = [
  { hours: 1, label: '1 час' },
  { hours: 4, label: '4 часа' },
  { hours: 8, label: '8 часов' },
  { hours: 24, label: 'Сутки' },
  { hours: 48, label: 'Двое суток' },
];
