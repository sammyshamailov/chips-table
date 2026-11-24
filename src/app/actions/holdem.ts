/**
 * Hold'em: a player's bet or fold, and the dealer's new hand, next street, award and cancel. Each reads the state,
 * asks the rules (src/domain/holdem/) and writes what they return, adding `ts` and writing the dealer's stack changes
 * as increments; a refusal becomes its toast (or nothing, where there never was one), and the room gets its event
 * line (`eventLine`).
 */
import * as HR from '../../domain/holdem/rules';
import * as Pots from '../../domain/holdem/pots';
import { formatChips, hasKey, t, type Key, type Params } from '../../i18n';
import type { Actions, AppContext } from '../context';
import { eventLine, holdem, me, nameOf, pendChips, playerList, playerPath, roomPath } from '../state';

export function holdemActions(c: AppContext): Actions {
  const { S } = c;
  const H = () => holdem(S);
  const ev = (key: Key, p: Params = {}) => eventLine(key, p, c.now());

  async function bet(add: number) {
    const res = HR.bet(H(), me(S), add, pendChips(S));
    if (!res.ok) return;
    c.buzz();
    const ok = await c.write(playerPath(S), 'update', { ...res.patch, ts: c.now() });
    if (ok) S.pending = 0;
    c.render();
  }

  async function fold() {
    const res = HR.fold(H(), me(S));
    if (!res.ok) return;
    c.buzz();
    await c.write(playerPath(S), 'update', { ...res.patch, ts: c.now() });
  }

  async function newHand() {
    const r = S.room as NonNullable<typeof S.room>,
      plan = HR.newHand(r, playerList(S));
    if (!plan.ok) {
      c.toast(plan.reason === 'pot-not-empty' ? t('toast.potNotEmpty') : t('toast.twoPlayers'));
      return;
    }
    const line = ev('ev.handStarted', { hand: plan.room.handId, sb: r.sb, bb: r.bb });
    if (!(await c.write(roomPath(S), 'update', { ...plan.room, ...line }))) return;
    c.buzz();
    await Promise.all(plan.posts.map(x => c.write(playerPath(S, x.pid), 'update', { ...x.patch, ts: c.now() })));
  }

  async function nextStreet() {
    const res = HR.nextStreet(S.room as NonNullable<typeof S.room>);
    if (!res.ok) return;
    c.buzz();
    const k = 'ev.' + res.patch.stage;
    await c.write(roomPath(S), 'update', { ...res.patch, ...(hasKey(k) ? ev(k) : {}) });
  }

  async function award(win: string[]) {
    const res = Pots.award(H(), win);
    if (!res.ok) {
      c.toast(t('toast.pickWinner'));
      return;
    }
    const pays = res.pays.map(([id, a]) => `${nameOf(S, id)} +${formatChips(a)}`).join(' · ');
    if (!(await c.write(roomPath(S), 'update', { ...res.room, ...ev('ev.award', { pays }) }))) return;
    c.buzz();
    await Promise.all(
      res.pays.map(([id, a]) =>
        c.write(playerPath(S, id), 'update', { stack: c.inc(a), lastAction: { k: 'won', amt: a }, ts: c.now() }),
      ),
    );
    S.sel = [];
    if (res.left === 0) S.sheet = null;
    else c.toast(t('toast.sidePot', { amt: res.left }));
    c.render();
  }

  async function cancelHand() {
    const x = Pots.cancelHandRefunds(H());
    await c.write(roomPath(S), 'update', { ...x.room, ...ev('ev.handCancelled') });
    await Promise.all(
      x.refunds.map(r =>
        c.write(playerPath(S, r.pid), 'update', {
          stack: c.inc(r.amt),
          lastAction: { k: 'refund', amt: r.amt },
          ts: c.now(),
        }),
      ),
    );
    S.sheet = null;
    S.confirm = null;
    c.render();
  }

  return {
    hgo: v => bet(Number(v)),
    fold: () => fold(),
    newhand: () => newHand(),
    next: () => nextStreet(),
    solo: v => award([v as string]),
    pick: v => {
      const pid = v as string;
      S.sel = S.sel.includes(pid) ? S.sel.filter(x => x !== pid) : [...S.sel, pid];
      c.render();
    },
    award: () => award(S.sel),
    cancelhand: () => cancelHand(),
  };
}
