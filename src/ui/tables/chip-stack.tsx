/** A stack of chips on the felt, seen from the side (the same markup as `stackHTML`, which the chips in the air use). */
import { chipsOf } from '../../domain/chips';
import { chipStyle, stackColumns } from '../chips-html';

export interface ChipStackProps {
  /** The exact chips, or an amount (made up from the biggest chips). */
  chips: number[] | number | null | undefined;
}

export function ChipStack({ chips }: ChipStackProps) {
  const c = Array.isArray(chips) ? chips : chipsOf(chips);
  if (!c.length) return null;
  return (
    <div class="stk">
      {stackColumns(c).map(col => (
        <div class="col" style={`--n:${col.length}`}>
          {col.map((d, i) => (
            <i class="cd" style={`${chipStyle(d)};--i:${i}`}></i>
          ))}
        </div>
      ))}
    </div>
  );
}
