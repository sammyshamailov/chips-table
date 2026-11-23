/**
 * The app's screens, mounted with Preact: `App` in `#app` (home or a table), `SheetScreen` in `#sheet`, the toast in
 * `#toast`. `src/legacy.ts` calls `paint`/`paintSheet` from its `render()`, synchronously, between measuring the old
 * positions (`FX.rects`) and the effects that run after the render (see docs/ARCHITECTURE.md, Effects).
 */
import { render } from 'preact';
import { createToaster } from './components/toast';
import { Home } from './screens/home';
import { RoomScreen, appClass } from './screens/room';
import type { LegacyParts, Session } from './session';
import { SheetScreen } from './sheets';

export function App({ session, legacy }: { session: Session; legacy: LegacyParts | null }) {
  return session.state.code ? <RoomScreen session={session} legacy={legacy} /> : <Home session={session} />;
}

export interface UiElements {
  app: HTMLElement;
  sheet: HTMLElement;
  toast: HTMLElement;
}

/** The mounted screens. Every call renders synchronously (Preact's top-level `render`). */
export function createUi(el: UiElements) {
  return {
    /** Draws home or the table into `#app` and sets its class. */
    paint(session: Session, legacy: LegacyParts | null): void {
      render(<App session={session} legacy={legacy} />, el.app);
      const cls = appClass(session, legacy);
      if (cls != null) el.app.className = cls;
    },
    /** Draws the open sheet into `#sheet`, or empties and hides it. */
    paintSheet(session: Session, open: boolean): void {
      render(open ? <SheetScreen session={session} /> : null, el.sheet);
      el.sheet.hidden = !open;
    },
    toast: createToaster(el.toast),
  };
}

export type Ui = ReturnType<typeof createUi>;
