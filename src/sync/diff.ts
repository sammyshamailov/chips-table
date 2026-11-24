/**
 * Old and new documents → what happened (`DomainEvent[]`). Pure: no DOM, no timers, no `S`; the same documents give
 * the same events on every phone.
 *
 * Every player write sets `lastAction` and `ts`, so a player whose `ts` changed did `lastAction.k`; the room's events
 * come from its fields (`closed`, `phase`, `roundId`, `handId`, `stage`). Nothing is sent for a phone's first copy of
 * a document (a phone that joins mid-hand doesn't replay it) or for a table this build doesn't play (the guard).
 */
import { handHalves, handStack, okChips, sumOf } from '../domain/chips';
import { BLACKJACK_PAYS, isCurrent } from '../domain/blackjack/rules';
import { tableUnsupported } from '../domain/guard';
import type { BjHand, PlayerDoc, RoomDoc } from '../domain/types';
import type { BlackjackEvent, DomainEvent, HoldemEvent, RoomEvent, SettledHand } from './domain-events';

/** Who is using this phone (`S.myId`). */
export interface DiffContext {
  myId: string | null;
}

/** For the room: also the players as they are now (the lock bumps every spot in the round). */
export interface RoomDiffContext extends DiffContext {
  players: Readonly<Record<string, PlayerDoc>>;
}

type Players = Readonly<Record<string, PlayerDoc>>;

const POT_BETS = { blind: 'BlindPosted', call: 'Called', bet: 'BetMade', raise: 'Raised' } as const;
const STREETS = ['flop', 'turn', 'river'] as const;
/**
 * "Paid" in Hebrew, in the event line an older phone wrote when it paid a Blackjack round, before `roundEnd` existed.
 * Spelled with escapes: Hebrew letters live only in src/i18n/he.ts, and this matches stored text, not words on screen.
 */
const PAID = /\u05e9\u05d5\u05dc\u05dd/;

const total = (hs: readonly BjHand[]) => hs.reduce((x, h) => x + (h.bet || 0), 0);

/** The players' events: one per player whose `ts` changed, read with the rules of the room's game. */
export function diffPlayers(
  oldPlayers: Players,
  newPlayers: Players,
  room: RoomDoc | null | undefined,
  ctx: DiffContext,
): DomainEvent[] {
  if (!room || tableUnsupported(room)) return [];
  const out: DomainEvent[] = [];
  for (const pid in newPlayers) {
    const a = oldPlayers[pid],
      b = newPlayers[pid];
    if (!a || !b || !b.lastAction || (b.ts || 0) === (a.ts || 0)) continue;
    const ev = room.game === 'holdem' ? holdemEvent(pid, a, b, room, ctx) : blackjackEvent(pid, a, b, ctx);
    if (ev) out.push(ev);
  }
  return out;
}

function holdemEvent(pid: string, a: PlayerDoc, b: PlayerDoc, room: RoomDoc, ctx: DiffContext): HoldemEvent | null {
  const la = b.lastAction!,
    k = la.k,
    base = { pid, mine: pid === ctx.myId };
  if (k === 'allin' || Object.hasOwn(POT_BETS, k)) {
    const d = (a.stack || 0) - (b.stack || 0),
      chips = okChips(la.chips, d) ? la.chips : d;
    if (k === 'allin') return { type: 'WentAllIn', ...base, amount: d, chips, handId: room.handId || 0 };
    if (d <= 0) return null;
    return { type: POT_BETS[k as keyof typeof POT_BETS], ...base, amount: d, chips };
  }
  if (k === 'won' || k === 'refund') {
    const d = (b.stack || 0) - (a.stack || 0);
    if (d <= 0) return null;
    return { type: k === 'won' ? 'PotWon' : 'HandRefunded', ...base, amount: d, stackBefore: a.stack };
  }
  if (k === 'check') return { type: 'Checked', ...base };
  if (k === 'fold') return { type: 'Folded', ...base };
  return null;
}

function blackjackEvent(pid: string, a: PlayerDoc, b: PlayerDoc, ctx: DiffContext): BlackjackEvent | null {
  const la = b.lastAction!,
    base = { pid, mine: pid === ctx.myId },
    A = a.hands || [],
    B = b.hands || [];
  switch (la.k) {
    case 'bet': {
      const prev = a.bjRound === b.bjRound ? A : [],
        d = total(B) - total(prev);
      if (d <= 0) return null;
      // just the chips added this time: the new stack must start with the old one
      const pc = prev[0] ? handStack(prev[0]) : [],
        nc = B[0] ? handStack(B[0]) : d;
      const added =
        Array.isArray(nc) && Array.isArray(pc) && pc.every((x, n) => nc[n] === x) && sumOf(nc.slice(pc.length)) === d
          ? nc.slice(pc.length)
          : d;
      return { type: 'BetPlaced', ...base, amount: d, prevHands: prev, added };
    }
    case 'clear': {
      const amt = total(A);
      if (!amt) return null;
      return {
        type: 'BetCleared',
        ...base,
        amount: amt,
        chips: A.length === 1 ? handStack(A[0]) : amt,
        stackBefore: a.stack,
      };
    }
    case 'double': {
      const i = B.findIndex((h, j) => h.doubled && !(A[j] && A[j].doubled));
      if (i < 0) return null;
      return { type: 'HandDoubled', ...base, index: i, hands: B, halves: handHalves(B[i]) };
    }
    case 'split':
      return splitEvent(base, A, B);
    case 'ins': {
      const amt = b.insurance || 0;
      return amt ? { type: 'InsuranceTaken', ...base, amount: amt } : null;
    }
    case 'surrender': {
      const h = B[0];
      if (!h) return null;
      const back = Math.floor(h.bet / 2);
      return back ? { type: 'Surrendered', ...base, returned: back, stackBefore: a.stack } : null;
    }
    case 'bjpay': // always sent: the narration says "blackjack" even when there is no spot to animate
      return {
        type: 'BlackjackPaid',
        ...base,
        hand: A[0] || null,
        chips: A[0] ? handStack(A[0]) : 0,
        win: la.amt || 0,
        stackBefore: a.stack,
      };
    case 'bjres':
      return B.length ? settledEvent(base, a, b, A, B) : null;
    case 'refund': {
      if (A.length && !B.length)
        return {
          type: 'RoundRefunded',
          ...base,
          handsBefore: A,
          bets: A.flatMap((h, j) => (h.paid ? [] : [{ index: j, chips: handStack(h) }])),
          insurance: a.insurance || 0,
          stackBefore: a.stack,
        };
      const amt = la.amt || 0;
      return amt ? { type: 'Refunded', ...base, amount: amt, stackBefore: a.stack } : null;
    }
    default:
      return null;
  }
}

