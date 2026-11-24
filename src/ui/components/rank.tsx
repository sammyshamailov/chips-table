/** The standings: place, avatar, name and chips, highest first. Equal stacks share a place. */
import type { Standing } from '../../data/schema';
import { formatChips } from '../../i18n';
import { Avatar } from './avatar';

interface RankProps {
  list: Standing[];
  /** The players at the table now, for their current avatars (a player who left keeps the letter). */
  players: Record<string, { avatar?: unknown }>;
}

/** 1-based places: a stack equal to an earlier one shares its place. */
export function places(list: readonly Standing[]): number[] {
  return list.map(x => list.findIndex(y => y.stack === x.stack) + 1);
}

export function Rank({ list, players }: RankProps) {
  const top = list[0] ? list[0].stack : 0,
    place = places(list);
  return (
    <ol class="rank">
      {list.map((x, i) => (
        <li key={x.pid} class={x.stack === top ? 'win' : ''} style={`--d:${i}`}>
          <span class="pl num">{place[i]}</span>
          <Avatar who={players[x.pid] ? { ...x, avatar: players[x.pid].avatar } : x} />
          <b>{x.name}</b>
          <span class="num">{formatChips(x.stack)}</span>
        </li>
      ))}
    </ol>
  );
}
