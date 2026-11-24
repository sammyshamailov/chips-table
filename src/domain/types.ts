/**
 * The stored documents, as they are in Firestore (and in single-device mode's LocalDB).
 *
 * Every field is optional: phones on older versions share tables with newer ones, and a field added later is
 * missing from documents an older phone wrote (see docs/ARCHITECTURE.md, "Stored data"). The domain reads them
 * with the same fallbacks the app always used.
 */

/** The two games a chips table can run. */
export type Game = 'holdem' | 'blackjack';

/** Hold'em street, or `idle` between hands. */
export type HoldemStage = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

/** How one Blackjack betting spot ended. */
export type HandResult = 'win' | 'bj' | 'push' | 'lose' | 'surrender';

/** One Blackjack betting spot (`players/{pid}.hands[i]`). */
export interface BjHand {
  bet: number;
  doubled?: boolean;
  split?: boolean;
  result?: HandResult | null;
  /** The exact chips placed, bottom to top. Used only when they add up to `bet`. */
  chips?: number[];
  /** A blackjack the dealer paid mid-round: the payout and a cancelled round leave it alone. */
  paid?: boolean;
}

/** The last thing that happened to a player; drives the animations on every phone. */
export interface LastAction {
  k: string;
  amt?: number;
  chips?: number[];
}

/** `rooms/{CODE}`. */
export interface RoomDoc {
  code?: string;
  game?: Game;
  startStack?: number;
  sb?: number;
  bb?: number;
  minBet?: number;
  maxBet?: number;
  hostId?: string;
  hostName?: string;
  createdAt?: number;
  updatedAt?: number;
  lastEvent?: EventLineDoc | null;
  // Hold'em
  handId?: number;
  streetId?: number;
  stage?: HoldemStage | string;
  potLevel?: number;
  buttonPid?: string | null;
  sbPid?: string | null;
  bbPid?: string | null;
  // Blackjack
  roundId?: number;
  phase?: 'betting' | 'playing' | string;
  house?: number;
  dealerBJ?: boolean;
  /** `'paid'` or `'cancelled'`; a newer phone may write other values. */
  roundEnd?: string;
  // Guards and the end of the game
  mode?: string;
  appMin?: number;
  closed?: boolean;
  final?: { at: number; list: { pid: string; name: string; stack: number }[] } | null;
}

/** `rooms/{CODE}/players/{pid}`. */
export interface PlayerDoc {
  name?: string;
  joinedAt?: number;
  stack?: number;
  sittingOut?: boolean;
  // Hold'em
  handId?: number;
  streetId?: number;
  streetBet?: number;
  committed?: number;
  folded?: boolean;
  allIn?: boolean;
  // Blackjack
  bjRound?: number | null;
  hands?: BjHand[];
  insurance?: number;
  surrendered?: boolean;
  bjPaidRound?: number | null;
  lastAction?: LastAction | null;
  ts?: number;
  avatar?: unknown;
}

/** A player document together with its id, in seat order (the app's `players()`). */
export type Seat = PlayerDoc & { pid: string };

/** What a domain command returns: the writes to make, or why it refuses. */
export type Outcome<T, R extends string> = ({ ok: true } & T) | { ok: false; reason: R };

/**
 * The line under the room's header. `t` is the text in Hebrew, which every version shows; `key` and `p` (R-006) are the
 * catalog key and its parameters (names as typed, amounts as numbers, lists of names), from which each phone writes it
 * in its own language. Absent when an older phone wrote the line.
 */
export interface EventLineDoc {
  t: string;
  ts: number;
  key?: string;
  p?: Readonly<Record<string, string | number | readonly string[]>>;
}
