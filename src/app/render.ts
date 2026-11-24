/**
 * `render()`: draws every screen from the state, synchronously. First it measures every `[data-k]` element into
 * `FX.rects` (where things were, for the effects that run after it), then Preact patches `#app` and `#sheet`, the
 * table is scaled, the turn-the-phone prompt shown or hidden, the background sound follows the table, and a waiting
 * update reloads if the player is idle. See docs/ARCHITECTURE.md, Screens and Effects.
 */
import { tableUnsupported } from '../domain/guard';
import type { FxLayer } from '../fx/layer';
import type { Ui } from '../ui/app';
import { paintRotate } from '../ui/rotate';
import type { TableScale } from '../ui/scale';
import type { Session } from '../ui/session';
import type { Updater } from '../update';
import type { State } from './state';

export interface RenderDeps {
  S: State;
  layer: FxLayer;
  ui: Ui;
  session: Session;
  scale: TableScale;
  /** `#rot`. */
  rotEl: HTMLElement;
  ambiSync(): void;
  updates: Updater;
}

export function createRenderer(d: RenderDeps) {
  const { S, layer, ui, session } = d;

  /** The sheet shows over a table this build plays; the avatar sheet also on home. */
  const sheetOpen = () => !!(S.sheet && ((S.room && !tableUnsupported(S.room)) || S.sheet === 'avatar'));

  /** Redraws the components only, without measuring: for changes only they show (a letter, the home list). */
  function paint(): void {
    ui.paint(session);
  }

  function render(): void {
    layer.FX.rects = layer.measure();
    ui.paint(session);
    d.scale.apply();
    paintRotate(d.rotEl, !!(S.code && S.room && !S.rotOff && d.scale.portraitPhone()));
    d.ambiSync();
    if (d.updates.newBuild()) setTimeout(d.updates.maybeReload, 0);
    ui.paintSheet(session, sheetOpen());
  }

  return { render, paint };
}
