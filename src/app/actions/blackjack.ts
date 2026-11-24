/**
 * Blackjack: a player's bet, clear and plays (double, split, insurance, surrender), and the dealer's deal, settle
 * sheet, payout, blackjack paid at once and cancelled round. The rules are in src/domain/blackjack/; see the Hold'em
 * actions for how a command's answer is written. Where the dealer writes several documents, the players come first
 * and the room last, so nobody can bet in the next round while a payout is still on its way.
 */
import * as BJ from '../../domain/blackjack/rules';
import * as BJA from '../../domain/blackjack/actions';
import * as BJR from '../../domain/blackjack/round';
import type { HandResult } from '../../domain/types';
import { t, type Key, type Params } from '../../i18n';
import { signed } from '../../ui/labels';
import type { Actions, AppContext } from '../context';
import { eventLine, me, pendChips, playerList, playerPath, roomPath } from '../state';

export function blackjackActions(c: AppContext): Actions {
  const { S } = c,
    FX = c.layer.FX;
  const room = () => S.room as NonNullable<typeof S.room>;
  const ev = (key: Key, p: Params = {}) => eventLine(key, p, c.now());
  const current = () => playerList(S).filter(p => BJ.isCurrent(p, S.room));

  async function placeBet() {
    const r = room(),
      res = BJA.placeBet(me(S), r, S.pending, pendChips(S));
    if (!res.ok) {
      if (res.reason === 'over-max') c.toast(t('toast.maxBet', { amt: r.maxBet }));
      else if (res.reason === 'under-min') c.toast(t('toast.minBet', { amt: r.minBet }));
      return;
    }
    c.buzz();
    const pend = S.pending,
      pc = S.pendChips;
    S.pending = 0;
    S.pendChips = [];
    FX.pendFly = 0;
    const ok = await c.write(playerPath(S), 'update', { ...res.patch, ts: c.now() });
    if (!ok) {
      S.pending = pend;
      S.pendChips = pc;
    }
    c.render();
  }

  async function clearBet() {
    const res = BJA.clearBet(me(S), room());
    if (!res.ok) return;
    await c.write(playerPath(S), 'update', { ...res.patch, ts: c.now() });
  }

  async function play(kind: string, i: number) {
    const res = BJA.play(me(S), room(), kind, i);
    if (!res.ok) return;
    c.buzz();
    await c.write(playerPath(S), 'update', { ...res.patch, ts: c.now() });
  }

  async function payout() {
    const r = room(),
      marks = S.settle as Record<string, HandResult | undefined>,
      res = BJR.settleRound(r, playerList(S), marks, S.dealerBJ); // paid blackjacks are done
    if (!res.ok) {
      c.toast(t('toast.markAll'));
      return;
    }
    c.buzz();
    const results = await Promise.all(
      res.writes.map(x =>
        c.write(playerPath(S, x.pid), 'update', { stack: c.inc(x.stackInc), ...x.patch, ts: c.now() }),
      ),
    );
    if (results.some(ok => !ok)) return; // the toast is up; pressing again pays only the players not yet settled
    const line = ev('ev.roundPaid', { round: r.roundId, house: signed(res.houseDelta) });
    if (!(await c.write(roomPath(S), 'update', { ...res.room, ...line }))) return;
    S.sheet = null;
    S.settle = {};
    S.dealerBJ = false;
    c.render();
  }

  // The dealer declares a player's blackjack mid-round: paid 3:2 at once, and the hand is marked paid so the
  // end-of-round payout and a cancelled round both leave it alone.
  async function payNow(pid: string) {
    const p = S.players[pid],
      res = BJA.payBlackjackNow(p, room());
    if (!res.ok) return;
    c.buzz();
    if (!(await c.write(playerPath(S, pid), 'update', { stack: c.inc(res.stackInc), ...res.patch, ts: c.now() })))
      return;
    await c.write(roomPath(S), 'update', { ...res.room, ...ev('ev.bjPaid', { name: p.name, amt: res.win }) });
    S.confirm = null;
    if (!playerList(S).some(x => BJ.blackjackEligible(x, S.room))) S.sheet = null;
    c.render();
  }

  async function cancelRound() {
    const x = BJR.cancelRound(room(), playerList(S));
    // Players first, then the room (see payout); bjPaidRound keeps a retry from refunding twice.
    const results = await Promise.all(
      x.refunds.map(f =>
        c.write(playerPath(S, f.pid), 'update', { stack: c.inc(f.stackInc), ...f.patch, ts: c.now() }),
      ),
    );
    if (results.some(ok => !ok)) return;
    if (!(await c.write(roomPath(S), 'update', { ...x.room, ...ev('ev.roundCancelled') }))) return;
    S.sheet = null;
    S.confirm = null;
    c.render();
  }

  return {
    bjbet: () => placeBet(),
    bjclear: () => clearBet(),
    bj: v => {
      const [k, i] = String(v).split(':');
      return play(k, Number(i));
    },
    deal: async () => {
      c.buzz();
      await c.write(roomPath(S), 'update', {
        phase: 'playing',
        dealerBJ: false,
        ...ev('ev.dealt', { round: room().roundId }),
      });
    },
    res: v => {
      const [k, rv] = String(v).split('|');
      S.settle[k] = rv;
      c.render();
    },
    allwin: () => {
      current().forEach(p =>
        p.hands.forEach((x, i) => {
          const k = p.pid + ':' + i;
          if (!x.result && !S.settle[k]) S.settle[k] = 'win';
        }),
      );
      c.render();
    },
    dbj: () => {
      S.dealerBJ = !S.dealerBJ;
      c.render();
    },
    payout: () => payout(),
    cancelround: () => cancelRound(),
    bjnow: v => {
      if (S.confirm !== 'bj:' + v) {
        S.confirm = 'bj:' + v;
        c.render();
        return;
      }
      return payNow(v as string);
    },
  };
}