function splitEvent(base: { pid: string; mine: boolean }, A: BjHand[], B: BjHand[]): BlackjackEvent | null {
  if (B.length <= A.length) return null;
  const same = (x: BjHand | undefined, y: BjHand | undefined) =>
    !!x && !!y && x.bet === y.bet && !!x.split === !!y.split && !!x.doubled === !!y.doubled && x.result === y.result;
  let j = 0;
  while (j < A.length && same(A[j], B[j])) j++;
  const i = A[j] && !A[j].split && B[j] && B[j].split && A[j].bet === B[j].bet ? j : Math.max(0, j - 1);
  const second = B[i + 1];
  return { type: 'HandSplit', ...base, index: i, hands: B, chips: [handStack(B[i]), second ? handStack(second) : 0] };
}

function settledEvent(
  base: { pid: string; mine: boolean },
  a: PlayerDoc,
  b: PlayerDoc,
  A: BjHand[],
  B: BjHand[],
): BlackjackEvent {
  let handsNet = 0,
    anyBlackjack = false;
  const settled: SettledHand[] = [];
  B.forEach((h, j) => {
    if (h.paid) return; // already paid when the dealer declared the blackjack
    const res = h.result || null;
    let pay = 0;
    if (res === 'lose' || res === 'surrender') handsNet -= res === 'lose' ? h.bet : h.bet - Math.floor(h.bet / 2);
    else if (res === 'win' || res === 'bj') {
      pay = res === 'bj' ? Math.floor(h.bet * BLACKJACK_PAYS) : h.bet;
      handsNet += pay;
      anyBlackjack = anyBlackjack || res === 'bj';
    }
    settled.push({ index: j, result: res, chips: handStack(A[j] || h), pay });
  });
  const insurance = a.insurance || 0,
    net = b.lastAction!.amt || 0;
  return {
    type: 'HandsSettled',
    ...base,
    handsBefore: A,
    settled,
    handsNet,
    anyBlackjack,
    insurance,
    insuranceWon: net - handsNet > 0,
    net,
    chipsReturn:
      B.some(h => h.result === 'win' || h.result === 'bj' || h.result === 'push') || (!!insurance && net > handsNet),
    stackBefore: a.stack,
  };
}

/** The room's events, in the order their effects always ran: the ceremony first. */
export function diffRoom(
  a: RoomDoc | null | undefined,
  b: RoomDoc | null | undefined,
  ctx: RoomDiffContext,
): RoomEvent[] {
  if (!a || !b || tableUnsupported(b) || a.code !== b.code) return [];
  const out: RoomEvent[] = [];
  if (!a.closed && b.closed && b.final) out.push({ type: 'GameEnded' });
  if (b.game === 'blackjack' && a.phase === 'betting' && b.phase === 'playing' && a.roundId === b.roundId)
    out.push({ type: 'BetsLocked', roundId: b.roundId || 0, spots: lockedSpots(b, ctx.players) });
  // a round that was paid (not cancelled); roundEnd is missing when an older phone did the payout
  if (
    a.game === 'blackjack' &&
    b.game === 'blackjack' &&
    a.phase === 'playing' &&
    b.phase === 'betting' &&
    (b.roundId || 0) > (a.roundId || 0) &&
    (b.roundEnd ? b.roundEnd === 'paid' : PAID.test((b.lastEvent && b.lastEvent.t) || ''))
  )
    out.push({ type: 'RoundPaid', roundId: a.roundId || 0 });
  if (b.game === 'holdem' && (b.handId || 0) > (a.handId || 0))
    out.push({ type: 'HandStarted', handId: b.handId || 0 });
  else if (b.game === 'holdem' && a.stage !== b.stage && STREETS.includes(b.stage as (typeof STREETS)[number]))
    out.push({ type: 'StreetDealt', stage: b.stage as (typeof STREETS)[number] });
  return out;
}

/** Every player in the round, in seat (joining) order, with how many spots they have. */
function lockedSpots(room: RoomDoc, players: Players): { pid: string; count: number }[] {
  return Object.entries(players)
    .map(([pid, p]) => ({ pid, p }))
    .sort((x, y) => (x.p.joinedAt || 0) - (y.p.joinedAt || 0))
    .filter(x => isCurrent(x.p, room))
    .map(x => ({ pid: x.pid, count: (x.p.hands || []).length }));
}
