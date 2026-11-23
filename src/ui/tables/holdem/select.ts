/**
 * What the Hold'em table, dock and dealer controls show, read from the session. These selectors are the only code of
 * the Hold'em views that reads the session; the components get plain props.
 */
import type { Room } from '../../../data/schema';
import { STAGES, canAct, type HoldemState } from '../../../domain/holdem/rules';
import { fmt } from '../../format';
import { actionText } from '../../labels';
import type { SeatView, Session } from '../../session';
import type { HoldemSeatView, SeatTag } from './seat-row';
import type { DealerRowView, HoldemTableProps } from './table';

/** How many of the five board cards are turned over at each street (none between hands). */
const BOARD_CARDS = [0, 3, 4, 5, 5];

/** The tags after a player's name: button, blinds, folded, all-in, on a break or waiting for the next hand. */
export function seatTags(h: HoldemState, p: SeatView): SeatTag[] {
  const r = h.r,
    inH = h.inHand(p),
    tags: SeatTag[] = [];
  if (inH && r.buttonPid === p.pid) tags.push({ cls: 'btn-d', text: 'D' });
  if (inH && r.stage === 'preflop' && r.sbPid === p.pid) tags.push({ text: 'SB' });
  if (inH && r.stage === 'preflop' && r.bbPid === p.pid) tags.push({ text: 'BB' });
  if (inH && p.folded) tags.push({ cls: 'fold', text: 'קיפל' });
  if (inH && p.allIn && !p.folded) tags.push({ cls: 'allin', text: 'ALL-IN' });
  if (p.sittingOut) tags.push({ text: 'בהפסקה' });
  else if (!inH && r.stage !== 'idle') tags.push({ text: 'ממתין ליד הבאה' });
  return tags;
}

export function holdemSeatView(s: Session, h: HoldemState, p: SeatView): HoldemSeatView {
  const S = s.state,
    inH = h.inHand(p),
    mine = p.pid === S.myId;
  return {
    pid: p.pid,
    name: p.name,
    who: { pid: p.pid, name: p.name, avatar: p.avatar },
    mine,
    host: h.r.hostId === p.pid,
    out: inH && p.folded,
    tags: seatTags(h, p),
    stack: s.fx.shownStack(p),
    streetBet: h.st(p),
    // What they did last: during the hand, and the win after it.
    action: inH || p.lastAction?.k === 'won' ? actionText(p.lastAction) : '',
    claim: S.mode === 'local' && !mine,
  };
}

/** The dealer's own row, when the dealer runs the table without playing. */
function dealerRow(s: Session, r: Room): DealerRowView | null {
  if (s.state.players[r.hostId]) return null;
  return { pid: r.hostId, name: r.hostName || 'הדילר', letterName: r.hostName || 'ד', mine: r.hostId === s.state.myId };
}

export function holdemTableProps(s: Session): HoldemTableProps {
  const h = s.holdem(),
    r = s.state.room as Room,
    si = STAGES.indexOf(r.stage as (typeof STAGES)[number]);
  return {
    closed: s.looksClosed(),
    signDrop: s.fx.signDrop(),
    stage: r.stage,
    handId: r.handId,
    sb: r.sb,
    bb: r.bb,
    cards: si < 0 ? 0 : BOARD_CARDS[si],
    pot: h.pot,
    streetBet: h.maxSt,
    dealer: dealerRow(s, r),
    seats: h.list.map(p => holdemSeatView(s, h, p as SeatView)),
  };
}

/** The main button: its label, whether it is enabled, and what it puts in (`hgo`). */
export interface HoldemGo {
  label: string;
  disabled: boolean;
  amount: number;
}

/**
 * What the main button does with `pending` chips in hand: check, call, bet, raise or all-in, or (disabled) what is
 * missing; and the presets (call, minimum, half the pot, the pot, all-in), as amounts to put in.
 */
export function holdemChoices(
  h: HoldemState,
  m: SeatView,
  pending: number,
): { go: HoldemGo; presets: [string, number][] } {
  const mySt = h.st(m),
    toCall = Math.max(0, h.maxSt - mySt),
    stack = m.stack || 0;
  const add = Math.min(pending, stack),
    newSt = mySt + add;
  let label,
    disabled = false;
  if (add === 0) label = toCall === 0 ? "צ'ק" : toCall >= stack ? `אול-אין ${fmt(stack)}` : `השוואה ${fmt(toCall)}`;
  else if (add === stack) label = `אול-אין ${fmt(stack)}`;
  else if (newSt < h.maxSt) {
    label = `חסר ${fmt(h.maxSt - newSt)} להשוואה`;
    disabled = true;
  } else if (newSt === h.maxSt) label = `השוואה ${fmt(add)}`;
  else if (newSt < h.minTo) {
    label = `העלאה מינימלית ל-${fmt(h.minTo)}`;
    disabled = true;
  } else label = h.maxSt === 0 ? `הימור ${fmt(add)}` : `העלאה ל-${fmt(newSt)}`;
  const amount = add === 0 ? Math.min(toCall, stack) : add;
  const toAdd = (to: number) => Math.max(0, Math.min(stack, to - mySt));
  const potTo = h.maxSt + h.pot + toCall,
    halfTo = h.maxSt + Math.round((h.pot + toCall) / 2);
  const presets: [string, number][] = [];
  if (toCall) presets.push(['השוואה', Math.min(toCall, stack)]);
  presets.push(
    ['מינימום', toAdd(h.minTo)],
    ['½ קופה', toAdd(Math.max(h.minTo, halfTo))],
    ['קופה', toAdd(Math.max(h.minTo, potTo))],
    ['אול-אין', stack],
  );
  return { go: { label, disabled, amount }, presets };
}

/** Your part of the hand, for the dock. */
export interface HoldemDockProps {
  /** The chips shown as yours (the old count while chips fly to you). */
  stack: number;
  pending: number;
  denoms: number[];
  /** Why you can't act now, or null when it is your move. */
  status: string | null;
  /** The main button and the presets, when you can act. */
  go: HoldemGo | null;
  presets: [string, number][];
}

/** Why the player can't act now (a line instead of the controls), or null. */
export function holdemStatus(h: HoldemState, m: SeatView): string | null {
  if (m.sittingOut) return 'אתם בהפסקה. אפשר לחזור מתפריט השחקנים.';
  if (!h.inHand(m)) return h.r.stage === 'idle' ? 'מחכים ליד הבאה' : 'תצטרפו ביד הבאה';
  if (m.folded) return 'קיפלתם ביד הזו';
  if (m.allIn) return 'אתם באול-אין. בהצלחה.';
  if (!canAct(h, m)) return 'שואודאון. מחכים לדילר שיחלק את הקופה.';
  return null;
}

export function holdemDockProps(s: Session): HoldemDockProps {
  const h = s.holdem(),
    m = s.me() as SeatView,
    status = holdemStatus(h, m),
    base = { stack: s.fx.shownStack(m), pending: s.state.pending, denoms: s.denoms(), status };
  if (status) return { ...base, go: null, presets: [] };
  return { ...base, ...holdemChoices(h, m, s.state.pending) };
}

/** The dealer's controls. */
export interface HoldemHostProps {
  stage: string;
  pot: number;
  /** Everyone else folded: this player takes the pot with one tap. */
  solo: { pid: string; name: string } | null;
}

export function holdemHostProps(s: Session): HoldemHostProps {
  const h = s.holdem(),
    one = h.live.length === 1 && h.pot > 0 ? h.live[0] : null;
  return { stage: h.r.stage || '', pot: h.pot, solo: one ? { pid: one.pid, name: one.name || '' } : null };
}
