/**
 * Where the phone is: connecting to the store at start-up and going back to the last table (or the one in the
 * invite link), entering a table, going home, and switching to single-device mode.
 */
import { connect } from '../data/connect';
import { createLocalStore } from '../data/local-store';
import type { RoomSession } from '../sync/room-session';
import type { AppContext } from './context';

export interface NavigationDeps {
  session: RoomSession;
  /** Ends the ceremony if it is playing. */
  hideCeremony(): void;
  /** Keeps the screen on inside a table. */
  wake(): void;
  /** Lets the phone turn freely again (after "full screen, landscape"). */
  unlockTurn(): void;
}

export type Navigation = ReturnType<typeof createNavigation>;

export function createNavigation(c: AppContext, d: NavigationDeps) {
  const { S, storage: ls } = c,
    FX = c.layer.FX;
  // Settles once the store is connected: creating or joining a table waits for it.
  let ready: Promise<void> = Promise.resolve();

  function enter(code: string): void {
    d.session.leave();
    S.pending = 0;
    S.sheet = null;
    S.confirm = null;
    FX.ov = {};
    FX.pendFly = 0;
    S.rotOff = false;
    ls.set('chips.room', code);
    d.session.listen(code);
    d.wake();
    c.render();
  }

  function home(): void {
    d.session.leave();
    d.unlockTurn();
    d.hideCeremony();
    try {
      history.replaceState(null, '', location.pathname);
    } catch {
      // not allowed here: the hash stays, nothing else depends on it
    }
    S.code = null;
    S.room = null;
    S.sheet = null;
    ls.del('chips.room');
    c.render();
  }

  function useLocal(): void {
    d.session.leave();
    S.db = createLocalStore(ls);
    S.mode = 'local';
    S.readOnly = false;
    S.code = null;
    ls.del('chips.room');
    d.session.listRooms();
    c.render();
  }

  /**
   * Connects (Firestore or this phone only, src/data/connect.ts), lists the open tables, then enters the last table
   * or draws home. Synchronous up to its first render, although it returns a promise (`ready`).
   */
  function connectStore(): Promise<void> {
    ready = (async () => {
      const x = connect(window.FIREBASE_CONFIG, window.firebase, ls);
      S.db = x.store;
      S.mode = x.mode;
      d.session.listRooms();
      const hash = (location.hash || '').replace('#', '').toUpperCase();
      const last = /^[A-Z]{4}$/.test(hash) ? hash : ls.get('chips.room');
      if (last && !S.code) enter(last);
      else c.render();
    })();
    return ready;
  }

  return { enter, home, useLocal, connectStore, ready: () => ready };
}
