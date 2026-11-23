/**
 * What the Blackjack table, dock and dealer controls show, read from the session. These selectors are the only code
 * of the Blackjack views that reads the session; the components get plain props.
 */
import type { Room } from '../../../data/schema';
import { stake } from '../../../domain/blackjack/rules';
import type { BjHand } from '../../../domain/types';
import type { SeatView, Session } from '../../session';
import type { BjSeatView } from './seat';
import type { BlackjackTableProps } from './table';

/** The hands a player has on the felt: this round's, or last round's while any of them is still being paid out. */
function onFelt(p: SeatView, r: Room): boolean {
  return p.bjRound === r.roundId || (p.bjRound === r.roundId - 1 && p.hands.some(h => !h.result));
}

/** Last round's result over the seat (what the payout gave or took), once the chips have landed. */
function seatResult(s: Session, p: SeatView, r: Room): number | null {
  const o = s.fx.ov(p.pid),
    a = p.lastAction;
  if ((o && o.hideRes) || s.bjCurrent(p) || p.bjRound !== r.roundId - 1 || !a) return null;
  return a.k === 'bjres' || a.k === 'bjpay' ? a.amt || 0 : null;
}

export function seatView(s: Session, p: SeatView): BjSeatView {
  const S = s.state,
    r = S.room as Room,
    o = s.fx.ov(p.pid),
    show = onFelt(p, r),
    mine = p.pid === S.myId,
    betting = r.phase === 'betting';
  return {
    pid: p.pid,
    name: p.name,
    who: { pid: p.pid, name: p.name, avatar: p.avatar },
    mine,
    out: r.phase === 'playing' && !s.bjCurrent(p),
    tap: S.mode === 'local' && !mine ? 'claim' : mine ? 'avatar' : null,
    stack: s.fx.shownStack(p),
    hands: o && o.hands ? o.hands : show ? p.hands : [],
    ins: o && o.ins != null ? o.ins : show ? p.insurance || 0 : 0,
    ghost: mine && betting ? s.fx.ghost() : null,
    result: seatResult(s, p, r),
    betting,
  };
}

export function blackjackTableProps(s: Session): BlackjackTableProps {
  const r = s.state.room as Room,
    list = s.players(),
    bettors = list.filter(p => s.bjCurrent(p));
  return {
    hostName: r.hostName || 'הדילר',
    minBet: r.minBet,
    maxBet: r.maxBet,
    roundId: r.roundId,
    house: r.house || 0,
    betting: r.phase === 'betting',
    closed: s.looksClosed(),
    signDrop: s.fx.signDrop(),
    denoms: s.denoms(),
    seats: list.map(p => seatView(s, p)),
    bettors: bettors.length,
    onFelt: bettors.reduce((a, p) => a + stake(p) + (p.insurance || 0), 0),
  };
}

/** Your part of the round, for the dock. */
export interface BlackjackDockProps {
  /** The chips shown as yours (the old count while chips fly to you). */
  stack: number;
  /** Your chips as stored (what the double, split and insurance buttons check against). */
  realStack: number;
  betting: boolean;
  pending: number;
  denoms: number[];
  minBet: number;
  /** Your hands this round; empty when you have no bet in it. */
  hands: BjHand[];
  insurance: number;
}

export function blackjackDockProps(s: Session): BlackjackDockProps {
  const r = s.state.room as Room,
    m = s.me() as SeatView;
  return {
    stack: s.fx.shownStack(m),
    realStack: m.stack,
    betting: r.phase === 'betting',
    pending: s.state.pending,
    denoms: s.denoms(),
    minBet: r.minBet,
    hands: s.bjCurrent(m) ? m.hands : [],
    insurance: m.insurance,
  };
}

/** The dealer's controls. */
export interface BlackjackHostProps {
  betting: boolean;
  /** How many players have a bet this round. */
  bettors: number;
  /** Someone's blackjack can be paid now. */
  canPayNow: boolean;
}

export function blackjackHostProps(s: Session): BlackjackHostProps {
  const r = s.state.room as Room,
    list = s.players();
  return {
    betting: r.phase === 'betting',
    bettors: list.filter(p => s.bjCurrent(p)).length,
    canPayNow: list.some(p => s.bjEligible(p)),
  };
}
