/** Words shared by the components and the app, in the phone's language. */
import { formatChips, hasKey, t } from '../i18n';

/** How a Blackjack hand ended (`win`, `bj`, `push`, `lose`, `surrender`); '' for an unknown result. */
export function resultText(r: string): string {
  const k = 'result.' + r;
  return hasKey(k) ? t(k) : '';
}

/** A street of a Hold'em hand (or `idle`, between hands), as the table names it; '' for an unknown one. */
export function stageText(stage: string): string {
  const k = 'stage.' + stage;
  return hasKey(k) ? t(k) : '';
}

/** A player's last action, as a Hold'em seat shows it under the name ("Called 10"); '' for none or an unknown one. */
export function actionText(a: { k: string; amt?: number } | null | undefined): string {
  if (!a) return '';
  const amt = a.amt || 0,
    p = { amt };
  if (a.k === 'bjres') return amt > 0 ? t('act.bjWon', p) : amt < 0 ? t('act.bjLost', { amt: -amt }) : t('common.push');
  const k = 'act.' + a.k;
  return /^\w+$/.test(a.k) && hasKey(k) && k !== 'act.bjWon' && k !== 'act.bjLost' ? t(k, p) : '';
}

/** A signed amount: `+150`, `−150` (a real minus sign), and 0 as `+0`. */
export function signed(n: number): string {
  return (n >= 0 ? '+' : '−') + formatChips(Math.abs(n));
}
