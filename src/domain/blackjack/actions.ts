/**
 * Blackjack player actions (bet, clear, double, split, insurance, surrender) and the dealer paying a blackjack
 * mid-round. Each command returns the fields to write (`patch`) or why it refuses (`reason`). The app adds
 * `ts` and does the write; amounts named `stackInc` are written as increments.
 */
import { chipsOf, MAX_CHIPS, okChips } from '../chips';
import type { BjHand, LastAction, Outcome, PlayerDoc, RoomDoc } from '../types';
import {
  betLimitError,
  blackjackEligible,
  BLACKJACK_PAYS,
  insuranceCost,
  isCurrent,
  MAX_HANDS,
  stake,
  surrenderReturn,
} from './rules';

/** What a player's bet writes. */
export interface BetPatch {
  stack: number;
  bjRound: number | undefined;
  hands: BjHand[];
  insurance: 0;
  surrendered: false;
  lastAction: LastAction;
}

/**
 * A player adds `pending` chips (capped at their stack) to their bet for this round. The spot keeps one hand; its
 * exact chips are the earlier chips plus `chips` (the chips in hand, or `chipsOf` when they don't add up).
 */
export function placeBet(
  m: PlayerDoc | null | undefined,
  r: RoomDoc,
  pending: number,
  chips: readonly number[] = [],
): Outcome<{ add: number; patch: BetPatch }, 'not-betting' | 'nothing-to-add' | 'over-max' | 'under-min'> {
  if (!m || r.phase !== 'betting') return { ok: false, reason: 'not-betting' };
  const add = Math.min(pending, m.stack || 0);
  if (!add) return { ok: false, reason: 'nothing-to-add' };
  const prev = isCurrent(m, r) ? (m.hands as BjHand[])[0] : null;
  const total = (prev ? prev.bet : 0) + add;
  const limit = betLimitError(r, total);
  if (limit) return { ok: false, reason: limit };
  const added = okChips(chips, add) ? chips.slice() : chipsOf(add);
  const all = (prev ? (okChips(prev.chips, prev.bet) ? prev.chips : chipsOf(prev.bet)) : []).concat(added);
  const hand: BjHand = { bet: total };
  if (okChips(all, total)) hand.chips = all;
  // `m.stack as number`: the arithmetic is the app's own, a missing stack included.
  const patch: BetPatch = {
    stack: (m.stack as number) - add,
    bjRound: r.roundId,
    hands: [hand],
    insurance: 0,
    surrendered: false,
    lastAction: { k: 'bet', amt: total },
  };
  return { ok: true, add, patch };
}

/** A player takes their bet back while bets are open. */
export function clearBet(
  m: PlayerDoc | null | undefined,
  r: RoomDoc,
): Outcome<{ patch: { stack: number; bjRound: null; hands: []; lastAction: LastAction } }, 'no-bet' | 'not-betting'> {
  if (!m || !isCurrent(m, r)) return { ok: false, reason: 'no-bet' };
  if (r.phase !== 'betting') return { ok: false, reason: 'not-betting' };
  return {
    ok: true,
    patch: { stack: (m.stack as number) + stake(m), bjRound: null, hands: [], lastAction: { k: 'clear' } },
  };
}

/** The actions a player has once the cards are dealt. */
export type PlayKind = 'double' | 'split' | 'ins' | 'surrender';

/** Why a play is refused. */
export type PlayRefusal =
  | 'not-playing'
  | 'already-doubled'
  | 'hand-done'
  | 'not-enough-chips'
  | 'too-many-hands'
  | 'already-insured'
  | 'only-one-hand'
  | 'unknown';

/** What a play writes: the new stack and hands, plus `insurance` or `surrendered` for those two. */
export interface PlayPatch {
  stack: number;
  hands: BjHand[];
  insurance?: number;
  surrendered?: true;
  lastAction: LastAction;
}

type Play = Outcome<{ patch: PlayPatch }, PlayRefusal>;
type Change = { stack: number; extra?: { insurance?: number; surrendered?: true } } | PlayRefusal;

/**
 * A player doubles, splits, insures or surrenders spot `i` (spot 0 when `i` is not a spot). Works on copies of the
 * hands; refused unless the player bet this round and the cards are dealt.
 */
