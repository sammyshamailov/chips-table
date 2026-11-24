/** The dealer cancels the hand (Hold'em) or the round (Blackjack): every chip put in goes back. */
import type { GameMode } from '../../games/registry';
import { t } from '../../i18n';
import { SheetHead } from '../components/sheet-head';

export function CancelSheet({ game }: { game: GameMode }) {
  return (
    <>
      <SheetHead title={game.cancel.title} />
      <span class="muted">{game.cancel.text}</span>
      <button class="btn danger wide" data-a={game.cancel.action}>
        {t('cancel.confirm')}
      </button>
    </>
  );
}
