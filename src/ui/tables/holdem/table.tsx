/**
 * The Hold'em table as it is today: the dealer standing behind it, the felt with the street, the blinds, the five
 * board slots (the real cards are on the real table), the pot and the bet on this street; then a row per player.
 * (The felt-table redesign is R-007.)
 */
import { fmt } from '../../format';
import { STAGE_HE } from '../../labels';
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
function toCallText(t: HoldemTableProps): string {
  if (t.stage === 'idle') return t.handId ? 'היד הסתיימה. הדילר יתחיל יד חדשה.' : 'מחכים שהדילר יתחיל את היד הראשונה';
  return t.streetBet ? `ההימור ברחוב: ${fmt(t.streetBet)}` : 'אין הימור ברחוב הזה';
}

export function HoldemTable(t: HoldemTableProps) {
  const idle = t.stage === 'idle';
  return (
    <>
      <div class="hdealer">
        <DealerFigure />
      </div>
      <section class={'table' + (t.closed ? ' closed' : '')}>
        {t.closed && <ClosedSign drop={t.signDrop} />}
        <div class="stage-row">
          <span class={'pill ' + (idle ? 'ok' : '')}>
            {(STAGE_HE[t.stage] || '') + (t.handId ? ` · יד ${t.handId}` : '')}
          </span>
          <span class="meta num">{`בליינדים ${fmt(t.sb)}/${fmt(t.bb)}`}</span>
        </div>
        <div class="board" aria-label="קלפים על השולחן">
          {[0, 1, 2, 3, 4].map(i => (
            <span class={'slot ' + (i < t.cards ? 'on' : '')}></span>
          ))}
        </div>
        <div class="pot">
          <span class="lbl">קופה</span>
          <span class="big num" data-k="pot">
            {fmt(t.pot)}
          </span>
        </div>
        <div class="tocall">{toCallText(t)}</div>
      </section>
      <div class="seats">
        {t.dealer && <DealerRow d={t.dealer} />}
        {t.seats.length ? (
          t.seats.map(s => <SeatRow key={s.pid} seat={s} />)
        ) : (
          <div class="muted" style="text-align:center;padding:16px">
            עוד אין שחקנים. שתפו את הקוד.
          </div>
        )}
      </div>
    </>
  );
}
