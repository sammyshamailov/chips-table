/**
 * What the actions work with: the state, the store's write queue, the sound engine and the effects layer, and the
 * app's render. Built once by `createApp()` (src/app/app.ts) and handed to each group of actions.
 */
import type { Sound } from '../audio/synth';
import type { KeyValueStore } from '../data/browser-storage';
import type { DocData, Increment } from '../data/store';
import type { WriteOp } from '../data/writes';
import type { FxLayer } from '../fx/layer';
import type { State } from './state';

export interface AppContext {
  S: State;
  /** The phone's storage (settings, identity, the last table). */
  storage: KeyValueStore;
  snd: Sound;
  layer: FxLayer;
  /** One write at a time per document (src/data/writes.ts); resolves to false when it failed (a toast is up). */
  write(path: string, op: WriteOp, data?: DocData): Promise<boolean>;
  /** Adds `n` to a stored number: the dealer's changes to a player's stack. */
  inc(n: number): Increment;
  /** Measures, draws every screen and runs what follows a render (src/app/render.ts). */
  render(): void;
  /** Redraws the components only (no measuring): for changes only they show. */
  paint(): void;
  toast(text: string): void;
  now(): number;
  /** A short vibration when a tap does something. */
  buzz(): void;
}

/** A `data-a` action: `v` is the element's `data-v`, `el` the element tapped. */
export type Action = (v: string | undefined, el?: HTMLElement) => unknown;

/** The actions by their `data-a` name. */
export type Actions = Record<string, Action>;
