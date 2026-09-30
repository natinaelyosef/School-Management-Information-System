/**
 * Picks the first matching key from a /stats (or summary) payload and formats it
 * for a StatCard. Falls back to the demo constant when the payload is missing
 * or none of the candidate keys are present.
 */
export function pickStat(
  stats: { [key: string]: unknown } | undefined,
  keys: string[],
  fallback: string,
): string {
  if (!stats) return fallback;
  for (const key of keys) {
    const value = stats[key];
    if (typeof value === 'number') return value.toLocaleString('en-US');
    if (typeof value === 'string' && value !== '') return value;
  }
  return fallback;
}

/** Same as pickStat, but appends a percent sign when the payload is numeric. */
export function pickPercent(
  stats: { [key: string]: unknown } | undefined,
  keys: string[],
  fallback: string,
): string {
  const value = pickStat(stats, keys, '');
  if (value === '') return fallback;
  return value.includes('%') ? value : `${value}%`;
}
