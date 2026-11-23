/**
 * Blackjack rules for a chips table: whose bets count this round, bet limits, what each action is allowed, and
 * what each result pays. Pure functions of the stored documents.
 */
import type { BjHand, HandResult, PlayerDoc, RoomDoc } from '../types';

/** The most spots one player can have after splitting. */
export const MAX_HANDS = 4;

/** A blackjack pays 3:2 on top of the returned bet. */
export const BLACKJACK_PAYS = 1.5;

/** Insurance pays 2:1, so a winning insurance returns three times its stake. */
export const INSURANCE_RETURN = 3;

/** Insurance costs half the bet; surrender returns half the bet. */
export const HALF = 2;

/** True when the player has bet in the room's current round (the app's `cur`). */
export function isCurrent(p: PlayerDoc | null | undefined, r: RoomDoc | null | undefined): boolean {
  return !!(p && r && p.bjRound === r.roundId && (p.hands || []).length);
}

/** The chips on all of a player's spots (insurance not included). */
export function stake(p: PlayerDoc): number {
  return (p.hands || []).reduce((a, x) => a + x.bet, 0);
}

/** Why a bet total is outside the table's limits, or null when it is fine (`maxBet` 0 or missing = no maximum). */
export function betLimitError(r: RoomDoc, total: number): 'over-max' | 'under-min' | null {
  if (r.maxBet && total > r.maxBet) return 'over-max';
  if (total < (r.minBet || 0)) return 'under-min';
  return null;
}

/** Insurance for this bet: half of it, rounded down. */
export function insuranceCost(bet: number): number {
  return Math.floor(bet / HALF);
}

/** What surrendering this bet returns: half, rounded down. */
export function surrenderReturn(bet: number): number {
  return Math.floor(bet / HALF);
}

/** What a hand gives back for its result, the bet included (win 1:1, blackjack 3:2, push the bet, lose nothing). */
export function handReturn(result: HandResult, bet: number): number {
  switch (result) {
    case 'win':
      return bet * 2;
    case 'bj':
      return bet + Math.floor(bet * BLACKJACK_PAYS);
    case 'push':
      return bet;
    case 'surrender':
      return surrenderReturn(bet);
    case 'lose':
      return 0;
  }
}

/** What a cancelled round gives back for one spot: nothing for a paid blackjack, the kept half of a surrender. */
export function handRefund(h: BjHand): number {
  if (h.paid) return 0;
  return h.result === 'surrender' ? Math.ceil(h.bet / HALF) : h.bet;
}

/** True when the dealer may pay this player a blackjack mid-round: one untouched spot. */
export function blackjackEligible(p: PlayerDoc | null | undefined, r: RoomDoc | null | undefined): boolean {
  if (!p || !isCurrent(p, r)) return false;
  const hs = p.hands as BjHand[];
  return hs.length === 1 && !hs[0].doubled && !hs[0].split && !hs[0].result;
}

/**
 * True when a player still has something for the end of the round: a spot not already paid, or insurance.
 * Paid blackjacks (`paid`) are done and skipped by the payout and by a cancelled round.
 */
export function hasOpenBets(p: PlayerDoc): boolean {
  return (p.hands || []).some(h => !h.paid) || !!p.insurance;
}

/**
 * True when this player was already paid or refunded for the current round (`bjPaidRound`): a retry after a
 * failed room write must not pay them twice.
 */
export function alreadySettled(p: PlayerDoc, r: RoomDoc): boolean {
  return p.bjPaidRound === r.roundId;
}

/** The next round number (a room without one counts as round 1). */
export function nextRoundId(r: RoomDoc): number {
  return (r.roundId || 1) + 1;
}
