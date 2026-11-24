/** Hold'em: the dealer picks the winner(s); the preview shows what each gets, side pots worked out by contribution. */
import { SheetHead } from '../components/sheet-head';
import { Option } from '../components/option';
import { formatChips, t } from '../../i18n';
import type { Session } from '../session';

export interface AwardProps {
  /** Players still in the hand with chips in the pot. */
  cands: { pid: string; name: string; folded: boolean; allIn: boolean; put: number }[];
  sel: string[];
  /** What the chosen winners would get, and what would be left in a side pot. */
  pays: { name: string; amt: number }[];
  left: number;
}

export function awardProps(s: Session): AwardProps {
  const h = s.holdem(),
    sel = s.state.sel,
    prev = s.award(sel);
  return {
    cands: h.list
      .filter(p => h.inHand(p) && h.com(p) > h.lvl)
      .map(p => ({ pid: p.pid, name: p.name || '', folded: !!p.folded, allIn: !!p.allIn, put: h.com(p) })),
    sel,
    pays: Object.entries(prev.pay)
      .filter(([, a]) => a > 0)
      .map(([id, amt]) => ({ name: s.nameOf(id), amt })),
    left: prev.left,
  };
}

export function AwardSheet({ cands, sel, pays, left }: AwardProps) {
  return (
    <>
      <SheetHead title={t('hhost.award')} />
      <span class="muted">{t('award.help')}</span>
      <div class="stack" style="gap:8px">
        {cands.map(p => (
          <Option
            key={p.pid}
            a="pick"
            v={p.pid}
            pressed={sel.includes(p.pid)}
            end={<span class="num muted">{t('award.put', { amt: p.put })}</span>}
          >
            <b>{p.name}</b> <span class="muted">{p.folded ? t('award.folded') : p.allIn ? t('award.allin') : ''}</span>
          </Option>
        ))}
      </div>
      {sel.length > 0 && (
        <div class="card" style="padding:12px;gap:4px">
          {pays.map(x => (
            <div class="payline">
              <span>{x.name}</span>
              <b class="num">{'+' + formatChips(x.amt)}</b>
            </div>
          ))}
          {left > 0 && (
            <div class="payline muted">
              <span>{t('award.side')}</span>
              <span class="num">{formatChips(left)}</span>
            </div>
          )}
        </div>
      )}
      <button class="btn primary wide" data-a="award" disabled={!sel.length}>
        {t('award.pay')}
      </button>
    </>
  );
}
