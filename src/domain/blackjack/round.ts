/**
 * The end of a Blackjack round, run by the dealer: paying every hand by its result, or cancelling the round and
 * refunding the bets. Players are written first and the room last (the app does the writes, in that order), and
 * each settled player is marked with `bjPaidRound` so a retry after a failed room write pays nobody twice.
 */
import type { BjHand, HandResult, LastAction, Outcome, RoomDoc, Seat } from '../types';
import { alreadySettled, handRefund, handReturn, hasOpenBets, INSURANCE_RETURN, isCurrent, nextRoundId } from './rules';

/** One player's settlement: `stackInc` is added to their stack as an increment. */
export interface Settlement {
  pid: string;
  stackInc: number;
  patch: { bjPaidRound: number | undefined; hands: BjHand[]; lastAction: LastAction };
}

/** What a payout writes to the room (plus the event line, added by the app). */
export interface PayoutRoom {
  phase: 'betting';
  roundId: number;
  dealerBJ: false;
  roundEnd: 'paid';
  house: number;
}

/** The players the end of the round deals with: bet this round and still have an open spot or insurance. */
export function roundPlayers(r: RoomDoc, list: Seat[]): Seat[] {
  return list.filter(p => isCurrent(p, r)).filter(hasOpenBets);
}

/** Money for one player at the payout: what they staked this round and what comes back to them. */
export function playerPayout(hands: BjHand[], insurance: number, dealerBJ: boolean) {
  let pay = 0,
    stake = 0,
    back = 0;
  hands.forEach(x => {
    if (x.paid) return;
    stake += x.bet;
    if (x.result === 'surrender') back += handReturn('surrender', x.bet);
    else pay += handReturn(x.result as HandResult, x.bet);
  });
  const insPay = insurance && dealerBJ ? insurance * INSURANCE_RETURN : 0;
  return { pay, back, insPay, stake, net: pay + back + insPay - stake - insurance };
}

/**
 * The dealer pays the round. Each open hand takes its result as stored, or the dealer's mark from `marks`
 * (`'<pid>:<spot>'` → result); refused while any hand has neither. Surrendered halves were already returned when
 * the player surrendered, so only win/bj/push and a winning insurance (`dealerBJ`) are added to the stack now.
 * The house takes every stake and insurance and pays every return; players settled by an earlier try still
 * count for the house but get no second write.
 */
export function settleRound(
  r: RoomDoc,
  list: Seat[],
  marks: Readonly<Record<string, HandResult | undefined>>,
  dealerBJ: boolean,
): Outcome<{ writes: Settlement[]; room: PayoutRoom; houseDelta: number }, 'unmarked'> {
  let houseIn = 0,
    houseOut = 0;
  const writes: Settlement[] = [];
  for (const p of roundPlayers(r, list)) {
    const hands = (p.hands as BjHand[]).map((x, i) => ({ ...x, result: x.result || marks[p.pid + ':' + i] }));
    if (hands.some(x => !x.result)) return { ok: false, reason: 'unmarked' };
    const ins = p.insurance || 0;
    const { pay, back, insPay, stake, net } = playerPayout(hands, ins, dealerBJ);
    houseIn += stake + ins;
    houseOut += pay + back + insPay;
    if (alreadySettled(p, r)) continue;
    writes.push({
      pid: p.pid,
      stackInc: pay + insPay,
      patch: { bjPaidRound: r.roundId, hands, lastAction: { k: 'bjres', amt: net } },
    });
  }
  const houseDelta = houseIn - houseOut;
  const room: PayoutRoom = {
    phase: 'betting',
    roundId: nextRoundId(r),
    dealerBJ: false,
    roundEnd: 'paid',
    house: (r.house || 0) + houseIn - houseOut,
  };
  return { ok: true, writes, room, houseDelta };
}

/**
 * The dealer cancels the round: each player still owed gets back every open bet (the kept half of a surrender,
 * nothing for a paid blackjack) and their insurance, and their spots are cleared. Players already refunded by an
 * earlier try are skipped.
 */
export function cancelRound(
  r: RoomDoc,
  list: Seat[],
): {
  refunds: {
    pid: string;
    stackInc: number;
    patch: { bjPaidRound: number | undefined; hands: []; bjRound: null; lastAction: LastAction };
  }[];
  room: { phase: 'betting'; roundId: number; roundEnd: 'cancelled' };
} {
  const refunds = roundPlayers(r, list)
    .filter(p => !alreadySettled(p, r))
    .map(p => {
      const back = (p.hands as BjHand[]).reduce((a, x) => a + handRefund(x), 0) + (p.insurance || 0);
      const patch = { bjPaidRound: r.roundId, hands: [] as [], bjRound: null, lastAction: { k: 'refund', amt: back } };
      return { pid: p.pid, stackInc: back, patch };
    });
  return { refunds, room: { phase: 'betting', roundId: nextRoundId(r), roundEnd: 'cancelled' } };
}
