/**
 * The page's events, delegated: a tap on any `[data-a]` element runs that action with its `data-v`; typing in a
 * `[data-bind]` input writes the state; Enter in the code field joins; Escape closes the sheet or the turn-the-phone
 * prompt. One listener each, on the document, so the screens carry only attributes.
 */
import type { Sound } from '../audio/synth';
import type { KeyValueStore } from '../data/browser-storage';
import { tableUnsupported } from '../domain/guard';
import type { Actions } from './context';
import type { State } from './state';

/** On the update screen (a table this build doesn't play) only these act. */
const ON_UPDATE_SCREEN = ['home', 'upd', 'reload', 'snd', 'retry'];

export interface DomEventDeps {
  S: State;
  actions: Actions;
  storage: KeyValueStore;
  snd: Sound;
  /** `#sheet` (a tap on its backdrop closes it) and `#rot`. */
  sheetEl: HTMLElement;
  rotEl: HTMLElement;
  render(): void;
  paint(): void;
}

/** The text fields that write a top-level state field. */
const TOP_FIELDS = ['name', 'joinCode', 'newName'] as const;
/** The forms whose fields write `form.key`. */
const FORMS = ['create', 'edit', 'adj'] as const;

export function listenDom(d: DomEventDeps): void {
  const { S } = d;

  document.addEventListener('click', e => {
    if (e.target === d.sheetEl) {
      S.sheet = null;
      d.render();
      return;
    }
    const t = e.target instanceof Element ? (e.target.closest('[data-a]') as HTMLElement | null) : null;
    if (!t || (t as HTMLButtonElement).disabled) return;
    if (t.classList.contains('btn') || t.closest('.seg,.res4,.presets')) d.snd.tick();
    const a = t.dataset.a as string;
    if (S.code && tableUnsupported(S.room) && !ON_UPDATE_SCREEN.includes(a)) return; // update screen: nothing else acts
    const f = Object.prototype.hasOwnProperty.call(d.actions, a) ? d.actions[a] : null;
    if (f) f(t.dataset.v, t);
  });

  function bind(e: Event): void {
    const el = e.target as HTMLInputElement;
    const b = el.dataset && el.dataset.bind;
    if (!b) return;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    const [a, k] = b.split('.');
    if (k === undefined) {
      const f = TOP_FIELDS.find(x => x === a);
      if (f) S[f] = f === 'joinCode' ? String(v).toUpperCase() : String(v);
      if (a === 'name') {
        d.storage.set('chips.name', String(v).trim());
        if (!S.avatar) d.paint();
      }
    } else {
      const f = FORMS.find(x => x === a);
      const form = f && (S[f] as Record<string, unknown> | null);
      if (form) form[k] = v;
    }
    if (a === 'joinCode' && el.value !== S.joinCode) el.value = S.joinCode;
  }
  document.addEventListener('input', bind);
  document.addEventListener('change', bind);

  document.addEventListener('keydown', e => {
    const id = e.target instanceof Element ? e.target.id : '';
    if (e.key === 'Enter' && id === 'jcode') d.actions.join(undefined);
    if (e.key === 'Escape' && S.sheet) {
      S.sheet = null;
      d.render();
    } else if (e.key === 'Escape' && !d.rotEl.hidden) {
      S.rotOff = true;
      d.render();
    }
  });
}
