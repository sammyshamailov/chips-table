/**
 * What the screens read: the app's state and the questions they ask about it. `src/legacy.ts` builds the session (the
 * state and the actions still live there; every view is a component since R-005 phase 5).
 *
 * Only screens (`App`, `Home`, `RoomScreen`, `SheetScreen`) and the selectors of the sheets and the game views read the
 * session; every component below them gets plain data through its props.
 */
import type { Avatar, Player, Room, Standing } from '../data/schema';
import type { Override } from '../fx/layer';
import type { HoldemState } from '../domain/holdem/rules';
import type { Award } from '../domain/holdem/pots';
import type { Game } from '../domain/types';

/** A player document with its id, in seat order (the app's `players()`). */
export type SeatView = Player & { pid: string };

/** Anything with an avatar circle: a seat, a standings line, the phone's own player before sitting down. */
export interface AvatarOwner {
  pid: string;
  name?: string;
  avatar?: unknown;
}

/** The new-table form on the home screen (the inputs' text as typed). */
export interface CreateForm {
  game: Game;
  stack: string;
  sb: string;
  bb: string;
  minBet: string;
  maxBet: string;
  play: boolean;
}

/** The dealer's settings form (filled in when the Settings sheet opens). */
export interface EditForm {
  sb: string;
  bb: string;
  minBet: string;
  maxBet: string;
  startStack: string;
}

/** The app's state (`S` in `src/legacy.ts`), as far as the screens read it. */
export interface AppState {
  /** `pending` until connected, then `cloud` (Firestore) or `local` (this phone only). */
  mode: string;
  readOnly: boolean;
  myId: string;
  name: string;
  avatar: Avatar | null;
  code: string | null;
  room: Room | null;
  roomLoaded: boolean;
  players: Record<string, Player>;
  syncErr?: string | null;
  synced?: boolean;
  pSynced?: boolean;
  /** The chips in your hand (about to be bet), and which chips they are. */
  pending: number;
  /** The open sheet, or null. */
  sheet: string | null;
  /** Award sheet: the chosen winners. */
  sel: string[];
  /** Settle sheet: `pid:hand` → result. */
  settle: Record<string, string>;
  dealerBJ: boolean;
  /** A button waiting for its second tap (`bj:<pid>` or a pid to remove). */
  confirm: string | null;
  /** Players sheet: the amount typed per player. */
  adj: Record<string, string | number>;
  rooms: Room[];
  joinCode: string;
  newName: string;
  create: CreateForm;
  edit: EditForm | null;
}

/** What a table shows while chips fly (the effects layer, src/fx/layer.ts). */
export interface TableFx {
  /** What a player's spots and stack should still show until the chips in the air land, or null. */
  ov(pid: string): Override | null;
  /** The chips a seat shows: the old count while chips fly to it. */
  shownStack(p: { pid: string; stack?: number }): number;
  /** Your chips in hand that have landed (the ones still flying from the tray are left out). */
  ghost(): number[];
  /** The closed sign is dropping in (just after the ceremony). */
  signDrop(): boolean;
}

export interface Session {
  readonly state: AppState;
  /** What the table shows while chips fly. */
  readonly fx: TableFx;
  /** The room's chip values, smallest first. */
  denoms(): number[];
  /** This phone's player at the table, or null. */
  me(): SeatView | null;
  players(): SeatView[];
  isHost(): boolean;
  nameOf(pid: string): string;
  /** This phone's player for the avatar circle (also before sitting down). */
  myAvatar(): AvatarOwner;
  holdem(): HoldemState;
  /** What paying these winners would give each player (the award sheet's preview). */
  award(winners: readonly string[]): Award;
  /** The player has a bet in the current Blackjack round. */
  bjCurrent(p: SeatView): boolean;
  /** The dealer can pay this player's blackjack now. */
  bjEligible(p: SeatView): boolean;
  /** Chips are on the table (a Hold'em pot, Blackjack bets): the game can't be switched or ended. */
  chipsOnTable(): boolean;
  standings(): Standing[];
  /** The table is closed and the ceremony is over (the ceremony keeps it looking open until then). */
  looksClosed(): boolean;
  installAvailable(): boolean;
  newBuild(): boolean;
  /** `APP_BUILD` from config.js, or null in a local build. */
  readonly build: string | null;
  sound(): { on: boolean; ambiOn: boolean; voiceOn: boolean };
}
