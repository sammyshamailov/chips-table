/**
 * Chips as HTML: the stacks on the felt, in the tray and in the air. The chip rules are in src/domain/chips.ts.
 */
import { chipsOf } from '../domain/chips';

const DARK_CHIPS = [5, 10, 25, 100, 250, 500, 2500, 5000, 10000];

/** The CSS variables that colour one chip of value `d`. */
export function chipStyle(d: number): string {
  const dark = DARK_CHIPS.includes(d);
  return `--c:var(--c${d});--e:${d === 1 || d === 2 || d === 1000 ? 'var(--c5)' : 'var(--chalk)'};--t:${dark ? '#fff' : '#1a1a1a'}`;
}

/**
 * A stack, drawn from an amount (made up from the biggest chips) or from the exact chips a player put down, in
 * columns of `per` chips (more columns, up to four, when there are many).
 */
export function stackHTML(amt: number[] | number | null | undefined, per = 8): string {
  const c = Array.isArray(amt) ? amt : chipsOf(amt);
  if (!c.length) return '';
  const p = c.length > per * 4 ? Math.ceil(c.length / 4) : c.length > per * 3 ? Math.ceil(c.length / 3) : per,
    cols: number[][] = [];
  for (let i = 0; i < c.length; i += p) cols.push(c.slice(i, i + p));
  return `<div class="stk">${cols.map(col => `<div class="col" style="--n:${col.length}">${col.map((d, i) => `<i class="cd" style="${chipStyle(d)};--i:${i}"></i>`).join('')}</div>`).join('')}</div>`;
}
