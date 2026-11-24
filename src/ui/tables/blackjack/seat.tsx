/**
 * One player at the Blackjack table: the betting circles (one per hand), the insurance spot and the seat (avatar,
 * name, chips, the last round's result). Positions are % of the table box (`geometry.ts`); `data-k` keys are what the
 * effects (src/fx/) fly chips to and from.
 */
import { handHalves, handStack } from '../../../domain/chips';
import type { ShownHand } from '../../../fx/layer';
import { Avatar } from '../../components/avatar';
import { formatChips, t } from '../../../i18n';
import type { AvatarOwner } from '../../session';
import { ChipStack } from '../chip-stack';
import { GEO, ept, spotsAt } from './geometry';

/** A seat as the table shows it (made by `blackjackTableProps`). */
export interface BjSeatView {
  pid: string;
  name: string;
  who: AvatarOwner;
  /** This phone's player. */
  mine: boolean;
  /** Out of this round: the cards are dealt and this player has no bet. */
  out: boolean;
  /** Tapping the seat: play as this player (single-device mode), or open your own avatar sheet. */
  tap: 'claim' | 'avatar' | null;
  /** The chips shown on the seat (the old count while chips fly to it). */
  stack: number;
  /** The hands on the felt (what an override still shows while chips fly). None: one empty circle. */
  hands: ShownHand[];
  /** The insurance on the felt. */
  ins: number;
  /** Your chips in hand that have landed on your circle (betting, your own seat only); null elsewhere. */
  ghost: number[] | null;
  /** The last round's result over the seat (+ won, − lost, 0 a push), or null. */
  result: number | null;
  /** Bets are open (your empty circle glows). */
  betting: boolean;
}

const pct = (n: number) => n.toFixed(2) + '%';

interface BetCircleProps {
  pid: string;
  j: number;
  /** How many hands the player has (a split shows smaller circles side by side). */
  m: number;
  x: number;
  y: number;
  size: number;
  hand: ShownHand | null;
  mine: boolean;
  ghost: number[] | null;
  betting: boolean;
}

/** A betting circle: the hand's chips (two stacks when doubled), the label under it, and your chips in hand. */
export function BetCircle({ pid, j, m, x, y, size, hand: h, mine, ghost, betting }: BetCircleProps) {
  const paid = !!(h && h.paid),
    show = !!(h && !h._hide && !paid),
    glow = mine && j === 0 && betting && !show && !!ghost && !ghost.length;
  const cls = 'spot' + (m > 1 ? ' sm' : '') + (mine ? ' mine' : '') + (show ? ' has' : '') + (glow ? ' glow' : '');
  const style = `left:${pct(x)};top:${pct(y)};width:${pct(size)};--chip:calc(var(--u)*${(size * 0.53).toFixed(2)})`;
  return (
    <div class={cls} data-k={`spot:${pid}:${j}`} style={style}>
      {show &&
        h &&
        (h.doubled ? (
          <div class="duo">
            {handHalves(h).map(half => (
              <ChipStack chips={half} />
            ))}
          </div>
        ) : (
          <ChipStack chips={handStack(h)} />
        ))}
      {j === 0 && ghost && (
        <div class="ghost" data-k="ghost">
          {ghost.length ? <ChipStack chips={ghost} /> : null}
        </div>
      )}
      {paid && h && !h._hide ? (
        <span class="bl bjl">{t('bjt.bjPaid')}</span>
      ) : show && h ? (
        <span class="bl num">
          {formatChips(h.bet) + (h.doubled ? (m > 1 ? '×2' : ' · ×2') : '') + (h.result === 'surrender' ? ' · ½' : '')}
        </span>
      ) : null}
    </div>
  );
}

function SeatResult({ amt }: { amt: number }) {
  return (
    <span class={`rb ${amt > 0 ? 'w' : amt < 0 ? 'l' : 'p'} num`}>
      {amt > 0 ? '+' + formatChips(amt) : amt < 0 ? '−' + formatChips(-amt) : t('common.push')}
    </span>
  );
}

/** The seat's attributes for tapping it. */
function tapAttrs(s: BjSeatView) {
  if (s.tap === 'claim')
    return { 'data-a': 'claim', 'data-v': s.pid, role: 'button' as const, title: t('bjt.playAs', { name: s.name }) };
  if (s.tap === 'avatar')
    return { 'data-a': 'sheet', 'data-v': 'avatar', role: 'button' as const, title: t('bjt.changePhoto') };
  return {};
}

/** A player's circles, insurance spot and seat, at angle `phi` with circles `base` wide. */
export function BjSeat({ seat: s, phi, base }: { seat: BjSeatView; phi: number; base: number }) {
  const [sx, sy] = ept(phi, GEO.seat),
    [ix, iy] = ept(phi * 0.78, GEO.ins);
  const hands: (ShownHand | null)[] = s.hands.length ? s.hands : [null],
    spots = spotsAt(phi, base, hands.length);
  return (
    <>
      {hands.map((h, j) => (
        <BetCircle
          pid={s.pid}
          j={j}
          m={hands.length}
          x={spots.x[j]}
          y={spots.y}
          size={spots.size}
          hand={h}
          mine={s.mine}
          ghost={j === 0 ? s.ghost : null}
          betting={s.betting}
        />
      ))}
      <div class="insk" data-k={`ins:${s.pid}`} style={`left:${pct(ix)};top:${pct(iy)}`}>
        {s.ins ? (
          <>
            <ChipStack chips={s.ins} />
            <span class="bl num">{t('bjt.ins', { amt: s.ins })}</span>
          </>
        ) : null}
      </div>
      <div
        class={'st' + (s.mine ? ' me' : '') + (s.out ? ' out' : '')}
        {...tapAttrs(s)}
        style={`left:${pct(sx)};top:${pct(sy)}`}
      >
        {s.result != null && <SeatResult amt={s.result} />}
        <Avatar who={s.who} k={'seat:' + s.pid} />
        <b class="sn">{s.name}</b>
        <span class="ss num">{formatChips(s.stack)}</span>
      </div>
    </>
  );
}
