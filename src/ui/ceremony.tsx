/**
 * The end-of-game ceremony as drawn in `#fin`, over everything: the dim with a spotlight on the winner's seat, then
 * the winner's card (crown, picture, name, the count-up, and the standings that slide in). The timeline that steps
 * through it is `createCeremony()` (src/app/ceremony.ts); it renders this with Preact outside the screens' render.
 */
import type { RefObject } from 'preact';
import type { Standing } from '../data/schema';
import { t } from '../i18n';
import { Avatar } from './components/avatar';
import { Crown } from './components/crown';
import { Rank } from './components/rank';
import type { AvatarOwner } from './session';

export interface CeremonyCard {
  /** The winners (more than one on a tie), each with their current picture. */
  winners: AvatarOwner[];
  names: string;
  list: Standing[];
  players: Record<string, { avatar?: unknown }>;
  /** The standings and the buttons have slid in. */
  rest: boolean;
}

export interface CeremonyProps {
  /** The spotlight's centre (the winner's seat on the screen). */
  x: number;
  y: number;
  /** The reveal: the whole screen lit gold, the card up. */
  card: CeremonyCard | null;
  /** Where the raining chips go (the timeline adds them; Preact never touches its children). */
  rain: RefObject<HTMLDivElement | null>;
}

export function Ceremony({ x, y, card, rain }: CeremonyProps) {
  return (
    <>
      <div class={card ? 'fin-dim lit' : 'fin-dim'} style={`--x:${x}px;--y:${y}px`} />
      {card && <WinnerCard {...card} />}
      <div ref={rain} style="display:contents" />
    </>
  );
}

function WinnerCard({ winners, names, list, players, rest }: CeremonyCard) {
  return (
    <div class="fin-card" role="dialog" aria-modal="true" aria-labelledby="fin-t">
      <Crown />
      <div class="fin-avs">
        {winners.map(w => (
          <Avatar key={w.pid} who={w} class="fin-av" />
        ))}
      </div>
      <div class="fin-t">{winners.length > 1 ? t('cer.tie') : t('cer.winner')}</div>
      <h2 id="fin-t" class="fin-name">
        {names}
      </h2>
      <div class="fin-amt">
        <span class="num" data-count="">
          0
        </span>
        {' ' + t('common.chips')}
      </div>
      <div class={rest ? 'fin-rest on' : 'fin-rest'}>
        {list.length > 1 && <Rank list={list} players={players} />}
        <div class="btns">
          <button class="btn primary" data-a="finclose">
            {t('cer.toTable')}
          </button>
          <button class="btn ghost" data-a="home">
            {t('common.home')}
          </button>
        </div>
      </div>
    </div>
  );
}
