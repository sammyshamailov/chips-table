/**
 * The dealer's Hold'em controls: when everyone else has folded, give the pot to the last player with one tap; a new
 * hand (between hands, or when the pot is empty); the next street; split the pot (the award sheet); cancel the hand;
 * end the game.
 */
import { t, type Key } from '../../i18n';
import type { HoldemHostProps } from '../tables/holdem/select';

/** The button that deals the next street, by the street now. */
const NEXT: Record<string, Key> = {
  preflop: 'hhost.next.preflop',
  flop: 'hhost.next.flop',
  turn: 'hhost.next.turn',
  river: 'hhost.next.river',
};

export function HoldemHost({ stage, pot, solo }: HoldemHostProps) {
  const next = Object.prototype.hasOwnProperty.call(NEXT, stage) ? t(NEXT[stage]) : '';
  return (
    <section class="host">
      <h3>{t('host.title')}</h3>
      {solo && (
        <button class="btn primary" data-a="solo" data-v={solo.pid}>
          {t('hhost.solo', { name: solo.name, amt: pot })}
        </button>
      )}
      <div class="btns">
        {(stage === 'idle' || pot === 0) && (
          <button class={'btn ' + (solo ? '' : 'primary')} data-a="newhand">
            {t('hhost.newHand')}
          </button>
        )}
        {next && (
          <button class="btn" data-a="next">
            {next}
          </button>
        )}
        {pot > 0 && (
          <button class={'btn ' + (stage === 'showdown' ? 'primary' : '')} data-a="sheet" data-v="award">
            {t('hhost.award')}
          </button>
        )}
        {stage !== 'idle' && (
          <button class="btn ghost" data-a="sheet" data-v="cancel">
            {t('hhost.cancel')}
          </button>
        )}
        <button class="btn ghost" data-a="sheet" data-v="end">
          {t('host.end')}
        </button>
      </div>
    </section>
  );
}
