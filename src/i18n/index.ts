/**
 * The app's words: `t(key, params)` in the phone's language, chip amounts (`formatChips`), lists of names, and the
 * table's stored event line (`eventText`). Pure apart from the one setting it holds, the language in use, which the
 * app sets at start-up (before the first render) and when the player switches. Every word on the screen comes from a
 * catalog (`he.ts`, `en.ts`); `scripts/check-i18n.mjs` keeps them in step and the code free of Hebrew.
 */
import { LANGS, type Catalog, type Key, type Lang, type Msg, type Params } from './catalog';
import { en } from './en';
import { he } from './he';

export type { Catalog, Key, Lang, Params } from './catalog';
export { LANGS } from './catalog';

export const CATALOGS: Record<Lang, Catalog> = { he, en };

let current: Lang = 'he';

/** The language in use. */
export function lang(): Lang {
  return current;
}

/** Changes the language `t()` speaks (the caller re-renders and updates the page, see `document.ts`). */
export function setLang(l: Lang): void {
  current = l;
}

/** A known language, or null. */
export function asLang(v: unknown): Lang | null {
  return (LANGS as readonly unknown[]).includes(v) ? (v as Lang) : null;
}

/** The writing direction of a language. */
export function dirOf(l: Lang): 'rtl' | 'ltr' {
  return l === 'he' ? 'rtl' : 'ltr';
}

/**
 * The language a phone starts in: the one it chose (`saved`); else Hebrew for a phone that already used the app (it
 * was Hebrew only until now, so nobody's screen changes on its own); else Hebrew when the phone's languages list
 * Hebrew before English (`he`, or the old code `iw`), otherwise English.
 */
export function pickLang(saved: string | null, languages: readonly string[], usedBefore: boolean): Lang {
  const chosen = asLang(saved);
  if (chosen) return chosen;
  if (usedBefore) return 'he';
  const base = languages.map(l => String(l).toLowerCase().split(/[-_]/)[0]);
  const hi = base.findIndex(l => l === 'he' || l === 'iw'),
    ei = base.indexOf('en');
  return hi >= 0 && (ei < 0 || hi < ei) ? 'he' : 'en';
}

/** A whole number with thousands separators, as every amount in the app is shown: `1234.6` → `1,235`. */
export function formatChips(n: number | null | undefined): string {
  return Math.round(n || 0).toLocaleString('en-US');
}

/** Names joined as the language joins a list ("Dana, Yossi and Avi"; Hebrew joins each with its "and"). */
export function joinNames(names: readonly string[], l: Lang = current): string {
  if (names.length < 2) return names.join('');
  const c = CATALOGS[l];
  return names.slice(0, -1).join(text(c['common.listSep'])) + text(c['common.listLast']) + names[names.length - 1];
}

const text = (m: Msg): string => (typeof m === 'string' ? m : m.other);

const rules: Partial<Record<Lang, Intl.PluralRules>> = {};
function pluralOf(m: Msg, l: Lang, n: unknown): string {
  if (typeof m === 'string') return m;
  if (typeof n !== 'number') return m.other;
  const pr = (rules[l] ||= new Intl.PluralRules(l));
  return m[pr.select(n)] ?? m.other;
}

function fill(s: string, p: Params | undefined, l: Lang): string {
  if (!p) return s;
  return s.replace(/\{(\w+)\}/g, (all, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(p, name)) return all;
    const v = p[name];
    if (typeof v === 'number') return formatChips(v);
    if (Array.isArray(v)) return joinNames(v as string[], l);
    return String(v);
  });
}

/** A message in language `l`: plural form by `p.n`, then `{name}` placeholders filled from `p`. */
export function tIn(l: Lang, key: Key, p?: Params): string {
  const m = CATALOGS[l][key] ?? he[key];
  return fill(pluralOf(m, l, p && p.n), p, l);
}

/** A message in the phone's language. */
export function t(key: Key, p?: Params): string {
  return tIn(current, key, p);
}

/** `k` is a key of the catalogs (a stored event line may carry one this version doesn't know). */
export function hasKey(k: unknown): k is Key {
  return typeof k === 'string' && Object.prototype.hasOwnProperty.call(he, k);
}

/** The table's event line as stored (`lastEvent`): its text, with the key and parameters when the writer knew them. */
export interface EventLine {
  t: string;
  key?: string;
  p?: Params;
}

/**
 * The event line in the phone's language: from its key and parameters when this version knows the key, else the
 * stored text (written by an older phone, in Hebrew).
 */
export function eventText(e: EventLine | null | undefined): string {
  if (!e) return '';
  if (e.key && hasKey(e.key) && e.key.startsWith('ev.')) return t(e.key, e.p);
  return e.t || '';
}

/**
 * A new event line: the key and parameters for phones that read them, and the Hebrew text for phones that don't
 * (older versions show `t`). Names in `p` stay as typed; amounts are numbers.
 */
export function storedEvent(key: Key, p: Params = {}): EventLine & { key: string; p: Params } {
  return { t: tIn('he', key, p), key, p };
}
