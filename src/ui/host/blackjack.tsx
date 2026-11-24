/**
 * The dealer's Blackjack controls: deal (which locks the bets) while bets are open; then settle and pay, pay a
 * blackjack at once, or cancel the round; and end the game.
 */
import { t } from '../../i18n';
import type { BlackjackHostProps } from '../tables/blackjack/select';

export function BlackjackHost({ betting, bettors, canPayNow }: BlackjackHostProps) {
  return (
    <section class="host">
      <h3>{t('host.title')}</h3>
      <div class="btns">
        {betting ? (
          <button class="btn primary" data-a="deal" disabled={!bettors}>
            {t('bjhost.deal')}
          </button>
        ) : (
          <>
            <button class="btn primary" data-a="sheet" data-v="settle">
              {t('bjhost.settle')}
            </button>
            {canPayNow && (
              <button class="btn" data-a="sheet" data-v="bjnow">
                {t('bjhost.payBj')}
              </button>
            )}
            <button class="btn ghost" data-a="sheet" data-v="cancel">
              {t('bjhost.cancel')}
            </button>
          </>
        )}
        <button class="btn ghost" data-a="sheet" data-v="end">
          {t('host.end')}
        </button>
      </div>
      {betting && !bettors && <span class="muted">{t('bjhost.waiting')}</span>}
    </section>
  );
}
