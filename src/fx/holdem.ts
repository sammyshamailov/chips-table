/**
 * Hold'em effects: chips from a seat into the pot, and from the pot back to a seat, subscribed to the Hold'em events.
 * A check knocks on the table; a fold sounds like cards sliding away.
 */
import type { Sound } from '../audio/synth';
import type { DomainEvent, HoldemEvent } from '../sync/domain-events';
import type { EventBus } from '../sync/events';
import type { FxLayer } from './layer';

type PotBetEvent = Extract<HoldemEvent, { type: 'BlindPosted' | 'Called' | 'BetMade' | 'Raised' | 'WentAllIn' }>;

export function subscribeHoldemFx(bus: EventBus<DomainEvent>, L: FxLayer, snd: Sound): void {
  // chips into the pot (an all-in that moved no chips has nothing to fly)
  const toPot = (e: PotBetEvent) => {
    if (e.amount <= 0) return;
    L.fly({
      from: L.seatTarget(e.pid),
      to: L.rectOf('pot'),
      amt: e.chips,
      sound: () => snd.slide(),
      land: () => {
        snd.chips(3);
        L.pulse('pot', 1.06);
      },
    });
  };
  bus.on('BlindPosted', { after: toPot });
  bus.on('Called', { after: toPot });
  bus.on('BetMade', { after: toPot });
  bus.on('Raised', { after: toPot });
  bus.on('WentAllIn', { after: toPot });

  // chips from the pot to a seat: a win, or a refund
  for (const type of ['PotWon', 'HandRefunded'] as const)
    bus.on(type, {
      before: e => L.setOv(e.pid, { stack: e.stackBefore }, 700),
      after: (e, tok) =>
        L.fly({
          from: L.rectOf('pot'),
          to: L.seatTarget(e.pid),
          amt: e.amount,
          fadeOut: true,
          sound: () => snd.slide(),
          land: () => {
            snd.chips(4);
            L.clearOv(e.pid, tok);
            if (e.type === 'PotWon') {
              L.pulse('seat:' + e.pid, 1.2);
              if (e.mine) snd.win();
            }
          },
        }),
    });

  bus.on('Checked', { after: () => snd.knock() });
  bus.on('Folded', { after: () => snd.fold() });
}
