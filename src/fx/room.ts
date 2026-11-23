/**
 * Room effects: the dealer's nod, the bell when the dealer locks the bets (every stack on the felt gives a little
 * bump) and when a Hold'em hand starts. The narration for these is in src/audio/narration.ts; the ceremony at the end
 * of the game is the app's (`ceremony()`), wired in main.ts.
 */
import type { Sound } from '../audio/synth';
import type { DomainEvent } from '../sync/domain-events';
import type { EventBus } from '../sync/events';
import type { FxLayer } from './layer';

/** The dealer nods (the head in the dealer figure). Nothing when the phone asks for reduced motion. */
export function dealerNod(reduced: boolean): void {
  if (reduced) return;
  document.querySelectorAll('.dhead').forEach(el => {
    try {
      el.animate(
        [
          { transform: 'rotate(0)' },
          { transform: 'rotate(-7deg) translateY(1px)' },
          { transform: 'rotate(4deg)' },
          { transform: 'rotate(0)' },
        ],
        { duration: 750, easing: 'ease-in-out' },
      );
    } catch {
      // no Web Animations
    }
  });
}

export function subscribeRoomFx(bus: EventBus<DomainEvent>, L: FxLayer, snd: Sound): void {
  bus.on('BetsLocked', {
    after: e => {
      snd.bell();
      dealerNod(L.reduced);
      e.spots.forEach(s => {
        for (let j = 0; j < s.count; j++) L.pulse(`spot:${s.pid}:${j}`, 1.1);
      });
    },
  });
  bus.on('HandStarted', {
    after: () => {
      snd.bell();
      dealerNod(L.reduced);
    },
  });
}
