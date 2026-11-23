/**
 * What happened at the table, as `diff.ts` reads it from two versions of the stored documents. One event per thing
 * the effects react to; each carries what its effect needs, so subscribers never look at the documents themselves.
 * Nothing is stored for these: every phone works them out from the same document changes.
 */
import type { BjHand, HandResult } from '../domain/types';

/** Chips to draw: the exact chips, or an amount made up from the biggest chips. */
export type Chips = number[] | number;

/** An event about one player. `mine`: that player is the one using this phone. */
interface PlayerEvent {
  pid: string;
  mine: boolean;
}

// ---------- Blackjack (a player's `lastAction.k`) ----------

/** `bet`: chips added to the first spot. `prevHands`: the spots before (none when the bet opened a new round). */
export interface BetPlaced extends PlayerEvent {
  type: 'BetPlaced';
  amount: number;
  prevHands: BjHand[];
  /** Just the chips added this time: exact when the stored stacks allow it, otherwise the amount. */
  added: Chips;
}

/** `clear`: the bet taken back to the stack. */
export interface BetCleared extends PlayerEvent {
  type: 'BetCleared';
  amount: number;
  chips: Chips;
  stackBefore?: number;
}

/** `double`: the spot `index` was doubled. `halves`: its two halves (the second one is what was added). */
export interface HandDoubled extends PlayerEvent {
  type: 'HandDoubled';
  index: number;
  hands: BjHand[];
  halves: [number[], number[]] | [number, number];
}

/** `split`: the spot `index` became `index` and `index + 1`. `chips`: what each of the two shows. */
export interface HandSplit extends PlayerEvent {
  type: 'HandSplit';
  index: number;
  hands: BjHand[];
  chips: [Chips, Chips];
}

/** `ins`: insurance placed. */
export interface InsuranceTaken extends PlayerEvent {
  type: 'InsuranceTaken';
  amount: number;
}

/** `surrender`: half the bet back to the stack. */
export interface Surrendered extends PlayerEvent {
  type: 'Surrendered';
  returned: number;
  stackBefore?: number;
}

/** `bjpay`: the dealer paid a blackjack mid-round. `hand` is the spot as it was (null if there was none). */
export interface BlackjackPaid extends PlayerEvent {
  type: 'BlackjackPaid';
  hand: BjHand | null;
  chips: Chips;
  win: number;
  stackBefore?: number;
}

/** One spot in a settled round, in spot order (spots already paid mid-round are left out). */
export interface SettledHand {
  index: number;
  result: HandResult | null;
  /** The chips that were on the spot. */
  chips: Chips;
  /** What the dealer adds (win, blackjack). */
  pay: number;
}

/** `bjres`: the dealer settled the round for this player. */
export interface HandsSettled extends PlayerEvent {
  type: 'HandsSettled';
  /** The spots as they were, before the result. */
  handsBefore: BjHand[];
  settled: SettledHand[];
  /** Won minus lost on the spots (insurance not included). */
  handsNet: number;
  anyBlackjack: boolean;
  /** The insurance that was on the felt, and whether it pays. */
  insurance: number;
  insuranceWon: boolean;
  /** The whole result (`lastAction.amt`). */
  net: number;
  /** Chips come back to the stack (a win, a push, or a winning insurance): the final count waits for them. */
  chipsReturn: boolean;
  stackBefore?: number;
}

/** `refund` with the spots emptied: the dealer cancelled the round and the bets go back from the spots. */
export interface RoundRefunded extends PlayerEvent {
  type: 'RoundRefunded';
  handsBefore: BjHand[];
  /** The bets that go back, by spot (spots already paid mid-round are left out). */
  bets: { index: number; chips: Chips }[];
  insurance: number;
  stackBefore?: number;
}

/** `refund` otherwise: the dealer gave (`amount > 0`) or took (`amount < 0`) chips. */
export interface Refunded extends PlayerEvent {
  type: 'Refunded';
  amount: number;
  stackBefore?: number;
}

// ---------- Hold'em (a player's `lastAction.k`) ----------

/** Chips into the pot. `amount` is what left the stack; `chips` what to draw. */
interface PotBet extends PlayerEvent {
  amount: number;
  chips: Chips;
}
export interface BlindPosted extends PotBet {
  type: 'BlindPosted';
}
export interface Called extends PotBet {
  type: 'Called';
}
export interface BetMade extends PotBet {
  type: 'BetMade';
}
export interface Raised extends PotBet {
  type: 'Raised';
}
/** Sent for every all-in, even one that moved no chips (`amount <= 0`): the narration says it once per hand. */
export interface WentAllIn extends PotBet {
  type: 'WentAllIn';
  handId: number;
}
export interface Checked extends PlayerEvent {
  type: 'Checked';
}
export interface Folded extends PlayerEvent {
  type: 'Folded';
}
/** `won`: chips from the pot. */
export interface PotWon extends PlayerEvent {
  type: 'PotWon';
  amount: number;
  stackBefore?: number;
}
/** `refund`: chips back from the pot (a cancelled hand, or the dealer's correction). */
export interface HandRefunded extends PlayerEvent {
  type: 'HandRefunded';
  amount: number;
  stackBefore?: number;
}

// ---------- The room ----------

/** `closed` switched on with the final standings: the ceremony. */
export interface GameEnded {
  type: 'GameEnded';
}
/** Blackjack: the dealer locked the bets. `spots`: every player in the round and how many spots they have. */
export interface BetsLocked {
  type: 'BetsLocked';
  roundId: number;
  spots: { pid: string; count: number }[];
}
/** Blackjack: the round was paid (not cancelled) and the next one opened. */
export interface RoundPaid {
  type: 'RoundPaid';
  roundId: number;
}
/** Hold'em: a new hand. */
export interface HandStarted {
  type: 'HandStarted';
  handId: number;
}
/** Hold'em: the flop, turn or river. */
export interface StreetDealt {
  type: 'StreetDealt';
  stage: 'flop' | 'turn' | 'river';
}

export type BlackjackEvent =
  | BetPlaced
  | BetCleared
  | HandDoubled
  | HandSplit
  | InsuranceTaken
  | Surrendered
  | BlackjackPaid
  | HandsSettled
  | RoundRefunded
  | Refunded;
export type HoldemEvent =
  BlindPosted | Called | BetMade | Raised | WentAllIn | Checked | Folded | PotWon | HandRefunded;
export type RoomEvent = GameEnded | BetsLocked | RoundPaid | HandStarted | StreetDealt;
export type DomainEvent = BlackjackEvent | HoldemEvent | RoomEvent;
