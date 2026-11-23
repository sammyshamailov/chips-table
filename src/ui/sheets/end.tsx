/** The dealer ends the game: the standings, then the ceremony on every phone and the table closes. */
import type { Standing } from '../../data/schema';
import { gameMode } from '../../games/registry';
import { Rank } from '../components/rank';
import { SheetHead } from '../components/sheet-head';
import type { Session } from '../session';

export interface EndProps {
  list: Standing[];
  players: Record<string, { avatar?: unknown }>;
  /** Chips still on the table: what the dealer has to do first, or null. */
  settleFirst: string | null;
}

export function endProps(s: Session): EndProps {
  const r = s.state.room;
  return {
    list: s.standings(),
    players: s.state.players,
    settleFirst: s.chipsOnTable() ? gameMode(r && r.game).settleFirst : null,
  };
}

export function EndSheet({ list, players, settleFirst }: EndProps) {
  return (
    <>
      <SheetHead title="סיום המשחק" />
      <span class="muted">מכריזים על המנצח, כולם רואים את הטקס, והשולחן נסגר. אפשר לפתוח אותו מחדש אחר כך.</span>
      {settleFirst && <div class="banner">{`יש עדיין צ'יפים על השולחן. ${settleFirst} לפני ההכרזה.`}</div>}
      <Rank list={list} players={players} />
      <button class="btn primary wide" data-a="endgame" disabled={!!settleFirst || !list.length}>
        הכרזה על המנצח וסגירת השולחן
      </button>
    </>
  );
}
