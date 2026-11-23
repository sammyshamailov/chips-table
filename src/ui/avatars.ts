/**
 * Avatars: a photo (camera or gallery) or one of the prepared characters, stored on the player document as
 * `avatar: { k: 'img', v: 'data:image/jpeg;base64,...' }` or `{ k: 'set', v: '<id>' }`. Without one, the circle shows
 * the first letter of the name on a colour worked out from the player id.
 */
import type { AvatarOwner } from './session';

const SKIN = ['#f3cfb3', '#e2ab84', '#c68863', '#8d5a3b', '#5e3a26'];

/** Background, skin, hair, hair colour, shirt, extras. */
export type Character = [string, string, string, string, string, string[]];

// prettier-ignore
export const AV_SET: Record<string, Character> = {
  //     background  skin     hair      hair colour  shirt      extras
  ace:    ['#3d6fb6', SKIN[0], 'short',  '#5a3a24', '#1f2a44', []],
  rose:   ['#d0558f', SKIN[0], 'long',   '#e9c46a', '#f4f1ea', ['earrings']],
  bun:    ['#2a9d8f', SKIN[1], 'bun',    '#1d1d1f', '#17171c', ['bowtie']],
  curls:  ['#e07a26', SKIN[3], 'curly',  '#2a1a12', '#264653', []],
  sage:   ['#2e8a4f', SKIN[2], 'bald',   '#9a9a9a', '#5c4033', ['beard']],
  rookie: ['#5fa8d3', SKIN[0], 'cap',    '#c8372d', '#c8372d', []],
  tex:    ['#b07a2a', SKIN[1], 'cowboy', '#6b4428', '#7a2e1f', ['mustache']],
  shark:  ['#6b3fa0', SKIN[1], 'short',  '#1d1d1f', '#17171c', ['shades']],
  ruby:   ['#74cf9f', SKIN[0], 'long',   '#b5452a', '#3d405b', ['glasses']],
  gent:   ['#e0b766', SKIN[2], 'short',  '#2a1a12', '#17171c', ['bowtie']],
  diva:   ['#8e1f2c', SKIN[3], 'long',   '#1d1d1f', '#e0b766', ['shades', 'earrings']],
  sunny:  ['#9bc53d', SKIN[0], 'curly',  '#e9c46a', '#3d6fb6', []],
  boss:   ['#1c2b4a', SKIN[4], 'bald',   '#1d1d1f', '#f4f1ea', ['mustache', 'bowtie']],
  nana:   ['#a78bfa', SKIN[0], 'bun',    '#d6d6d6', '#7a4a2a', ['glasses', 'earrings']],
  chill:  ['#3fa9b5', SKIN[2], 'beanie', '#e07a26', '#2a2a2e', []],
  red:    ['#7a4a2a', SKIN[0], 'short',  '#c0562d', '#2e8a4f', ['beard']],
};

/** A stored avatar this build can show: a known character, or a small JPEG/PNG/WebP data URL. */
export type ValidAvatar = { k: 'set'; v: string } | { k: 'img'; v: string };

export function validAv(a: unknown): a is ValidAvatar {
  if (!a || typeof a !== 'object') return false;
  const { k, v } = a as { k?: unknown; v?: unknown };
  return (
    // Own keys only: an id like `toString` would otherwise pass and break every phone drawing that player.
    (k === 'set' && typeof v === 'string' && Object.prototype.hasOwnProperty.call(AV_SET, v)) ||
    (k === 'img' &&
      typeof v === 'string' &&
      v.length < 60000 &&
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v))
  );
}

/** A colour (0–359) from a player id, the same on every phone. */
export function hue(s: string): number {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** The circle's inline style: a colour behind the letter, nothing behind a picture. */
export function avatarBg(p: AvatarOwner): string {
  return validAv(p && p.avatar) ? '' : `background:hsl(${hue(p.pid)} 55% 68%)`;
}

/** The letter shown without a picture: the first letter of the name, or `?`. */
export function initial(name: string | null | undefined): string {
  return (name || '?').trim().charAt(0) || '?';
}
