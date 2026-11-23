/**
 * The bridge between the components and the views still written as HTML strings in `src/legacy.ts` (R-005 phase 5
 * converts them part by part; Part C removes this file when nothing uses it any more).
 */
import { render, type VNode } from 'preact';
import { AvatarArt } from './components/avatar';
import { Crown } from './components/crown';
import { Rank } from './components/rank';
import { ClosedSign } from './tables/closed-sign';
import { DealerFigure } from './tables/dealer-figure';
import type { Standing } from '../data/schema';

/**
 * A part of the page that is still an HTML string, inside the component tree. Preact sets its content only when the
 * string changed since the last render; otherwise the elements stay (and keep any animation running on them).
 */
export function LegacyHtml({ class: cls, html }: { class: string; html: string }) {
  return <div class={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * A component as an HTML string, for the string views that show one (the tables' avatars, the ceremony). Never call
 * this while Preact is rendering: `src/legacy.ts` builds its strings before it renders the components.
 */
export function toHtml(node: VNode): string {
  const el = document.createElement('div');
  render(node, el);
  const html = el.innerHTML;
  render(null, el);
  return html;
}

const artCache = new Map<string, string>();

/** A prepared character as HTML (drawn once per id). */
export function avatarArtHtml(id: string): string {
  let html = artCache.get(id);
  if (html == null) artCache.set(id, (html = toHtml(<AvatarArt id={id} />)));
  return html;
}

/** The crown over the winner, as HTML. */
export const crownHtml = (): string => toHtml(<Crown />);

/** The standings, as HTML. */
export const rankHtml = (list: Standing[], players: Record<string, { avatar?: unknown }>): string =>
  toHtml(<Rank list={list} players={players} />);

/** The dealer figure, as HTML (the Hold'em view; a fresh one per render, with the blink's phase from the clock). */
export const dealerFigureHtml = (): string => toHtml(<DealerFigure />);

/** The closed sign, as HTML (the Hold'em view). */
export const closedSignHtml = (drop: boolean): string => toHtml(<ClosedSign drop={drop} />);
