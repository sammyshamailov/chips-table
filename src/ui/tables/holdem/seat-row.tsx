/**
 * A row in the Hold'em list of players: avatar, name and tags, chips and last action, and on the left what the player
 * has bet on this street. The dealer who runs the table without playing has a row of their own at the top.
 */
import { Avatar } from '../../components/avatar';
import { fmt } from '../../format';
import type { AvatarOwner } from '../../session';

/** A tag after the name: `btn-d` (the button), `fold`, `allin`, or plain (blinds, break, waiting). */
export interface SeatTag {
  cls?: 'btn-d' | 'fold' | 'allin';
  text: string;
}

/** A player as the Hold'em table shows them (made by `holdemTableProps`). */
export interface HoldemSeatView {
  pid: string;
  name: string;
  who: AvatarOwner;
  /** This phone's player. */
  mine: boolean;
  /** The dealer. */
  host: boolean;
  /** Folded in this hand (the row is dimmed). */
  out: boolean;
  tags: SeatTag[];
  /** The chips shown on the row (the old count while chips fly to it). */
  stack: number;
  /** What the player has bet on this street (0: nothing shown). */
  streetBet: number;
  /** The last action under the name ("השווה 10"), or ''. */
  action: string;
  /** Single-device mode: a button to play as this player. */
  claim: boolean;
}

function Tag({ tag }: { tag: SeatTag }) {
  return <span class={tag.cls ? 'tag ' + tag.cls : 'tag'}>{tag.text}</span>;
}

export function SeatRow({ seat: p }: { seat: HoldemSeatView }) {
  return (
    <div class={'seat' + (p.mine ? ' me' : '') + (p.out ? ' out' : '')}>
      <Avatar who={p.who} k={'seat:' + p.pid} />
      <div class="who">
        <div class="nm">
          <b>{p.name}</b>
          {p.mine && <span class="tag">את/ה</span>}
          {p.host && <span class="tag host">דילר</span>}
          {p.tags.map(t => (
            <Tag tag={t} />
          ))}
        </div>
        <div class="sub">
          <span class="num">{fmt(p.stack) + " צ'יפים"}</span>
          {p.action && <span>{p.action}</span>}
        </div>
      </div>
      <div style="display:grid;gap:6px;justify-items:end">
        {p.streetBet ? (
          <div class="amt num">
            <span class="mini"></span>
            {fmt(p.streetBet)}
          </div>
        ) : null}
        {p.claim && (
          <button class="btn small ghost" data-a="claim" data-v={p.pid}>
            שחק בתור
          </button>
        )}
      </div>
    </div>
  );
}

/** The dealer's row when the dealer doesn't play (always a letter: the dealer's picture isn't on the room). */
export interface DealerRowView {
  pid: string;
  name: string;
  /** The name the letter in the circle is taken from. */
  letterName: string;
  mine: boolean;
}

export function DealerRow({ d }: { d: DealerRowView }) {
  return (
    <div class={'seat' + (d.mine ? ' me' : '')}>
      <Avatar who={{ pid: d.pid, name: d.letterName }} />
      <div class="who">
        <div class="nm">
          <b>{d.name}</b>
          {d.mine && <span class="tag">את/ה</span>}
          <span class="tag host">דילר</span>
        </div>
        <div class="sub">
          <span>מנהל את השולחן</span>
        </div>
      </div>
      <div></div>
    </div>
  );
}
