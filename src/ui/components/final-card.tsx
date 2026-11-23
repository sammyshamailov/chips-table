/** The closed table's card: the winner (or the tie), the standings, watch the ceremony again, reopen, go home. */
import type { Standing } from '../../data/schema';
import { fmt } from '../format';
import { Crown } from './crown';
import { Rank } from './rank';

interface FinalCardProps {
  /** The standings frozen when the game ended, highest first. */
  list: Standing[];
  players: Record<string, { avatar?: unknown }>;
  /** The dealer can open the table again. */
  canReopen: boolean;
}

export function FinalCard({ list, players, canReopen }: FinalCardProps) {
  const top = list[0] ? list[0].stack : 0,
    win = list.filter(x => x.stack === top);
  return (
    <section class="host fincard">
      <h3>המשחק הסתיים</h3>
      {win.length > 0 && (
        <div class="fc-win">
          <Crown />
          <b>{win.map(x => x.name).join(' ו')}</b>
          <span class="muted">
            {(win.length > 1 ? 'תיקו בצמרת' : 'המנצח/ת') + ' · '}
            <span class="num">{fmt(top)}</span> צ'יפים
          </span>
        </div>
      )}
      <Rank list={list} players={players} />
      <div class="btns">
        <button class="btn" data-a="replay">
          צפייה בטקס שוב
        </button>
        {canReopen && (
          <button class="btn ghost" data-a="reopen">
            פתיחת השולחן מחדש
          </button>
        )}
        <button class="btn ghost" data-a="home">
          למסך הראשי
        </button>
      </div>
    </section>
  );
}
