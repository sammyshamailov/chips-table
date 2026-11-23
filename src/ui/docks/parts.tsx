/** Pieces every dock has: your chip count, the chips in your hand, and the tray of chips to pick from. */
import type { ComponentChildren } from 'preact';
import { chipLabel } from '../../domain/chips';
import { chipStyle } from '../chips-html';
import { fmt } from '../format';

/** Your chips, and next to them whatever the game puts there (the chips in your hand). */
export function DockHead({ stack, children }: { stack: number; children?: ComponentChildren }) {
  return (
    <div class="dock-head">
      <div class="mystack">
        <span class="big num" data-k="mystack">
          {fmt(stack)}
        </span>
        <span class="muted">הצ'יפים שלך</span>
      </div>
      {children}
    </div>
  );
}

/** The chips in your hand, with × to put them back. Chips from the tray fly here (`pend`) when your spot is hidden. */
export function PendingBox({ pending }: { pending: number }) {
  return (
    <div class="pending">
      <button data-a="clearp" aria-label="ניקוי">
        ×
      </button>
      <span class="v num" data-k="pend">
        {fmt(pending)}
      </span>
      <span class="muted">להוסיף</span>
    </div>
  );
}

/** One button per chip value; a tap adds that chip to your hand (`add`). */
export function ChipTray({ denoms }: { denoms: number[] }) {
  return (
    <div class="tray">
      {denoms.map(d => (
        <button class="chip" style={chipStyle(d)} data-a="add" data-v={d} aria-label={'הוספת ' + d}>
          <span>{chipLabel(d)}</span>
        </button>
      ))}
    </div>
  );
}
