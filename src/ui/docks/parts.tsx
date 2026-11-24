/** Pieces every dock has: your chip count, the chips in your hand, and the tray of chips to pick from. */
import type { ComponentChildren } from 'preact';
import { chipLabel } from '../../domain/chips';
import { chipStyle } from '../chips-html';
import { formatChips, t } from '../../i18n';

/** Your chips, and next to them whatever the game puts there (the chips in your hand). */
export function DockHead({ stack, children }: { stack: number; children?: ComponentChildren }) {
  return (
    <div class="dock-head">
      <div class="mystack">
        <span class="big num" data-k="mystack">
          {formatChips(stack)}
        </span>
        <span class="muted">{t('dock.yourChips')}</span>
      </div>
      {children}
    </div>
  );
}

/** The chips in your hand, with × to put them back. Chips from the tray fly here (`pend`) when your spot is hidden. */
export function PendingBox({ pending }: { pending: number }) {
  return (
    <div class="pending">
      <button data-a="clearp" aria-label={t('dock.clear')}>
        ×
      </button>
      <span class="v num" data-k="pend">
        {formatChips(pending)}
      </span>
      <span class="muted">{t('dock.toAdd')}</span>
    </div>
  );
}

/** One button per chip value; a tap adds that chip to your hand (`add`). */
export function ChipTray({ denoms }: { denoms: number[] }) {
  return (
    <div class="tray">
      {denoms.map(d => (
        <button
          class="chip"
          style={chipStyle(d)}
          data-a="add"
          data-v={d}
          aria-label={t('dock.addChip', { amt: String(d) })}
        >
          <span>{chipLabel(d)}</span>
        </button>
      ))}
    </div>
  );
}
