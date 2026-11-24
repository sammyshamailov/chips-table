/**
 * The turn-the-phone prompt, in `#rot` over the room: shown only inside a table, on a phone held upright, until it is
 * dismissed. Rendered with Preact on every render while it shows, so its animation runs on instead of restarting.
 */
import { render } from 'preact';

/** The phone can go full screen and lock itself in landscape (Android). */
export function canLock(): boolean {
  const o = window.screen && screen.orientation;
  return !!(o && typeof o.lock === 'function' && typeof document.documentElement.requestFullscreen === 'function');
}

/** Full screen, then locked in landscape. Rejects where the phone doesn't allow it. */
export async function lockLandscape(): Promise<void> {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  await screen.orientation.lock('landscape');
}

/** Lets the phone turn freely again and leaves full screen. */
export function unlockTurn(): void {
  try {
    screen.orientation.unlock();
  } catch {
    // never locked
  }
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch {
    // not in full screen
  }
}

export function RotatePrompt({ lock }: { lock: boolean }) {
  return (
    <div class="rot-card" role="dialog" aria-modal="true" aria-labelledby="rot-t">
      <div class="rot-anim" aria-hidden="true">
        <svg class="rot-arrow" viewBox="0 0 120 120">
          <path d="M96 34 A46 46 0 0 0 30 30" />
          <path d="M38 22 L28 31 L41 36" />
        </svg>
        <div class="phone">
          <div class="scr">
            <div class="scr-in">
              <i class="mf" />
              <i class="mc a" />
              <i class="mc b" />
              <i class="mc c" />
            </div>
          </div>
        </div>
      </div>
      <h2 id="rot-t">סובבו את הטלפון</h2>
      <p class="muted">לרוחב יש לשולחן הרבה יותר מקום: כל השחקנים, הצ'יפים והכפתורים במסך אחד.</p>
      {lock && (
        <button class="btn primary wide" data-a="rotlock">
          מסך מלא לרוחב
        </button>
      )}
      <button class="btn ghost wide" data-a="rotoff">
        להמשיך לאורך
      </button>
    </div>
  );
}

/** Shows the prompt in `el` (kept while it shows) or hides and empties it. */
export function paintRotate(el: HTMLElement, show: boolean): void {
  if (!show) {
    if (!el.hidden) {
      render(null, el);
      el.hidden = true;
      el.innerHTML = '';
    }
    return;
  }
  render(<RotatePrompt lock={canLock()} />, el);
  el.hidden = false;
}
