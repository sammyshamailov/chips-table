/** Blackjack: the dealer marks every open hand (win, blackjack, push, lose) and pays the round. */
import { SheetHead } from '../components/sheet-head';
import { Option } from '../components/option';
import { fmt } from '../format';
import { RESULT_HE } from '../labels';
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
        title: p.name + (p.hands.length > 1 ? ` · יד ${i + 1}` : ''),
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
  ['win', 'ניצח', 'w'],
  ['bj', "בלאק ג'ק", 'b'],
  ['push', 'תיקו', 'p'],
  ['lose', 'הפסיד', 'l'],
];

function Hand({ h }: { h: HandLine }) {
  if (h.result)
    return (
      <div class="handrow">
        <div class="row" style="justify-content:space-between">
          <b>{h.title}</b>
          <span class="num muted">{`${fmt(h.bet)} · ${RESULT_HE[h.result]}`}</span>
        </div>
      </div>
    );
  return (
    <div class="handrow">
      <div class="row" style="justify-content:space-between">
        <b>{h.title}</b>
        <span class="amt num">
          <span class="mini"></span>
          {fmt(h.bet) + (h.doubled ? ' · דאבל' : '')}
        </span>
      </div>
      <div class="res4">
        {MARKS.map(([rv, t, cl]) => (
          <button class={cl} data-a="res" data-v={`${h.k}|${rv}`} aria-pressed={h.mark === rv}>
            {t}
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
      <SheetHead title="סיום סיבוב" />
      <button class="btn ghost" data-a="allwin">
        הדילר נשרף: כל מי שלא סומן ניצח
      </button>
      {anyIns && (
        <Option a="dbj" pressed={dealerBJ}>
          לדילר יש בלאק ג'ק (ביטוח משלם 2:1)
        </Option>
      )}
      <div class="stack" style="gap:8px">
        {hands.map(h => (
          <Hand key={h.k} h={h} />
        ))}
      </div>
      <button class="btn primary wide" data-a="payout" disabled={missing > 0}>
        {missing ? `נשארו ${missing} ידיים לסמן` : 'תשלום וסיבוב חדש'}
      </button>
    </>
  );
}
