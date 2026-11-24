/**
 * The phone itself: a short vibration on a tap that does something, keeping the screen on at a table, and the
 * browser's "install the app" prompt.
 */
import { t } from '../i18n';

/** A short vibration, where the phone can. */
export function buzz(): void {
  try {
    if (navigator.vibrate) navigator.vibrate(12);
  } catch {
    // not allowed here
  }
}

/**
 * Keeps the screen on while at a table: asked for when entering one and again when the app comes back to the screen
 * (the browser releases it when the page is hidden). `start()` listens for that.
 */
export function createWakeLock(inTable: () => boolean) {
  let lock: WakeLockSentinel | null = null;
  async function wake(): Promise<void> {
    try {
      if ('wakeLock' in navigator && !lock) {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => (lock = null));
      }
    } catch {
      // refused (battery saver, not visible): the screen may go off
    }
  }
  return {
    wake,
    start(): void {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && inTable()) wake();
      });
    },
  };
}

/** Chrome's install prompt, kept for the home screen's "install" button (not in the DOM types). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

/** The install prompt: `available()` once the browser offers it, `install()` shows it. */
export function createInstallPrompt(d: { onHome(): boolean; render(): void; toast(text: string): void }) {
  let evt: InstallPromptEvent | null = null;
  return {
    available: () => !!evt,
    async install(): Promise<void> {
      if (!evt) return;
      evt.prompt();
      try {
        await evt.userChoice;
      } catch {
        // dismissed
      }
      evt = null;
      d.render();
    },
    start(): void {
      window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        evt = e as InstallPromptEvent;
        if (d.onHome()) d.render();
      });
      window.addEventListener('appinstalled', () => {
        evt = null;
        d.toast(t('toast.installed'));
        if (d.onHome()) d.render();
      });
    },
  };
}
