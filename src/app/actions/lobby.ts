/**
 * Getting to a table: the new-table form, opening a table, joining by code or from the home list, sitting down,
 * "play as" (single-device mode), going home, and single-device mode itself.
 */
import type { Game } from '../../domain/types';
import { gameMode } from '../../games/registry';
import type { Actions, AppContext } from '../context';
import { randomCode } from '../ids';
import type { Navigation } from '../navigation';
import { eventLine, newPlayer, playerPath } from '../state';

/** Attempts at a code no table has yet. */
const CODE_TRIES = 4;

const whole = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

export function lobbyActions(c: AppContext, nav: Navigation): Actions {
  const { S, storage: ls } = c;

  function nameFirst(inputId: string): boolean {
    if (S.name.trim()) return true;
    c.toast('כתבו את השם שלכם קודם');
    document.getElementById(inputId)?.focus();
    return false;
  }

  async function createRoom() {
    if (!nameFirst('name')) return;
    await nav.ready();
    if (S.readOnly) {
      c.toast('אין לך הרשאת כתיבה בשולחן המשותף');
      return;
    }
    const f = S.create;
    if (whole(f.stack) < 1) {
      c.toast("קבעו כמות צ'יפים התחלתית");
      return;
    }
    let code = randomCode();
    for (let i = 0; i < CODE_TRIES; i++) {
      try {
        const s = await (S.db as NonNullable<typeof S.db>).doc('rooms/' + code).get();
        if (!s.exists) break;
      } catch {
        break;
      }
      code = randomCode();
    }
    const now = c.now();
    const room = {
      code,
      game: f.game,
      startStack: whole(f.stack),
      sb: Math.max(1, whole(f.sb)),
      bb: Math.max(1, whole(f.bb)),
      minBet: Math.max(1, whole(f.minBet)),
      maxBet: whole(f.maxBet),
      hostId: S.myId,
      hostName: S.name.trim().slice(0, 20),
      createdAt: now,
      handId: 0,
      streetId: 0,
      stage: 'idle',
      potLevel: 0,
      buttonPid: null,
      roundId: 1,
      phase: 'betting',
      house: 0,
      dealerBJ: false,
      ...eventLine('השולחן נפתח', c.now()),
    };
    if (!(await c.write('rooms/' + code, 'set', room))) return;
    S.code = code;
    if (f.play) await c.write('rooms/' + code + '/players/' + S.myId, 'set', newPlayer(S, room.startStack, c.now()));
    nav.enter(code);
  }

  async function sitDown() {
    if (!nameFirst('jname')) return;
    ls.set('chips.name', S.name.trim());
    await c.write(playerPath(S), 'set', newPlayer(S, (S.room && S.room.startStack) || 0, c.now()));
  }

  return {
    cgame: v => {
      S.create.game = v as Game;
      S.create.play = gameMode(v).dealerPlays;
      c.render();
    },
    create: () => createRoom(),
    join: async () => {
      const code = S.joinCode.trim().toUpperCase();
      if (code.length !== 4) {
        c.toast('קוד החדר הוא 4 אותיות');
        return;
      }
      if (S.name.trim()) ls.set('chips.name', S.name.trim());
      await nav.ready();
      nav.enter(code);
    },
    open: async v => {
      await nav.ready();
      nav.enter(v as string);
    },
    sit: () => sitDown(),
    claim: v => {
      S.myId = v as string;
      ls.set('chips.pid', S.myId);
      S.pending = 0;
      c.render();
    },
    home: () => nav.home(),
    local: () => nav.useLocal(),
    retry: () => {
      try {
        location.reload();
      } catch {
        // nothing to do
      }
    },
  };
}
