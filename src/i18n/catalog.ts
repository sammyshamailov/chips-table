/**
 * The shape of a catalog. `src/i18n/he.ts` is the source of truth: every key it has, every other catalog must have
 * (`Catalog`), so a missing English line fails to compile.
 */
import type { he } from './he';

/** A message with plural forms, chosen by the `n` parameter through `Intl.PluralRules` (Hebrew: one/two/other). */
export interface Plural {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

/** A message: text with `{name}` placeholders, or plural forms of it. */
export type Msg = string | Plural;

/** A key of the catalogs. */
export type Key = keyof typeof he;

/** A catalog: a message for every key of the Hebrew one. */
export type Catalog = { readonly [K in Key]: Msg };

/** The languages the app speaks. */
export const LANGS = ['he', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/**
 * A message's parameters. Numbers are shown as chip amounts (`formatChips`: grouped, rounded, Latin digits), lists of
 * names are joined in the language ("Dana and Yossi"), strings go in as they are (names as typed).
 */
export type Params = Readonly<Record<string, string | number | readonly string[]>>;
