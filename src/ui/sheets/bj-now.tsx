/** Blackjack: the dealer pays a player's blackjack at once (3:2), with a second tap to confirm. */
import { BLACKJACK_PAYS } from '../../domain/blackjack/rules';
import { SheetHead } from '../components/sheet-head';
import { formatChips, t } from '../../i18n';
import type { Session } from '../session';

export interface BjNowProps {
  /** Players whose first two cards can still be a blackjack, with their bet. */
  list: { pid: string; name: string; bet: number }[];
  /** The player whose button waits for the second tap. */
  sure: string | null;
}

export function bjNowProps(s: Session): BjNowProps {
  const c = s.state.confirm;
  return {
    list: s
      .players()
      .filter(p => s.bjEligible(p))
      .map(p => ({ pid: p.pid, name: p.name, bet: p.hands[0].bet })),
    sure: c && c.startsWith('bj:') ? c.slice(3) : null,
  };
}

export function BjNowSheet({ list, sure }: BjNowProps) {
  return (
    <>
      <SheetHead title={t('game.bj.name')} />
      <span class="muted">{t('bjnow.help')}</span>
      <div class="stack" style="gap:8px">
        {list.length ? (
          list.map(p => {
            const win = Math.floor(p.bet * BLACKJACK_PAYS),
              ok = sure === p.pid;
            return (
              <div key={p.pid} class="handrow hr1">
                <div class="hl">
                  <b>{p.name}</b>
                  <span class="amt num">
                    <span class="mini"></span>
                    {formatChips(p.bet)}
                  </span>
                </div>
                <button
                  class={`btn small ${ok ? 'primary' : ''}`}
                  data-a="bjnow"
                  data-v={p.pid}
                  style="grid-column:span 2"
                >
                  {ok ? t('bjnow.sure', { amt: win }) : t('bjnow.pay', { amt: win })}
                </button>
              </div>
            );
          })
        ) : (
          <span class="muted">{t('bjnow.none')}</span>
        )}
      </div>
    </>
  );
}
