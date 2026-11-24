/**
 * Your Blackjack controls at the bottom of the screen (the side panel in landscape): while bets are open, the chips in
 * your hand, the tray and the bet buttons; once the cards are dealt, each hand with double and split, then insurance
 * and surrender. The buttons' rules for being enabled are the view's own, as they always were (some edge cases differ
 * slightly from the domain's refusals, e.g. insurance on a bet of 1; the domain has the last word).
 */
import { MAX_HANDS } from '../../domain/blackjack/rules';
import type { BjHand } from '../../domain/types';
import { formatChips, t } from '../../i18n';
import { resultText } from '../labels';
import type { BlackjackDockProps } from '../tables/blackjack/select';
import { ChipTray, DockHead, PendingBox } from './parts';

function HandRow({ h, i, many, stack, full }: { h: BjHand; i: number; many: boolean; stack: number; full: boolean }) {
  if (h.result)
    return (
      <div class="status">{t('bjdock.handResult', { n: String(i + 1), amt: h.bet, result: resultText(h.result) })}</div>
    );
  return (
    <div class="handrow hr1">
      <div class="hl">
        <b>{many ? t('common.handNo', { n: String(i + 1) }) : t('bjdock.yourBet')}</b>
        <span class="amt num">
          <span class="mini"></span>
          {formatChips(h.bet) + (h.doubled ? ' · ' + t('common.doubled') : '')}
        </span>
      </div>
      <button class="btn small" data-a="bj" data-v={`double:${i}`} disabled={!!h.doubled || stack < h.bet}>
        {t('bjdock.double')}
      </button>
      <button class="btn small" data-a="bj" data-v={`split:${i}`} disabled={!!h.doubled || full || stack < h.bet}>
        {t('bjdock.split')}
      </button>
    </div>
  );
}

export function BlackjackDock(d: BlackjackDockProps) {
  const c = d.hands.length > 0;
  const head = <DockHead stack={d.stack}>{d.betting && <PendingBox pending={d.pending} />}</DockHead>;
  if (d.betting) {
    const curBet = c ? d.hands[0].bet : 0;
    return (
      <>
        {head}
        <ChipTray denoms={d.denoms} />
        <div class="acts">
          {c ? (
            <button class="btn ghost" data-a="bjclear">
              {t('bjdock.clearBet', { amt: curBet })}
            </button>
          ) : (
            <button class="btn ghost" data-a="setp" data-v={d.minBet}>
              {t('bjdock.min', { amt: d.minBet })}
            </button>
          )}
          <button class="btn primary" data-a="bjbet" disabled={!d.pending}>
            {c ? t('bjdock.addTo', { amt: curBet + d.pending }) : t('bjdock.bet', { amt: d.pending })}
          </button>
        </div>
      </>
    );
  }
  if (!c)
    return (
      <>
        {head}
        <div class="status">{t('bjdock.noBet')}</div>
      </>
    );
  const first = d.hands[0],
    one = d.hands.length === 1 && !first.doubled && !first.result,
    half = Math.floor(first.bet / 2);
  return (
    <>
      {head}
      {d.hands.map((h, i) => (
        <HandRow h={h} i={i} many={d.hands.length > 1} stack={d.realStack} full={d.hands.length >= MAX_HANDS} />
      ))}
      <div class="acts3">
        <button
          class="btn small ghost"
          data-a="bj"
          data-v="ins:0"
          disabled={!!(d.insurance || d.hands.length > 1 || first.result || d.realStack < half)}
        >
          {d.insurance ? t('bjdock.insured', { amt: d.insurance }) : t('bjdock.insure', { amt: half })}
        </button>
        <button class="btn small ghost" data-a="bj" data-v="surrender:0" disabled={!one}>
          {t('bjdock.surrender')}
        </button>
      </div>
    </>
  );
}
