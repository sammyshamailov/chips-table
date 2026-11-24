/**
 * The app's state (`S`): who this phone is, the table it is at (as last read from the store), and what the player is
 * doing on the screen (chips in hand, the open sheet, the forms). One plain object: the actions and the room session
 * change it, `render()` draws it, and the screens read it through the session (src/ui/session.ts). Nothing here
 * touches the page or the store; the questions below are pure functions of the state.
 */
import { chipsOf, denoms as denomsFor, sumOf } from '../domain/chips';
import { holdemState, type HoldemState } from '../domain/holdem/rules';
import type { KeyValueStore } from '../data/browser-storage';
import type { Store, Unsubscribe } from '../data/store';
import type { Standing } from '../data/schema';
import { storedEvent, t, type Key, type Params } from '../i18n';
import { validAv } from '../ui/avatars';
import type { AppState, SeatView } from '../ui/session';

/** The state, including the parts no screen reads. */
export interface State extends AppState {
  /** The store in use (Firestore or this phone only), set when the app connects. */
  db: Store | null;
  /** The room session's listeners, stopped when leaving a table. */
  unsubs: Unsubscribe[];
  /** The chips in your hand, one entry per chip (they add up to `pending` when they are right). */
  pendChips: number[];
  /** The turn-the-phone prompt was dismissed at this table. */
  rotOff: boolean;
}

/**
 * The state at start-up, from what the phone remembers: its player id (made with `newId` only when there is none,
 * then saved), name and avatar.
 */
export function createState(ls: KeyValueStore, newId: () => string): State {
  let saved: unknown = null;
  try {
    saved = JSON.parse(ls.get('chips.avatar') || 'null');
  } catch {
    // a damaged saved avatar: start without one
  }
  const S: State = {
    mode: 'pending',
    db: null,
    readOnly: false,
    myId: ls.get('chips.pid') || newId(),
    name: ls.get('chips.name') || '',
    avatar: validAv(saved) ? saved : null,
    code: null,
    room: null,
    roomLoaded: false,
    players: {},
    unsubs: [],
    pending: 0,
    pendChips: [],
    sheet: null,
    sel: [],
    settle: {},
    dealerBJ: false,
    confirm: null,
    adj: {},
    rooms: [],
    joinCode: '',
    newName: '',
    create: { game: 'holdem', stack: '1000', sb: '5', bb: '10', minBet: '10', maxBet: '500', play: true },
    edit: null,
    rotOff: false,
  };
  ls.set('chips.pid', S.myId);
  return S;
}

/** The players at the table, each with its id, in the order they sat down. */
export function playerList(S: State): SeatView[] {
  return Object.entries(S.players)
    .map(([pid, d]) => ({ pid, ...d }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

/** This phone's player at the table, or null. */
export function me(S: State): SeatView | null {
  return S.players[S.myId] ? { pid: S.myId, ...S.players[S.myId] } : null;
}

/** This phone opened the table (or was made the dealer). */
export function isHost(S: State): boolean {
  return !!(S.room && S.room.hostId === S.myId);
}

/** A player's name; the dealer's from the room when they don't sit at the table. */
export function nameOf(S: State, id: string): string {
  return (
    (S.players[id] && S.players[id].name) || (S.room && S.room.hostId === id && S.room.hostName) || t('common.player')
  );
}

/** The Hold'em hand as the rules see it (src/domain/holdem/rules.ts). Only inside a table. */
export function holdem(S: State): HoldemState {
  return holdemState(S.room as NonNullable<State['room']>, playerList(S));
}

/** The table's chip values, smallest first. Only inside a table. */
export function roomDenoms(S: State): number[] {
  const r = S.room as NonNullable<State['room']>;
  return denomsFor(r.game, r.sb, r.minBet);
}

/** The standings now: every player's stack, highest first. */
export function standings(S: State): Standing[] {
  return playerList(S)
    .map(p => ({ pid: p.pid, name: p.name, stack: p.stack || 0 }))
    .sort((a, b) => b.stack - a.stack);
}

/**
 * The chips in your hand right now. Anything that changed the amount without chips (the presets, clearing) resets
 * them to the biggest chips that make it up.
 */
export function pendChips(S: State): number[] {
  if (sumOf(S.pendChips) !== S.pending) S.pendChips = chipsOf(S.pending);
  return S.pendChips;
}

/** A new player document for this phone's player (or, with its name changed, for one the dealer adds). */
export function newPlayer(S: State, stack: number, now: number) {
  return {
    name: S.name.trim().slice(0, 20) || t('common.player'),
    joinedAt: now,
    stack,
    handId: 0,
    streetId: 0,
    streetBet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    sittingOut: false,
    bjRound: null,
    hands: [],
    insurance: 0,
    surrendered: false,
    lastAction: null,
    ts: now,
    avatar: S.avatar || null,
  };
}

/** The room's document path. */
export const roomPath = (S: State): string => 'rooms/' + S.code;

/** A player's document path (this phone's player by default). */
export const playerPath = (S: State, id: string = S.myId): string => 'rooms/' + S.code + '/players/' + id;

/**
 * The line under the room's header (`lastEvent`), with the room's `updatedAt`: its key and parameters, read in each
 * phone's language, and its Hebrew text for phones on older versions (src/i18n/, `storedEvent`).
 */
export const eventLine = (key: Key, p: Params, now: number) => ({
  lastEvent: { ...storedEvent(key, p), ts: now },
  updatedAt: now,
});
