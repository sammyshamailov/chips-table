/**
 * Staying up to date. A phone that keeps the app open (or resumes it from the background) would otherwise keep
 * running old code. Each deploy writes a new `APP_BUILD` into config.js; when the live one differs, the app reloads
 * as soon as the player is idle, or shows the "new version" button until then.
 */

/** How often the live config.js is checked while the app is open. */
const CHECK_EVERY_MS = 3 * 60 * 1000;
/** The first check after start-up. */
const FIRST_CHECK_MS = 8000;
/** How long the "updating" toast shows before the reload. */
const RELOAD_AFTER_MS = 900;

export interface UpdaterDeps {
  /** `APP_BUILD` from the config.js this page loaded, or null (a local build: no checks). */
  build: string | null;
  render(): void;
  toast(text: string): void;
  /** Nothing would be lost by reloading now: no chips in hand, no sheet, no flying chips, not typing. */
  idle(): boolean;
}

export type Updater = ReturnType<typeof createUpdater>;

/** The update check. Creating it checks nothing; `start()` begins listening. */
export function createUpdater(d: UpdaterDeps) {
  let newBuild = false,
    checking = false,
    reloading = false;

  async function check(): Promise<void> {
    if (!d.build || newBuild || checking || !navigator.onLine) return;
    checking = true;
    try {
      const t = await (await fetch('config.js', { cache: 'no-store' })).text();
      const m = t.match(/APP_BUILD\s*=\s*"([^"]+)"/);
      if (m && m[1] !== d.build) {
        newBuild = true;
        d.render();
      }
    } catch {
      // offline or the server didn't answer: try again later
    } finally {
      checking = false;
    }
  }

  function reload(): void {
    reloading = true;
    location.reload();
  }

  return {
    build: d.build,
    /** A newer build is live. */
    newBuild: () => newBuild,
    check,
    reload,
    /** Reloads into the new build if there is one and the player is idle (called after every render). */
    maybeReload(): void {
      if (!newBuild || reloading || !d.idle()) return;
      reloading = true;
      d.toast('מעדכן לגרסה החדשה…');
      setTimeout(() => location.reload(), RELOAD_AFTER_MS);
    },
    /** The update screen's button: check now, and reload or say this is the latest. */
    async updateNow(): Promise<void> {
      await check();
      if (newBuild) reload();
      else d.toast('זו כבר הגרסה האחרונה. אם השולחן עדיין לא נפתח, נסו שוב עוד רגע.');
    },
    /** Checks when the app comes back to the screen, gets the focus or goes online, and every few minutes. */
    start(): void {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('focus', () => check());
      window.addEventListener('online', () => check());
      setInterval(check, CHECK_EVERY_MS);
      setTimeout(check, FIRST_CHECK_MS);
    },
  };
}
