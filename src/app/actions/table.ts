/**
 * Running the table: the sheets, the dealer's players list (add a player, correct a stack, a break, a new dealer,
 * remove), the settings, switching the game, the invite, and ending and reopening the game.
 */
import { t, type Key, type Params } from '../../i18n';
import { signed } from '../../ui/labels';
import type { Actions, AppContext } from '../context';
import { newPlayerId } from '../ids';
import { eventLine, holdem, nameOf, newPlayer, playerPath, roomPath, standings } from '../state';

const whole = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

export function tableActions(c: AppContext): Actions {
  const { S } = c;
  const room = () => S.room as NonNullable<typeof S.room>;
  const ev = (key: Key, p: Params = {}) => eventLine(key, p, c.now());

  async function endGame() {
    const list = standings(S);
    if (!list.length) {
      c.toast(t('toast.noPlayers'));
      return;
    }
    const top = list[0].stack,
      win = list.filter(x => x.stack === top);
    const line =
      win.length > 1
        ? ev('ev.gameTie', { names: win.map(x => x.name), amt: top })
        : ev('ev.gameWin', { name: win[0].name, amt: top });
    if (await c.write(roomPath(S), 'update', { closed: true, final: { at: c.now(), list }, ...line })) {
      S.sheet = null;
      c.render();
    }
  }

  return {
    sheet: v => {
      S.sheet = v as string;
      S.confirm = null;
      if (v === 'award') {
        const h = holdem(S);
        S.sel = h.live.length === 1 ? [h.live[0].pid] : [];
      }
      if (v === 'settle') {
        S.settle = {};
        S.dealerBJ = false;
      }
      if (v === 'settings') {
        const r = room();
        S.edit = {
          sb: String(r.sb),
          bb: String(r.bb),
          minBet: String(r.minBet),
          maxBet: String(r.maxBet || 0),
          startStack: String(r.startStack),
        };
      }
      c.render();
    },
    close: () => {
      S.sheet = null;
      c.render();
    },
    copy: () => {
      const code = room().code;
      const link = location.origin + location.pathname + '#' + code;
      try {
        if (navigator.share)
          navigator.share({ title: t('app.title'), text: t('share.text', { code }), url: link }).catch(() => {});
        else
          navigator.clipboard.writeText(link).then(
            () => c.toast(t('toast.linkCopied')),
            () => c.toast(t('toast.code', { code })),
          );
      } catch {
        c.toast(t('toast.code', { code }));
      }
    },
    addp: async () => {
      const n = S.newName.trim();
      if (!n) {
        c.toast(t('toast.writeName'));
        return;
      }
      const pid = newPlayerId();
      const d = { ...newPlayer(S, room().startStack || 0, c.now()), name: n.slice(0, 20), avatar: null };
      if (await c.write(playerPath(S, pid), 'set', d)) {
        S.newName = '';
        c.toast(t('toast.added', { name: n }));
        c.render();
      }
    },
    adj: async v => {
      const [id, sign] = String(v).split('|');
      const amt = Math.floor(Number(S.adj[id] ?? room().startStack) || 0);
      const p = S.players[id];
      if (!p || !amt) return;
      const ns = Math.max(0, (p.stack || 0) + amt * Number(sign));
      const refund = { stack: ns, lastAction: { k: 'refund', amt: ns - (p.stack || 0) }, ts: c.now() };
      if (await c.write(playerPath(S, id), 'update', refund)) {
        await c.write(
          roomPath(S),
          'update',
          ev('ev.adjust', { name: p.name, amt: signed(amt * Math.sign(Number(sign))) }),
        );
        c.toast(t('toast.updated'));
      }
    },
    sitout: v => {
      const p = S.players[v as string];
      if (p) c.write(playerPath(S, v), 'update', { sittingOut: !p.sittingOut });
    },
    mkhost: async v => {
      const id = v as string;
      const hostName = id === S.myId ? S.name.trim() || nameOf(S, id) : nameOf(S, id);
      if (
        await c.write(roomPath(S), 'update', { hostId: id, hostName, ...ev('ev.newDealer', { name: nameOf(S, id) }) })
      ) {
        S.sheet = null;
        c.render();
      }
    },
    remove: async v => {
      const id = v as string;
      if (S.confirm !== id) {
        S.confirm = id;
        c.render();
        return;
      }
      S.confirm = null;
      await c.write(playerPath(S, id), 'delete');
      if (id === S.myId) c.render();
    },
    setgame: async v => {
      await c.write(roomPath(S), 'update', {
        game: v,
        stage: 'idle',
        phase: 'betting',
        roundId: (room().roundId || 1) + 1,
        ...ev(v === 'holdem' ? 'ev.toHoldem' : 'ev.toBlackjack'),
      });
      S.pending = 0;
    },
    saveset: async () => {
      const e = S.edit as NonNullable<typeof S.edit>;
      const patch = {
        sb: Math.max(1, whole(e.sb)),
        bb: Math.max(1, whole(e.bb)),
        minBet: Math.max(1, whole(e.minBet)),
        maxBet: whole(e.maxBet),
        startStack: whole(e.startStack),
        updatedAt: c.now(),
      };
      if (await c.write(roomPath(S), 'update', patch)) {
        c.toast(t('toast.saved'));
        S.sheet = null;
        c.render();
      }
    },
    endgame: () => endGame(),
    reopen: async () => {
      if (await c.write(roomPath(S), 'update', { closed: false, ...ev('ev.reopened') })) c.toast(t('toast.reopened'));
    },
  };
}
