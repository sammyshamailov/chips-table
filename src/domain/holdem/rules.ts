/**
 * Texas Hold'em rules for a chips table: who is in the hand, what is bet, the minimum raise, how an action is
 * classified, blinds and the button, and the streets. Pure: commands return the fields to write, the app writes them.
 */
import { okChips } from '../chips';
import type { HoldemStage, LastAction, Outcome, PlayerDoc, RoomDoc, Seat } from '../types';

/** The streets of a hand, in order. */
export const STAGES: readonly HoldemStage[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];

/** Streets on which players act (everything before the showdown). */
export const BETTING_STAGES: readonly HoldemStage[] = STAGES.slice(0, 4);

/** `streetId` = `handId * STREET_ID_FACTOR + street number`, so every street of every hand has its own id. */
export const STREET_ID_FACTOR = 10;

/** A hand needs at least this many players with chips who aren't sitting out. */
export const MIN_PLAYERS = 2;

/** The table as Hold'em sees it, worked out from the room and its players (the app's `H()`). */
export interface HoldemState {
  r: RoomDoc;
  /** Every player, in seat order. */
  list: Seat[];
  /** The pot level: chips committed up to this level have already been paid out. */
  lvl: number;
  inHand: (p: PlayerDoc) => boolean;
  /** What a player has bet on the current street. */
  st: (p: PlayerDoc) => number;
  /** What a player has put in during this hand. */
  com: (p: PlayerDoc) => number;
  /** Chips in the pot (everything committed above the pot level). */
  pot: number;
  /** The highest bet on this street. */
  maxSt: number;
  /** The smallest total a raise must reach. */
  minTo: number;
  /** Players in the hand who haven't folded. */
  live: Seat[];
}

/** Works out the hand from the room and its players (in seat order). */
export function holdemState(r: RoomDoc, list: Seat[]): HoldemState {
  const lvl = r.potLevel || 0;
  const inHand = (p: PlayerDoc) => r.stage !== 'idle' && p.handId === r.handId;
  const st = (p: PlayerDoc) => (inHand(p) && p.streetId === r.streetId ? p.streetBet || 0 : 0);
  const com = (p: PlayerDoc) => (inHand(p) ? p.committed || 0 : 0);
  const pot = list.reduce((a, p) => a + Math.max(0, com(p) - lvl), 0);
  const maxSt = Math.max(0, ...list.map(st));
  const minTo = maxSt === 0 ? r.bb || 1 : maxSt + lastRaise(r, list.map(st));
  const live = list.filter(p => inHand(p) && !p.folded);
  return { r, list, lvl, inHand, st, com, pot, maxSt, minTo, live };
}

/** The size of the last raise on this street, never less than the big blind. */
function lastRaise(r: RoomDoc, bets: number[]): number {
  const distinct = [...new Set(bets)].sort((a, b) => b - a);
  return Math.max(r.bb || 1, distinct.length > 1 ? distinct[0] - distinct[1] : distinct[0] || 0);
}

/** True when the player may act now: in the hand, not folded, not all-in, before the showdown. */
export function canAct(h: HoldemState, p: PlayerDoc | null | undefined): boolean {
  return !!p && h.inHand(p) && !p.folded && !p.allIn && BETTING_STAGES.includes(h.r.stage as HoldemStage);
}

/** The kinds of chip action a player can make. */
export type BetKind = 'check' | 'call' | 'bet' | 'raise' | 'allin';

/** The fields a player's own bet writes (plus `ts`, added by the app). */
export interface BetPatch {
  stack: number;
  streetBet: number;
  streetId: number | undefined;
  committed: number;
  allIn: boolean;
  lastAction: LastAction;
}

/** Classifies putting `add` chips in: all-in when nothing is left, check, call, bet or raise. */
export function classifyBet(add: number, newSt: number, maxSt: number, stackAfter: number): BetKind {
  if (stackAfter === 0 && add > 0) return 'allin';
  if (add === 0) return 'check';
  if (newSt === maxSt) return 'call';
  return maxSt === 0 ? 'bet' : 'raise';
}

/**
 * A player puts `add` more chips in on this street (0 = check). `add` is capped at the player's stack. Refused
 * when the player can't act, or when checking would leave them short of the bet to call. `chips` are the exact
 * chips in the player's hand; they are saved with the action when they add up to `add`. A raise or all-in
 * records the new street total as its amount, other actions the chips added.
 */
