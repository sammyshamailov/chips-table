/**
 * The room session: the store's listeners for the table this phone is at (the room and its players) and for the
 * home screen's list of open tables. Every snapshot is normalised (src/data/schema.ts), diffed against what the
 * phone had (diff.ts) and handed to the event bus with the change to commit, so the effects run around the render:
 * every `before` → store the new documents and render → every `after` (events.ts).
 *
 * Unlike the rest of src/sync/ this file is not pure: it listens to the store and retries after a lost connection
 * (eslint.config.mjs makes the exception). It never decides what an event means; that is diff.ts.
 */
import { normalizePlayer, normalizeRoom, type Player, type Room } from '../data/schema';
import type { DocSnap, Store, StoreError, Unsubscribe } from '../data/store';
import { diffPlayers, diffRoom } from './diff';
import type { DomainEvent } from './domain-events';
import type { EventBus } from './events';
import { t } from '../i18n';

/** How long the home list shows a table after its last change. */
const LIST_FOR_MS = 1000 * 60 * 60 * 48;
/** How many recent tables the home list asks for. */
const LIST_SIZE = 6;
/** Wait before listening again after the connection dropped. */
const RETRY_MS = 2500;

/** The part of the app's state the session keeps up to date. */
export interface SessionState {
  myId: string;
  db: Store | null;
  code: string | null;
  room: Room | null;
  roomLoaded: boolean;
  players: Record<string, Player>;
  rooms: Room[];
  unsubs: Unsubscribe[];
  /** The last listener error's code, until the table is entered again. */
  syncErr?: string | null;
  /** The server has answered for the room / for the players (not only the phone's cache). */
  synced?: boolean;
  pSynced?: boolean;
}

export interface RoomSessionDeps {
  S: SessionState;
  bus: EventBus<DomainEvent>;
  /** The full render (measure → screens → after-effects). */
  render(): void;
  /** Redraws the components only: the home list changed. */
  paint(): void;
  toast(text: string): void;
  now(): number;
  /** Enters the table again from scratch (after a lost connection). */
  reenter(code: string): void;
}

export type RoomSession = ReturnType<typeof createRoomSession>;

export function createRoomSession(d: RoomSessionDeps) {
  const { S } = d;
  const store = () => S.db as Store;
  let roomsUnsub: Unsubscribe | null = null;

  /** Listens to the most recently changed open tables, for the home screen. */
  function listRooms(): void {
    if (roomsUnsub) roomsUnsub();
    roomsUnsub = store()
      .collection('rooms')
      .orderBy('updatedAt', 'desc')
      .limit(LIST_SIZE)
      .onSnapshot(
        s => {
          S.rooms = s.docs
            .filter(x => x.exists)
            .map(x => normalizeRoom(x.data()))
            .filter(r => !r.closed && d.now() - (r.updatedAt || 0) < LIST_FOR_MS);
          if (!S.code) d.paint();
        },
        () => {},
      );
  }

  /** Stops listening to the table. */
  function leave(): void {
    S.unsubs.forEach(u => {
      try {
        u();
      } catch {
        // a listener that is already gone
      }
    });
    S.unsubs = [];
  }

  /** Starts on the table `code`: forgets the old one and listens to the room and its players. */
  function listen(code: string): void {
    Object.assign(S, {
      syncErr: null,
      synced: false,
      pSynced: false,
      code,
      room: null,
      roomLoaded: false,
      players: {},
    });
    const mine = code;
    const onErr = (e: StoreError) => {
      if (S.code !== mine) return;
      S.syncErr = (e && e.code) || 'error';
      d.toast(t('toast.syncError', { code: S.syncErr }));
      d.render();
      if (e && (e.code === 'unavailable' || e.code === 'internal'))
        setTimeout(() => {
          if (S.code === mine) d.reenter(mine);
        }, RETRY_MS);
    };
    S.unsubs.push(
      store()
        .doc('rooms/' + code)
        .onSnapshot(s => onRoom(mine, s), onErr),
    );
    S.unsubs.push(
      store()
        .collection('rooms/' + code + '/players')
        .onSnapshot(s => {
          if (S.code !== mine) return;
          const m: Record<string, Player> = {};
          s.docs.forEach(x => {
            if (x.exists) m[x.id] = normalizePlayer(x.data());
          });
          let evs: DomainEvent[] = [];
          try {
            evs = diffPlayers(S.players, m, S.room, { myId: S.myId });
          } catch (e) {
            console.error(e);
          }
          d.bus.emit(evs, () => {
            S.players = m;
            S.pSynced = !s.metadata.fromCache;
            d.render();
          });
        }, onErr),
    );
  }

  function onRoom(mine: string, s: DocSnap): void {
    if (S.code !== mine) return;
    if (!s.exists) {
      if (!s.metadata.fromCache) {
        S.room = null;
        S.roomLoaded = true;
        d.render();
      }
      return;
    }
    const nr = normalizeRoom(s.data());
    let evs: DomainEvent[] = [];
    try {
      evs = diffRoom(S.room, nr, { myId: S.myId, players: S.players });
    } catch (e) {
      console.error(e);
    }
    d.bus.emit(evs, () => {
      S.room = nr;
      S.roomLoaded = true;
      S.synced = !s.metadata.fromCache;
      d.render();
    });
  }

  return { listRooms, leave, listen };
}
