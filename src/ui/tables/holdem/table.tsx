/**
 * The Hold'em table as it is today: the dealer standing behind it, the felt with the street, the blinds, the five
 * board slots (the real cards are on the real table), the pot and the bet on this street; then a row per player.
 * (The felt-table redesign is R-007.)
 */
import { formatChips, t } from '../../../i18n';
import { stageText } from '../../labels';
import { ClosedSign } from '../closed-sign';
import { DealerFigure } from '../dealer-figure';
import { DealerRow, SeatRow, type DealerRowView, type HoldemSeatView } from './seat-row';

export type { DealerRowView };

export interface HoldemTableProps {
  /** The table is closed (after the ceremony); `signDrop`: its sign is dropping in right now. */
  closed: boolean;
  signDrop: boolean;
  /** `idle` between hands, else the street. */
  stage: string;
  /** The hand's number (0 before the first). */
  handId: number;
  sb: number;
  bb: number;
  /** Board slots turned over (0, 3, 4 or 5). */
  cards: number;
  pot: number;
  /** The highest bet on this street. */
  streetBet: number;
  /** The dealer's own row, when the dealer doesn't play. */
  dealer: DealerRowView | null;
  /** Everyone at the table, in seat order. */
  seats: HoldemSeatView[];
}

/** The line under the pot: how the hand stands. */
function toCallText(v: HoldemTableProps): string {
  if (v.stage === 'idle') return v.handId ? t('htable.over') : t('htable.first');
  return v.streetBet ? t('htable.streetBet', { amt: v.streetBet }) : t('htable.noBet');
}

export function HoldemTable(v: HoldemTableProps) {
  const idle = v.stage === 'idle';
  return (
    <>
      <div class="hdealer">
        <DealerFigure />
      </div>
      <section class={'table' + (v.closed ? ' closed' : '')}>
        {v.closed && <ClosedSign drop={v.signDrop} />}
        <div class="stage-row">
          <span class={'pill ' + (idle ? 'ok' : '')}>
            {stageText(v.stage) + (v.handId ? ' · ' + t('common.handNo', { n: String(v.handId) }) : '')}
          </span>
          <span class="meta num">{t('htable.blinds', { sb: v.sb, bb: v.bb })}</span>
        </div>
        <div class="board" aria-label={t('htable.board')}>
          {[0, 1, 2, 3, 4].map(i => (
            <span class={'slot ' + (i < v.cards ? 'on' : '')}></span>
          ))}
        </div>
        <div class="pot">
          <span class="lbl">{t('htable.pot')}</span>
          <span class="big num" data-k="pot">
            {formatChips(v.pot)}
          </span>
        </div>
        <div class="tocall">{toCallText(v)}</div>
      </section>
      <div class="seats">
        {v.dealer && <DealerRow d={v.dealer} />}
        {v.seats.length ? (
          v.seats.map(s => <SeatRow key={s.pid} seat={s} />)
        ) : (
          <div class="muted" style="text-align:center;padding:16px">
            {t('htable.empty')}
          </div>
        )}
      </div>
    </>
  );
}
