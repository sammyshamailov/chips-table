/**
 * Your Hold'em controls at the bottom of the screen (the side panel in landscape): your chips and the chips in your
 * hand, then either why you can't act now, or the tray, the presets, fold and the main button (check, call, bet,
 * raise or all-in, worked out from the chips in your hand; disabled while they are short of a call or a raise).
 */
import type { HoldemDockProps } from '../tables/holdem/select';
import { fmt } from '../format';
import { ChipTray, DockHead, PendingBox } from './parts';

export function HoldemDock(d: HoldemDockProps) {
  const head = (
    <DockHead stack={d.stack}>
      <PendingBox pending={d.pending} />
    </DockHead>
  );
  if (!d.go)
    return (
      <>
        {head}
        <div class="status">{d.status}</div>
      </>
    );
  return (
    <>
      {head}
      <ChipTray denoms={d.denoms} />
      <div class="presets">
        {d.presets.map(([t, v]) => (
          <button data-a="setp" data-v={v}>
            {t + ' '}
            <span class="num">{fmt(v)}</span>
          </button>
        ))}
      </div>
      <div class="acts">
        <button class="btn danger" data-a="fold">
          קיפול
        </button>
        <button class="btn primary" data-a="hgo" data-v={d.go.amount} disabled={d.go.disabled}>
          {d.go.label}
        </button>
      </div>
    </>
  );
}
