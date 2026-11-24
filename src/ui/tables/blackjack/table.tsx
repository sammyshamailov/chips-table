/**
 * The Blackjack table: the felt with its printed arcs, the dealer behind it with her chip rack, the limits and the
 * round on placards, the round's state in the middle, and a seat per player along the arc. `--u` (1% of the table's
 * width, set by the app's `setU`) scales it all as one picture.
 */
import { chipStyle } from '../../chips-html';
import { t } from '../../../i18n';
import { signed } from '../../labels';
import { ClosedSign } from '../closed-sign';
import { DealerFigure } from '../dealer-figure';
import { GEO, arcPath, seatLayout } from './geometry';
import { BjSeat, type BjSeatView } from './seat';

export interface BlackjackTableProps {
  hostName: string;
  minBet: number;
  /** 0: no maximum. */
  maxBet: number;
  roundId: number;
  /** The house's balance since the table opened. */
  house: number;
  /** Bets are open (`phase: betting`); otherwise the cards are dealt. */
  betting: boolean;
  /** The table is closed (after the ceremony); `signDrop`: its sign is dropping in right now. */
  closed: boolean;
  signDrop: boolean;
  /** The room's chip values, smallest first (the dealer's rack shows them biggest first). */
  denoms: number[];
  /** Everyone at the table, in seat order. */
  seats: BjSeatView[];
  /** How many have a bet this round, and how much is on the felt (bets and insurance). */
  bettors: number;
  onFelt: number;
}

/** The arcs and lettering printed on the felt. */
function FeltPrint() {
  return (
    <svg class="print" viewBox="0 0 100 98" preserveAspectRatio="none" aria-hidden="true" direction="ltr">
      <defs>
        <path id="pa-bj" d={arcPath(GEO.bj, 48)} />
        <path id="pa-it" d={arcPath(GEO.insText, 40)} />
        <path id="pa-i1" d={arcPath(GEO.in1, 42)} />
        <path id="pa-i2" d={arcPath(GEO.in2, 42)} />
      </defs>
      <use href="#pa-i1" class="ln" />
      <use href="#pa-i2" class="ln" />
      <text class="t1">
        <textPath href="#pa-bj" startOffset="50%" text-anchor="middle">
          {t('bjt.feltBj')}
        </textPath>
      </text>
      <text class="t2">
        <textPath href="#pa-it" startOffset="50%" text-anchor="middle">
          {t('bjt.feltIns')}
        </textPath>
      </text>
    </svg>
  );
}

export function BlackjackTable(v: BlackjackTableProps) {
  const n = v.seats.length,
    lay = seatLayout(n);
  return (
    <section class={'bjt' + (n > 7 ? ' dense' : '') + (v.closed ? ' closed' : '')} aria-label={t('bjt.label')}>
      {v.closed && <ClosedSign drop={v.signDrop} />}
      <div class="dfig">
        <DealerFigure />
      </div>
      <div class="felt"></div>
      <FeltPrint />
      <div class="dlr">
        <div class="rack" data-k="dealer">
          {v.denoms
            .slice()
            .reverse()
            .map(d => (
              <i class="tube" style={chipStyle(d)}></i>
            ))}
        </div>
        <div class="dn">{t('common.nameDealer', { name: v.hostName })}</div>
      </div>
      <div class="plac num">
        <span>{t('bjt.min', { amt: v.minBet })}</span>
        <span>{t('bjt.max', { amt: v.maxBet ? v.maxBet : '∞' })}</span>
      </div>
      <div class="rnd num">
        <span>{t('bjt.round', { n: String(v.roundId) })}</span>
        <span>
          {t('bjt.house') + ' '}
          <span dir="ltr">{signed(v.house)}</span>
        </span>
      </div>
      <div class="cst">
        <span class={'pill ' + (v.betting ? 'ok' : '')}>{v.betting ? t('bjt.open') : t('bjt.dealt')}</span>
        <span class="meta num">
          {v.betting ? t('bjt.bettors', { n: v.bettors, total: n }) : t('bjt.onFelt', { amt: v.onFelt })}
        </span>
      </div>
      {n ? (
        v.seats.map((s, k) => <BjSeat key={s.pid} seat={s} phi={lay.angles[k]} base={lay.size} />)
      ) : (
        <div class="empty">
          {t('bjt.empty1')}
          <br />
          {t('bjt.empty2')}
        </div>
      )}
    </section>
  );
}
