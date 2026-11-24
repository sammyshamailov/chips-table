/** The closed table's card: the winner (or the tie), the standings, watch the ceremony again, reopen, go home. */
import type { Standing } from '../../data/schema';
import { formatChips, joinNames, t } from '../../i18n';
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
      <h3>{t('final.title')}</h3>
      {win.length > 0 && (
        <div class="fc-win">
          <Crown />
          <b>{joinNames(win.map(x => x.name))}</b>
          <span class="muted">
            {(win.length > 1 ? t('final.tie') : t('final.winner')) + ' · '}
            <span class="num">{formatChips(top)}</span>
            {' ' + t('common.chips')}
          </span>
        </div>
      )}
      <Rank list={list} players={players} />
      <div class="btns">
        <button class="btn" data-a="replay">
          {t('final.replay')}
        </button>
        {canReopen && (
          <button class="btn ghost" data-a="reopen">
            {t('final.reopen')}
          </button>
        )}
        <button class="btn ghost" data-a="home">
          {t('common.home')}
        </button>
      </div>
    </section>
  );
}
