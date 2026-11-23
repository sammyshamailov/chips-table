/**
 * Hold'em pots: splitting what was committed into the main pot and side pots, paying the winners, and refunding
 * a cancelled hand. Pure: the app turns the amounts into increments on each player's stack.
 */
import type { HoldemStage } from '../types';
import type { HoldemState } from './rules';

/** The result of paying winners: chips per player, the new pot level, and what is still in the pot. */
export interface Award {
  /** Chips each player gets back (a contributor's unmatched excess included). */
  pay: Record<string, number>;
  /** The pot level after this payout: everything committed up to it has been paid. */
  newL: number;
  /** Chips left in pots none of the chosen winners can win (the dealer picks their winner next). */
  left: number;
}

/**
 * Splits the pot among `winners` by contribution level (side pots). Going up level by level from the pot level:
 * a level only one player reached is their own excess and goes back to them; otherwise the level's chips go to
 * the chosen winners who reached it, equally, with the odd chip to the first of them in seat order. The first
 * level no chosen winner reached stops the payout; the rest stays in the pot (`left`).
 */
export function computeAward(h: HoldemState, winners: readonly string[]): Award {
  const c: Record<string, number> = {};
  h.list.forEach(p => {
    const v = h.com(p);
    if (v > h.lvl) c[p.pid] = v;
  });
  const win = h.list.map(p => p.pid).filter(id => winners.includes(id));
  const levels = [...new Set(Object.values(c))].sort((a, b) => a - b);
  let prev = h.lvl,
    newL = h.lvl;
  const pay: Record<string, number> = {};
  for (const L of levels) {
    const contrib = Object.keys(c).filter(id => c[id] > prev);
    const amt = contrib.reduce((a, id) => a + Math.min(c[id], L) - prev, 0);
    if (contrib.length === 1) {
      pay[contrib[0]] = (pay[contrib[0]] || 0) + amt;
      prev = newL = L;
      continue;
    }
    const el = win.filter(id => (c[id] || 0) >= L);
    if (!el.length) break;
    const sh = Math.floor(amt / el.length);
    el.forEach((id, i) => (pay[id] = (pay[id] || 0) + sh + (i === 0 ? amt - sh * el.length : 0)));
    prev = newL = L;
  }
  const left = Object.values(c).reduce((a, v) => a + Math.max(0, v - newL), 0);
  return { pay, newL, left };
}

/**
 * The dealer pays the pot to `winners`. Refused when nothing would be paid. The room moves its pot level up and
 * goes idle once the pot is empty; `pays` lists each player's chips (only amounts above 0), in award order.
 */
export function award(
  h: HoldemState,
  winners: readonly string[],
):
  | {
      ok: true;
      room: { potLevel: number; stage: HoldemStage | string | undefined };
      pays: [string, number][];
      left: number;
    }
  | { ok: false; reason: 'no-winner' } {
  const { pay, newL, left } = computeAward(h, winners);
  const total = Object.values(pay).reduce((a, b) => a + b, 0);
  if (!total) return { ok: false, reason: 'no-winner' };
  const pays = Object.entries(pay).filter(([, a]) => a > 0);
  return { ok: true, room: { potLevel: newL, stage: left === 0 ? 'idle' : h.r.stage }, pays, left };
}

/**
 * The dealer cancels the hand: every player gets back what they put in above the pot level, and the pot level
 * moves to the highest contribution so the pot reads empty. `refunds` holds only players owed something.
 */
export function cancelHandRefunds(h: HoldemState): {
  room: { potLevel: number; stage: 'idle' };
  refunds: { pid: string; amt: number }[];
} {
  const max = Math.max(h.lvl, ...h.list.map(p => h.com(p)));
  const refunds = h.list.map(p => ({ pid: p.pid, amt: Math.max(0, h.com(p) - h.lvl) })).filter(x => x.amt > 0);
  return { room: { potLevel: max, stage: 'idle' }, refunds };
}