export function play(m: PlayerDoc | null | undefined, r: RoomDoc, kind: PlayKind | string, i: number): Play {
  if (!m || !isCurrent(m, r) || r.phase !== 'playing') return { ok: false, reason: 'not-playing' };
  const hands = (m.hands as BjHand[]).map(x => ({ ...x }));
  const stack = m.stack as number;
  const c = change(kind, hands, i, stack, m.insurance);
  if (typeof c === 'string') return { ok: false, reason: c };
  return { ok: true, patch: { stack: c.stack, hands, ...c.extra, lastAction: { k: kind } } };
}

/** Applies one play to the copied hands; returns the new stack (and extra fields) or the refusal. */
function change(kind: string, hands: BjHand[], i: number, stack: number, insured: number | undefined): Change {
  switch (kind) {
    case 'double':
      return double(hands, i, stack);
    case 'split':
      return split(hands, i, stack);
    case 'ins':
      return insure(hands, stack, insured);
    case 'surrender':
      return surrender(hands, i, stack);
    default:
      return 'unknown';
  }
}

/** The exact chips of a spot when they are valid, for copying onto a doubled or split spot. */
function sameChips(h: BjHand): number[] | null {
  return okChips(h.chips, h.bet) ? h.chips.slice() : null;
}

/** Double: the bet again from the stack, the spot's chips twice when they still fit. */
function double(hands: BjHand[], i: number, stack: number): Change {
  const h = hands[i] || hands[0];
  if (h.doubled) return 'already-doubled';
  if (h.result) return 'hand-done';
  if (stack < h.bet) return 'not-enough-chips';
  const same = sameChips(h);
  stack -= h.bet;
  h.bet *= 2;
  h.doubled = true;
  if (same && same.length * 2 <= MAX_CHIPS) h.chips = same.concat(same);
  else delete h.chips;
  return { stack };
}

/** Split: a new spot with the same bet right after this one, up to `MAX_HANDS` spots. */
function split(hands: BjHand[], i: number, stack: number): Change {
  const h = hands[i] || hands[0];
  if (hands.length >= MAX_HANDS) return 'too-many-hands';
  if (h.doubled) return 'already-doubled';
  if (h.result) return 'hand-done';
  if (stack < h.bet) return 'not-enough-chips';
  const same = sameChips(h);
  h.split = true;
  const nh: BjHand = { bet: h.bet, split: true };
  if (same) nh.chips = same;
  hands.splice(i + 1, 0, nh);
  return { stack: stack - h.bet };
}

/** Insurance: half the first bet, once, only before splitting and while the hand is open. */
function insure(hands: BjHand[], stack: number, insured: number | undefined): Change {
  const amt = insuranceCost(hands[0].bet);
  if (insured) return 'already-insured';
  if (hands.length > 1) return 'only-one-hand';
  if (hands[0].result) return 'hand-done';
  if (stack < amt || !amt) return 'not-enough-chips';
  return { stack: stack - amt, extra: { insurance: amt } };
}

/** Surrender: half the bet back at once, only with one spot that wasn't doubled. */
function surrender(hands: BjHand[], i: number, stack: number): Change {
  const h = hands[i] || hands[0];
  if (hands.length > 1) return 'only-one-hand';
  if (h.doubled) return 'already-doubled';
  if (h.result) return 'hand-done';
  h.result = 'surrender';
  return { stack: stack + surrenderReturn(h.bet), extra: { surrendered: true } };
}

/**
 * The dealer pays a player's blackjack mid-round: the bet plus 3:2 at once (`stackInc`), the spot marked `paid`
 * so the end-of-round payout and a cancelled round leave it alone, and the house pays the winnings.
 */
export function payBlackjackNow(
  p: PlayerDoc | null | undefined,
  r: RoomDoc,
): Outcome<
  { win: number; stackInc: number; patch: { hands: BjHand[]; lastAction: LastAction }; room: { house: number } },
  'not-playing' | 'not-eligible'
> {
  if (!p || r.phase !== 'playing') return { ok: false, reason: 'not-playing' };
  if (!blackjackEligible(p, r)) return { ok: false, reason: 'not-eligible' };
  const h = (p.hands as BjHand[])[0],
    win = Math.floor(h.bet * BLACKJACK_PAYS);
  const patch = { hands: [{ ...h, result: 'bj' as const, paid: true }], lastAction: { k: 'bjpay', amt: win } };
  return { ok: true, win, stackInc: h.bet + win, patch, room: { house: (r.house || 0) - win } };
}
