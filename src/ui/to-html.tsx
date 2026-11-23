/**
 * Components as HTML strings, for the one part of the app still built as HTML: the end-of-game ceremony's card
 * (`ceremony()` in `src/legacy.ts`), which lives in `#fin`, outside the screens, and is animated step by step.
 */
import { render, type VNode } from 'preact';
import { Avatar } from './components/avatar';
import { Crown } from './components/crown';
import { Rank } from './components/rank';
import type { Standing } from '../data/schema';
import type { AvatarOwner } from './session';

/**
 * A component as an HTML string. Never call this while Preact is rendering the screens: the ceremony builds its card
 * from a timer, after the render.
 */
export function toHtml(node: VNode): string {
  const el = document.createElement('div');
  render(node, el);
  const html = el.innerHTML;
  render(null, el);
  return html;
}

/** An avatar circle, as HTML (`fin-av`: the winner's). */
export const avatarHtml = (who: AvatarOwner, cls: string): string => toHtml(<Avatar who={who} class={cls} />);

/** The crown over the winner, as HTML. */
export const crownHtml = (): string => toHtml(<Crown />);

/** The standings, as HTML. */
export const rankHtml = (list: Standing[], players: Record<string, { avatar?: unknown }>): string =>
  toHtml(<Rank list={list} players={players} />);
