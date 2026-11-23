/**
 * The dealer's Blackjack controls: deal (which locks the bets) while bets are open; then settle and pay, pay a
 * blackjack at once, or cancel the round; and end the game.
 */
import type { BlackjackHostProps } from '../tables/blackjack/select';

export function BlackjackHost({ betting, bettors, canPayNow }: BlackjackHostProps) {
  return (
    <section class="host">
      <h3>בקרת דילר</h3>
      <div class="btns">
        {betting ? (
          <button class="btn primary" data-a="deal" disabled={!bettors}>
            חלוקת קלפים (נועל הימורים)
          </button>
        ) : (
          <>
            <button class="btn primary" data-a="sheet" data-v="settle">
              סימון זוכים ותשלום
            </button>
            {canPayNow && (
              <button class="btn" data-a="sheet" data-v="bjnow">
                בלאק ג'ק לשחקן
              </button>
            )}
            <button class="btn ghost" data-a="sheet" data-v="cancel">
              ביטול הסיבוב
            </button>
          </>
        )}
        <button class="btn ghost" data-a="sheet" data-v="end">
          סיום המשחק
        </button>
      </div>
      {betting && !bettors && <span class="muted">מחכים שמישהו יהמר.</span>}
    </section>
  );
}