export function bet(
  h: HoldemState,
  m: PlayerDoc | null | undefined,
  amount: number,
  chips: readonly number[] = [],
  kind?: BetKind,
): Outcome<{ add: number; patch: BetPatch }, 'cannot-act' | 'short-of-call'> {
  if (!m || !canAct(h, m)) return { ok: false, reason: 'cannot-act' };
  const add = Math.max(0, Math.min(amount, m.stack || 0));
  const newSt = h.st(m) + add,
    stack = (m.stack || 0) - add;
  if (add === 0 && newSt < h.maxSt) return { ok: false, reason: 'short-of-call' };
  const k = kind || classifyBet(add, newSt, h.maxSt, stack);
  const lastAction: LastAction = { k, amt: k === 'raise' || k === 'allin' ? newSt : add };
  if (add > 0 && okChips(chips, add)) lastAction.chips = chips.slice();
  const patch = {
    stack,
    streetBet: newSt,
    streetId: h.r.streetId,
    committed: h.com(m) + add,
    allIn: stack === 0,
    lastAction,
  };
  return { ok: true, add, patch };
}

/** A player folds. */
export function fold(
  h: HoldemState,
  m: PlayerDoc | null | undefined,
): Outcome<{ patch: { folded: true; lastAction: LastAction } }, 'cannot-act'> {
  if (!canAct(h, m)) return { ok: false, reason: 'cannot-act' };
  return { ok: true, patch: { folded: true, lastAction: { k: 'fold' } } };
}

/** What `newHand` writes to the room (plus the event line, added by the app). */
export interface NewHandRoom {
  handId: number;
  streetId: number;
  stage: 'preflop';
  potLevel: 0;
  buttonPid: string;
  sbPid: string;
  bbPid: string;
}

/** What `newHand` writes to one player (an absolute stack, as the app always has). */
export interface BlindPost {
  pid: string;
  patch: {
    handId: number;
    streetId: number;
    streetBet: number;
    committed: number;
    stack: number;
    folded: false;
    allIn: boolean;
    lastAction: LastAction | null;
  };
}

/** The players who take part in the next hand: not sitting out, with chips. */
export function activePlayers(list: Seat[]): Seat[] {
  return list.filter(p => !p.sittingOut && (p.stack || 0) > 0);
}

/**
 * Button and blinds for the next hand among the active players (seat order). The button moves one seat on from
 * the previous button (or to the first seat when the previous button is gone). Heads-up the button posts the
 * small blind; otherwise the two seats after the button post.
 */
export function blindSeats(act: Seat[], prevButton: string | null | undefined): { btn: Seat; sbP: Seat; bbP: Seat } {
  const bi = act.findIndex(p => p.pid === prevButton);
  const n = act.length,
    b = (bi + 1) % n,
    btn = act[b];
  const sbP = n === 2 ? act[b] : act[(b + 1) % n];
  const bbP = n === 2 ? act[(b + 1) % n] : act[(b + 2) % n];
  return { btn, sbP, bbP };
}

/**
 * The dealer starts a hand: picks button and blinds, posts them (capped at each stack) and resets every active
 * player for the new hand. Refused while chips are still in the pot of a running hand, or with fewer than two
 * players who can play.
 */
export function newHand(
  r: RoomDoc,
  list: Seat[],
): Outcome<{ room: NewHandRoom; posts: BlindPost[] }, 'pot-not-empty' | 'too-few-players'> {
  if (holdemState(r, list).pot > 0 && r.stage !== 'idle') return { ok: false, reason: 'pot-not-empty' };
  const act = activePlayers(list);
  if (act.length < MIN_PLAYERS) return { ok: false, reason: 'too-few-players' };
  const { btn, sbP, bbP } = blindSeats(act, r.buttonPid);
  const handId = (r.handId || 0) + 1,
    streetId = handId * STREET_ID_FACTOR + 1;
  const room: NewHandRoom = {
    handId,
    streetId,
    stage: 'preflop',
    potLevel: 0,
    buttonPid: btn.pid,
    sbPid: sbP.pid,
    bbPid: bbP.pid,
  };
  const posts = act.map(p => {
    // Number(): a room without blinds posts NaN, exactly as the arithmetic did before.
    const due = p.pid === sbP.pid ? Number(r.sb) : p.pid === bbP.pid ? Number(r.bb) : 0;
    const x = Math.min(due, p.stack || 0),
      stack = (p.stack || 0) - x;
    const patch = {
      handId,
      streetId,
      streetBet: x,
      committed: x,
      stack,
      folded: false as const,
      allIn: stack === 0,
      lastAction: x ? { k: 'blind', amt: x } : null,
    };
    return { pid: p.pid, patch };
  });
  return { ok: true, room, posts };
}

/** The dealer opens the next street. Refused when the hand isn't running or is already at the showdown. */
export function nextStreet(r: RoomDoc): Outcome<{ patch: { stage: HoldemStage; streetId: number } }, 'no-next-street'> {
  const i = STAGES.indexOf(r.stage as HoldemStage);
  if (i < 0 || i >= BETTING_STAGES.length) return { ok: false, reason: 'no-next-street' };
  return { ok: true, patch: { stage: STAGES[i + 1], streetId: (r.streetId || 0) + 1 } };
}
