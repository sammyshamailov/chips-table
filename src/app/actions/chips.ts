/**
 * The chips in your hand, before you bet them: a chip tapped in the tray flies onto your spot (Blackjack) or your
 * chips in hand, the presets set an amount, and clearing empties your hand. Nothing is written until you bet.
 */
import { chipsOf } from '../../domain/chips';
import type { Actions, AppContext } from '../context';
import { me, pendChips } from '../state';

export function chipActions(c: AppContext): Actions {
  const { S, snd, layer: L } = c,
    FX = L.FX;
  return {
    add: (v, t) => {
      const m = me(S),
        before = S.pending,
        held = pendChips(S).slice();
      S.pending = Math.min(m?.stack || 0, S.pending + Number(v));
      const added = S.pending - before;
      const got = added === Number(v) ? [added] : chipsOf(added);
      S.pendChips = held.concat(added ? got : []);
      c.buzz();
      snd.tap();
      const from = t && L.pageRect(t);
      if (!added || !from || L.reduced) {
        c.render();
        return;
      }
      FX.pendFly += got.length;
      c.render(); // the chip flies from the tray onto your betting spot
      const spot = S.room && S.room.game === 'blackjack' ? L.rectOf('spot:' + S.myId + ':0') : null;
      L.fly({
        from,
        to: L.onScreen(spot) ? spot : L.rectOf('pend'),
        amt: got,
        dur: 380,
        lift: 34,
        // It has landed in your hand: redraw the components (the stack on your spot grows by it).
        land: () => {
          FX.pendFly = Math.max(0, FX.pendFly - got.length);
          c.paint();
          snd.chips(1, 0.8);
        },
      });
    },
    setp: v => {
      S.pending = Math.max(0, Math.min(me(S)?.stack || 0, Number(v)));
      FX.pendFly = 0;
      snd.chips(3);
      c.render();
    },
    clearp: () => {
      if (S.pending) snd.slide();
      S.pending = 0;
      FX.pendFly = 0;
      c.render();
    },
  };
}
