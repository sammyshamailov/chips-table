/**
 * Chips: denominations, making up an amount, and the exact stacks saved with a bet.
 */
import type { BjHand, Game } from './types';

/** Every chip value the app has, smallest first. */
export const DEN: readonly number[] = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** How many chip values a table offers in the tray. */
export const N_CHIPS = 6;

/** The most chips `chipsOf` draws for one amount (a bigger amount is drawn short; it is only a picture). */
export const MAX_DRAWN_CHIPS = 36;

/** The most chips a saved stack (`hands[i].chips`, `lastAction.chips`) may hold before it is ignored. */
export const MAX_CHIPS = 40;

const THOUSAND = 1000;

/**
 * The six chip values a table uses: the largest chip not above the table's unit (small blind in Hold'em, minimum
 * bet in Blackjack), plus one smaller chip for change, shifted down when the set would run off the top.
 */
export function denoms(game: Game | string | undefined, sb: number | undefined, minBet: number | undefined): number[] {
  const unit = Math.max(1, game === 'holdem' ? sb || 1 : minBet || 1);
  let i = 0;
  DEN.forEach((d, k) => {
    if (d <= unit) i = k;
  });
  i = Math.max(0, i - 1);
  i = Math.min(i, DEN.length - N_CHIPS);
  return DEN.slice(i, i + N_CHIPS);
}

/** The text printed on a chip: `1000` → `1K`. */
export function chipLabel(d: number): string {
  return String(d >= THOUSAND ? d / THOUSAND + 'K' : d);
}

/** An amount made up from the biggest chips first (at most `MAX_DRAWN_CHIPS` of them). */
export function chipsOf(amt: number | undefined | null): number[] {
  const out: number[] = [];
  let left = Math.floor(amt || 0);
  for (let k = DEN.length - 1; k >= 0 && left > 0; k--)
    while (left >= DEN[k] && out.length < MAX_DRAWN_CHIPS) {
      out.push(DEN[k]);
      left -= DEN[k];
    }
  return out;
}

/** The sum of a list of chips. */
export function sumOf(a: readonly number[]): number {
  return a.reduce((x, y) => x + y, 0);
}

/**
 * True when a saved stack can be trusted for `amt`: a non-empty list of known chip values, not too long, adding
 * up exactly. Older versions wrote only the amount, so anything else falls back to the amount.
 */
export function okChips(c: unknown, amt: number): c is number[] {
  return Array.isArray(c) && c.length > 0 && c.length <= MAX_CHIPS && c.every(d => DEN.includes(d)) && sumOf(c) === amt;
}

/** What a Blackjack spot shows: a surrendered hand keeps the half that wasn't returned. */
export function dispAmt(h: BjHand): number {
  return h.result === 'surrender' ? h.bet - Math.floor(h.bet / 2) : h.bet;
}

/** The stack to draw on a Blackjack spot: the exact chips when they are valid, otherwise the amount. */
export function handStack(h: BjHand): number[] | number {
  if (h.result === 'surrender') return dispAmt(h);
  return okChips(h.chips, h.bet) ? h.chips : h.bet;
}

/** The two halves of a doubled hand: the original chips twice when they split evenly, otherwise two amounts. */
export function handHalves(h: BjHand): [number[], number[]] | [number, number] {
  const c = h.chips,
    k = c ? c.length / 2 : 0;
  if (okChips(c, h.bet) && k === Math.floor(k) && sumOf(c.slice(0, k)) === h.bet / 2)
    return [c.slice(0, k), c.slice(k)];
  return [h.bet / 2, h.bet / 2];
}
