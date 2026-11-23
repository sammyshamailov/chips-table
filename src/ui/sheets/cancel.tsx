/** The dealer cancels the hand (Hold'em) or the round (Blackjack): every chip put in goes back. */
import type { GameMode } from '../../games/registry';
import { SheetHead } from '../components/sheet-head';

export function CancelSheet({ game }: { game: GameMode }) {
  return (
    <>
      <SheetHead title={game.cancel.title} />
      <span class="muted">{`כל הצ'יפים שהוכנסו ${game.cancel.refunds} יחזרו לשחקנים.`}</span>
      <button class="btn danger wide" data-a={game.cancel.action}>
        כן, לבטל ולהחזיר
      </button>
    </>
  );
}
