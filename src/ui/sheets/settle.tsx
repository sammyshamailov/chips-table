/** Blackjack: the dealer marks every open hand (win, blackjack, push, lose) and pays the round. */
import { SheetHead } from '../components/sheet-head';
import { Option } from '../components/option';
import { formatChips, t } from '../../i18n';
import { resultText } from '../labels';
import type { Session } from '../session';

interface HandLine {
  /** `pid:index`, the key of the dealer's mark. */
  k: string;
  title: string;
  bet: number;
  doubled: boolean;
  /** Already decided (a blackjack paid mid-round, a surrender). */
  result: string | null;
  mark: string | undefined;
}

export interface SettleProps {
  hands: HandLine[];
  /** Somebody took insurance: ask whether the dealer has blackjack. */
  anyIns: boolean;
  dealerBJ: boolean;
}

export function settleProps(s: Session): SettleProps {
  const list = s.players().filter(p => s.bjCurrent(p));
  return {
    hands: list.flatMap(p =>
      p.hands.map((x, i) => ({
        k: p.pid + ':' + i,
        title: p.name + (p.hands.length > 1 ? ' · ' + t('common.handNo', { n: String(i + 1) }) : ''),
        bet: x.bet,
        doubled: !!x.doubled,
        result: x.result || null,
        mark: s.state.settle[p.pid + ':' + i],
      })),
    ),
    anyIns: list.some(p => p.insurance),
    dealerBJ: s.state.dealerBJ,
  };
}

const MARKS = [
  ['win', 'mark.win', 'w'],
  ['bj', 'mark.bj', 'b'],
  ['push', 'mark.push', 'p'],
  ['lose', 'mark.lose', 'l'],
] as const;

function Hand({ h }: { h: HandLine }) {
  if (h.result)
    return (
      <div class="handrow">
        <div class="row" style="justify-content:space-between">
          <b>{h.title}</b>
          <span class="num muted">{`${formatChips(h.bet)} · ${resultText(h.result)}`}</span>
        </div>
      </div>
    );
  return (
    <div class="handrow">
      <div class="row" style="justify-content:space-between">
        <b>{h.title}</b>
        <span class="amt num">
          <span class="mini"></span>
          {formatChips(h.bet) + (h.doubled ? ' · ' + t('common.doubled') : '')}
        </span>
      </div>
      <div class="res4">
        {MARKS.map(([rv, label, cl]) => (
          <button class={cl} data-a="res" data-v={`${h.k}|${rv}`} aria-pressed={h.mark === rv}>
            {t(label)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettleSheet({ hands, anyIns, dealerBJ }: SettleProps) {
  const missing = hands.filter(h => !h.result && !h.mark).length;
  return (
    <>
      <SheetHead title={t('settle.title')} />
      <button class="btn ghost" data-a="allwin">
        {t('settle.allWin')}
      </button>
      {anyIns && (
        <Option a="dbj" pressed={dealerBJ}>
          {t('settle.dealerBj')}
        </Option>
      )}
      <div class="stack" style="gap:8px">
        {hands.map(h => (
          <Hand key={h.k} h={h} />
        ))}
      </div>
      <button class="btn primary wide" data-a="payout" disabled={missing > 0}>
        {missing ? t('settle.missing', { n: missing }) : t('settle.pay')}
      </button>
    </>
  );
}
