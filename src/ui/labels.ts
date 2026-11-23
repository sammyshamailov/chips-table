/** Hebrew words shared by the components and the app. */
import { fmt } from './format';

/** How a Blackjack hand ended. */
export const RESULT_HE: Record<string, string> = {
  win: 'ניצחון',
  bj: "בלאק ג'ק",
  push: 'תיקו',
  lose: 'הפסד',
  surrender: 'כניעה',
};

/** The streets of a Hold'em hand (and between hands), as the table, the event line and the narration name them. */
export const STAGE_HE: Record<string, string> = {
  idle: 'בין ידיים',
  preflop: 'פרה-פלופ',
  flop: 'פלופ',
  turn: 'טרן',
  river: 'ריבר',
  showdown: 'שואודאון',
};

/** A player's last action, as a Hold'em seat shows it under the name ("השווה 10"); '' for none or an unknown one. */
export function actionText(a: { k: string; amt?: number } | null | undefined): string {
  if (!a) return '';
  const x = fmt(a.amt);
  const amt = a.amt || 0;
  const said: Record<string, string> = {
    fold: 'קיפל',
    check: "צ'ק",
    call: `השווה ${x}`,
    raise: `העלה ל-${x}`,
    bet: `הימר ${x}`,
    allin: `אול-אין ${x}`,
    blind: `בליינד ${x}`,
    won: `זכה ב-${x}`,
    refund: `הוחזר ${x}`,
    clear: 'ביטל הימור',
    double: 'דאבל דאון',
    split: 'ספליט',
    ins: 'ביטוח',
    surrender: 'כניעה',
    bjres: amt > 0 ? `הרוויח ${x}` : amt < 0 ? `הפסיד ${fmt(-amt)}` : 'תיקו',
  };
  return Object.prototype.hasOwnProperty.call(said, a.k) ? said[a.k] : '';
}
