/**
 * The dealer's Hold'em controls: when everyone else has folded, give the pot to the last player with one tap; a new
 * hand (between hands, or when the pot is empty); the next street; split the pot (the award sheet); cancel the hand;
 * end the game.
 */
import { fmt } from '../format';
import type { HoldemHostProps } from '../tables/holdem/select';

/** The button that deals the next street, by the street now. */
const NEXT: Record<string, string> = {
  preflop: 'פתיחת פלופ',
  flop: 'פתיחת טרן',
  turn: 'פתיחת ריבר',
  river: 'לשואודאון',
};

export function HoldemHost({ stage, pot, solo }: HoldemHostProps) {
  const next = NEXT[stage];
  return (
    <section class="host">
      <h3>בקרת דילר</h3>
      {solo && (
        <button class="btn primary" data-a="solo" data-v={solo.pid}>
          {`${solo.name} לוקח את הקופה (${fmt(pot)})`}
        </button>
      )}
      <div class="btns">
        {(stage === 'idle' || pot === 0) && (
          <button class={'btn ' + (solo ? '' : 'primary')} data-a="newhand">
            יד חדשה
          </button>
        )}
        {next && (
          <button class="btn" data-a="next">
            {next}
          </button>
        )}
        {pot > 0 && (
          <button class={'btn ' + (stage === 'showdown' ? 'primary' : '')} data-a="sheet" data-v="award">
            חלוקת הקופה
          </button>
        )}
        {stage !== 'idle' && (
          <button class="btn ghost" data-a="sheet" data-v="cancel">
            ביטול היד
          </button>
        )}
        <button class="btn ghost" data-a="sheet" data-v="end">
          סיום המשחק
        </button>
      </div>
    </section>
  );
}
