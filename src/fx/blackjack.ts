/**
 * Blackjack effects: chips flying between a seat, its betting spots and the dealer, subscribed to the Blackjack
 * events. Each `before` sets the override that keeps the old picture (and reads positions from before the render);
 * each `after` animates. Timings are the ones the table always had.
 */
import type { DomainEvent } from '../sync/domain-events';
import type { EventBus } from '../sync/events';
import { formatChips, t as tr } from '../i18n';
import type { FxLayer } from './layer';
import { dealerNod } from './room';
import type { Sound } from '../audio/synth';

/** How long the payout waits before chips come back to the seat (ms). */
const T1 = 1000;

export function subscribeBlackjackFx(bus: EventBus<DomainEvent>, L: FxLayer, snd: Sound): void {
  const spot = (pid: string, j: number) => L.rectOf(`spot:${pid}:${j}`);
  const slide = () => snd.slide();

  bus.on('BetPlaced', {
    before: e => (e.mine ? 0 : L.setOv(e.pid, { hands: e.prevHands }, 700)),
    after: (e, tok) => {
      if (e.mine) {
        // my chips in hand were already on the spot
        snd.chips(4);
        L.pulse(`spot:${e.pid}:0`, 1.08);
        return;
      }
      L.fly({
        from: L.seatTarget(e.pid),
        to: spot(e.pid, 0),
        amt: e.added,
        sound: slide,
        land: () => {
          snd.chips(3);
          L.clearOv(e.pid, tok);
        },
      });
    },
  });

  bus.on('BetCleared', {
    before: e => ({ from: L.oldRect(`spot:${e.pid}:0`), tok: L.setOv(e.pid, { stack: e.stackBefore }, 700) }),
    after: (e, p) =>
      L.fly({
        from: p.from,
        to: L.seatTarget(e.pid),
        amt: e.chips,
        fadeOut: true,
        sound: slide,
        land: () => {
          snd.chips(2);
          L.clearOv(e.pid, p.tok);
        },
      }),
  });

  bus.on('HandDoubled', {
    before: e => {
      const i = e.index,
        hv = e.halves,
        half = e.hands[i].bet / 2;
      const hands = e.hands.map((h, j) =>
        j === i ? { ...h, doubled: false, bet: half, chips: Array.isArray(hv[0]) ? hv[0] : undefined } : h,
      );
      return { u: L.unitPx(), tok: L.setOv(e.pid, { hands }, 800) };
    },
    after: (e, p) => {
      snd.whoosh();
      const t = spot(e.pid, e.index);
      L.fly({
        from: L.seatTarget(e.pid),
        to: L.shift(t, p.u * 3.8),
        amt: e.halves[1],
        dur: 600,
        land: () => {
          snd.chips(4);
          L.clearOv(e.pid, p.tok);
          L.pulse(`spot:${e.pid}:${e.index}`);
          L.floatText(L.shift(t, 0, -p.u * 9), '×2');
        },
      });
    },
  });

  bus.on('HandSplit', {
    before: e => {
      const i = e.index,
        hands = e.hands.map((h, x) => (x === i || x === i + 1 ? { ...h, _hide: true } : h));
      return { u: L.unitPx(), from: L.oldRect(`spot:${e.pid}:${i}`), tok: L.setOv(e.pid, { hands }, 900) };
    },
    after: (e, p) => {
      const { pid, index: i } = e;
      snd.whoosh();
      L.fly({
        from: p.from,
        to: spot(pid, i),
        amt: e.chips[0],
        dur: 420,
        lift: 12,
        land: () => {
          // the first half lands: show it while the second one is still on its way
          const o = L.FX.ov[pid];
          if (o && o.tok === p.tok && o.hands) {
            o.hands[i]._hide = false;
            L.redraw();
          }
        },
      });
      L.fly({
        from: L.seatTarget(pid),
        to: spot(pid, i + 1),
        amt: e.chips[1],
        delay: 140,
        dur: 580,
        land: () => {
          snd.chips(4);
          L.clearOv(pid, p.tok);
          const t = spot(pid, i + 1);
          L.floatText(L.shift(t, 0, -p.u * 9), tr('fx.split'));
        },
      });
    },
  });

  bus.on('InsuranceTaken', {
    before: e => L.setOv(e.pid, { ins: 0 }, 700),
    after: (e, tok) =>
      L.fly({
        from: L.seatTarget(e.pid),
        to: L.rectOf('ins:' + e.pid),
        amt: e.amount,
        sound: slide,
        land: () => {
          snd.chips(3);
          L.clearOv(e.pid, tok);
        },
      }),
  });

  bus.on('Surrendered', {
    before: e => L.setOv(e.pid, { stack: e.stackBefore }, 700),
    after: (e, tok) => {
      snd.fold();
      L.fly({
        from: spot(e.pid, 0),
        to: L.seatTarget(e.pid),
        amt: e.returned,
        fadeOut: true,
        land: () => {
          snd.chips(2);
          L.clearOv(e.pid, tok);
        },
      });
    },
  });

  // The dealer pays a blackjack mid-round: the bet goes back to the seat, and 3:2 comes from the dealer.
  bus.on('BlackjackPaid', {
    before: e => {
      if (!e.hand) return null;
      return {
        u: L.unitPx(),
        from: L.oldRect(`spot:${e.pid}:0`),
        tok: L.setOv(e.pid, { hands: [{ ...e.hand, _hide: true }], stack: e.stackBefore }, 1700),
      };
    },
    after: (e, p) => {
      if (!p) return;
      const { pid, win } = e,
        u = p.u;
      const dealer = L.rectOf('dealer'),
        st = L.seatTarget(pid),
        f = p.from || spot(pid, 0),
        off = L.shift(f, u * 4.2);
      dealerNod(L.reduced);
      snd.chips(3);
      L.floatText(L.shift(f, 0, -u * 10), tr('fx.blackjack'));
      L.fly({ from: f, to: st, amt: e.chips, delay: 1000, fadeOut: true });
      L.fly({
        from: dealer,
        to: off,
        amt: win,
        delay: 120,
        dur: 600,
        sound: () => snd.chips(3),
        land: () => L.fly({ from: off, to: st, amt: win, delay: 280, fadeOut: true }),
      });
      setTimeout(() => {
        L.clearOv(pid, p.tok);
        snd.chips(4);
        L.pulse('seat:' + pid, 1.2);
        L.floatText(L.shift(L.rectOf('seat:' + pid) || st, 0, -u * 12), '+' + formatChips(win), 'w');
        if (e.mine) snd.bj();
      }, 1560);
    },
  });

  // The round is settled: lost bets go to the dealer, wins come from the dealer, then everything goes to the seat.
  bus.on('HandsSettled', {
    before: e => {
      const { pid } = e;
      return {
        u: L.unitPx(),
        from: e.handsBefore.map((_, j) => L.oldRect(`spot:${pid}:${j}`)),
        insFrom: L.oldRect('ins:' + pid),
        tok: L.setOv(
          pid,
          { hands: e.handsBefore.map(h => ({ ...h, _hide: true })), ins: 0, stack: e.stackBefore, hideRes: true },
          T1 + 700,
        ),
      };
    },
    after: (e, p) => {
      const { pid, net } = e,
        u = p.u;
      const dealer = L.rectOf('dealer'),
        st = L.seatTarget(pid);
      e.settled.forEach(h => {
        const j = h.index,
          f = p.from[j] || spot(pid, j),
          amt = h.chips,
          res = h.result;
        if (res === 'lose' || res === 'surrender') {
          L.fly({ from: f, to: dealer, amt, delay: 80 * j, dur: 640, fadeOut: true, sound: slide });
        } else if (res === 'push') {
          L.fly({ from: f, to: st, amt, delay: T1, fadeOut: true });
        } else if (res === 'win' || res === 'bj') {
          const pay = h.pay,
            off = L.shift(f, u * 4.2),
            d0 = 120 + 80 * j;
          L.fly({ from: f, to: st, amt, delay: T1, fadeOut: true });
          L.fly({
            from: dealer,
            to: off,
            amt: pay,
            delay: d0,
            dur: 600,
            sound: () => snd.chips(3),
            land: () => L.fly({ from: off, to: st, amt: pay, delay: Math.max(0, T1 - d0 - 600), fadeOut: true }),
          });
        }
      });
      const ins = e.insurance;
      if (ins) {
        const f = p.insFrom || L.rectOf('ins:' + pid);
        if (!e.insuranceWon) L.fly({ from: f, to: dealer, amt: ins, dur: 600, fadeOut: true });
        else {
          const off = L.shift(f, u * 3.4);
          L.fly({ from: f, to: st, amt: ins, delay: T1, fadeOut: true });
          L.fly({
            from: dealer,
            to: off,
            amt: ins * 2,
            delay: 160,
            dur: 600,
            land: () => L.fly({ from: off, to: st, amt: ins * 2, delay: Math.max(0, T1 - 760), fadeOut: true }),
          });
        }
      }
      setTimeout(
        () => {
          L.clearOv(pid, p.tok);
          if (net >= 0) snd.chips(4);
          L.pulse('seat:' + pid, 1.2);
          L.floatText(
            L.shift(L.rectOf('seat:' + pid) || st, 0, -u * 12),
            net > 0 ? '+' + formatChips(net) : net < 0 ? '−' + formatChips(-net) : tr('common.push'),
            net > 0 ? 'w' : net < 0 ? 'l' : 'p',
          );
          if (e.mine) {
            if (net > 0) (e.anyBlackjack ? snd.bj : snd.win)();
            else if (net < 0) snd.lose();
            else snd.push();
          }
        },
        e.chipsReturn ? T1 + 560 : 760,
      );
    },
  });

  // The dealer cancelled the round: every bet goes back from its spot.
  bus.on('RoundRefunded', {
    before: e => {
      const { pid } = e;
      return {
        from: e.handsBefore.map((_, j) => L.oldRect(`spot:${pid}:${j}`)),
        insFrom: e.insurance ? L.oldRect('ins:' + pid) : null,
        tok: L.setOv(
          pid,
          { hands: e.handsBefore.map(h => ({ ...h, _hide: true })), ins: 0, stack: e.stackBefore },
          800,
        ),
      };
    },
    after: (e, p) => {
      const st = L.seatTarget(e.pid);
      snd.slide();
      e.bets.forEach(b => L.fly({ from: p.from[b.index], to: st, amt: b.chips, delay: 70 * b.index, fadeOut: true }));
      if (p.insFrom) L.fly({ from: p.insFrom, to: st, amt: e.insurance, fadeOut: true });
      setTimeout(() => {
        snd.chips(3);
        L.clearOv(e.pid, p.tok);
      }, 640);
    },
  });

  // The dealer gave chips (from the dealer to the seat) or took them (the other way).
  bus.on('Refunded', {
    before: e => (e.amount > 0 ? L.setOv(e.pid, { stack: e.stackBefore }, 700) : 0),
    after: (e, tok) => {
      if (e.amount > 0)
        L.fly({
          from: L.rectOf('dealer'),
          to: L.seatTarget(e.pid),
          amt: e.amount,
          fadeOut: true,
          sound: slide,
          land: () => {
            snd.chips(3);
            L.clearOv(e.pid, tok);
          },
        });
      else
        L.fly({
          from: L.seatTarget(e.pid),
          to: L.rectOf('dealer'),
          amt: -e.amount,
          fadeOut: true,
          sound: slide,
          land: () => snd.chips(2),
        });
    },
  });
}
