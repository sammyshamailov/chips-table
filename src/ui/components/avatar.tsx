/**
 * The avatar circle and the prepared characters (an original illustration per id in `AV_SET`).
 */
import type { VNode } from 'preact';
import { AV_SET, avatarBg, initial, validAv } from '../avatars';
import type { AvatarOwner } from '../session';
import { t } from '../../i18n';

const HAIR: Record<string, (hc: string) => VNode | VNode[]> = {
  short: hc => (
    <path d="M18.5 29c-1-11 5.5-16.5 13.5-16.5S46.5 18 45.5 29c-2.5-6-7-8.5-13.5-8.5s-11 2.5-13.5 8.5z" fill={hc} />
  ),
  long: hc => (
    <path d="M18.5 30c-1-12 5.5-17.5 13.5-17.5S46.5 18 45.5 30c-3-7-8-9-13.5-9.5-4 2-9 5-13.5 9.5z" fill={hc} />
  ),
  bun: hc => [
    <circle cx="32" cy="11" r="6" fill={hc} />,
    <path d="M18.5 29c-1-11 5.5-16.5 13.5-16.5S46.5 18 45.5 29c-2.5-6-7-8.5-13.5-8.5s-11 2.5-13.5 8.5z" fill={hc} />,
  ],
  curly: hc =>
    [
      [21, 21],
      [26, 16],
      [32, 14],
      [38, 16],
      [43, 21],
      [45, 27],
      [19, 27],
    ].map(([x, y]) => <circle cx={x} cy={y} r="5.2" fill={hc} />),
  bald: hc => (
    <path
      d="M19 27c-1.2 2-1.2 5 0 7M45 27c1.2 2 1.2 5 0 7"
      stroke={hc}
      stroke-width="2.6"
      stroke-linecap="round"
      fill="none"
    />
  ),
  cap: hc => [
    <path d="M18.5 27c0-9 6-14 13.5-14s13.5 5 13.5 14z" fill={hc} />,
    <path d="M30 26.5h20c1.5 0 1.5 3 0 3H30z" fill={hc} />,
    <circle cx="32" cy="13.5" r="1.6" fill="#fff" />,
  ],
  cowboy: hc => [
    <ellipse cx="32" cy="22.5" rx="20" ry="4" fill={hc} />,
    <path d="M22 22c0-8 3-11 10-11s10 3 10 11z" fill={hc} />,
    <path d="M22 20.5h20" stroke="#e0b766" stroke-width="2" />,
  ],
  beanie: hc => [
    <path d="M18.5 26c0-9 6-14.5 13.5-14.5S45.5 17 45.5 26z" fill={hc} />,
    <rect x="17.5" y="23.5" width="29" height="5" rx="2.5" fill={hc} stroke="rgba(0,0,0,.15)" />,
    <circle cx="32" cy="10.5" r="3" fill={hc} />,
  ],
};

function extras(ex: string[], hc: string): VNode[] {
  const has = (x: string) => ex.includes(x);
  const out: VNode[] = [];
  if (has('beard'))
    out.push(<path d="M20.5 33c1 9 6 13 11.5 13s10.5-4 11.5-13c-3 4-7 5.5-11.5 5.5S23.5 37 20.5 33z" fill={hc} />);
  if (has('mustache'))
    out.push(
      <path
        d="M26.5 36.2c2.5-2.2 4-1.6 5.5-.4 1.5-1.2 3-1.8 5.5.4-2.4.4-3.8 1.4-5.5 1.4s-3.1-1-5.5-1.4z"
        fill={has('beard') ? '#000' : hc}
        opacity=".85"
      />,
    );
  if (has('shades'))
    out.push(
      <path
        d="M22.5 27.5h8l-.6 3.6c-.3 1.4-1.4 2.2-2.8 2.2h-1.4c-1.4 0-2.5-.8-2.8-2.2zM33.5 27.5h8l-.6 3.6c-.3 1.4-1.4 2.2-2.8 2.2h-1.4c-1.4 0-2.5-.8-2.8-2.2zM30.5 28.5h3"
        fill="#111"
        stroke="#111"
        stroke-width="1"
      />,
    );
  if (has('glasses'))
    out.push(
      <circle cx="27" cy="30" r="3.6" fill="none" stroke="#2a1a12" stroke-width="1.3" />,
      <circle cx="37" cy="30" r="3.6" fill="none" stroke="#2a1a12" stroke-width="1.3" />,
      <path d="M30.6 30h2.8" stroke="#2a1a12" stroke-width="1.3" />,
    );
  if (has('earrings'))
    out.push(<circle cx="18.6" cy="35" r="1.6" fill="#e0b766" />, <circle cx="45.4" cy="35" r="1.6" fill="#e0b766" />);
  if (has('bowtie'))
    out.push(
      <path d="M32 50l-5.5-3v6zM32 50l5.5-3v6z" fill="#b3203c" />,
      <circle cx="32" cy="50" r="1.4" fill="#86152d" />,
    );
  return out;
}

/** One of the prepared characters, drawn in a 64×64 box. */
export function AvatarArt({ id }: { id: string }) {
  const a = AV_SET[id];
  if (!a) return null;
  const [bg, sk, hair, hc, shirt, ex] = a;
  const hairTop = HAIR[hair];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill={bg} />
      {hair === 'long' && <path d="M16 32c0-13 7-20 16-20s16 7 16 20v18H16z" fill={hc} />}
      <path d="M8 66c2-13 12-19 24-19s22 6 24 19z" fill={shirt} />
      <path d="M27.5 40h9v8.5c-2.8 2-6.2 2-9 0z" fill={sk} />
      <ellipse cx="18.8" cy="31" rx="2.2" ry="3" fill={sk} />
      <ellipse cx="45.2" cy="31" rx="2.2" ry="3" fill={sk} />
      <ellipse cx="32" cy="30" rx="13.4" ry="14.5" fill={sk} />
      {!ex.includes('shades') && [
        <circle cx="27" cy="30" r="1.7" fill="#2a1a12" />,
        <circle cx="37" cy="30" r="1.7" fill="#2a1a12" />,
      ]}
      <path d="M27.5 36.5q4.5 3.6 9 0" stroke="#7a3b2e" stroke-width="1.5" fill="none" stroke-linecap="round" />
      {hairTop && hairTop(hc)}
      {extras(ex, hc)}
    </svg>
  );
}

/** What goes inside an avatar circle: the photo, the character, or the first letter of the name. */
export function avatarInner(p: AvatarOwner) {
  const a = p && p.avatar;
  if (validAv(a)) return a.k === 'img' ? <img src={a.v} alt="" /> : <AvatarArt id={a.v} />;
  return initial(p && p.name);
}

interface AvatarProps {
  who: AvatarOwner;
  /** `av` (the default), `av big`, `fin-av`. */
  class?: string;
  /** A span inside buttons, a div elsewhere. */
  tag?: 'div' | 'span';
  /** The effects layer's key (`seat:<pid>`), for chips that fly to or from it. */
  k?: string;
}

/** An avatar circle. */
export function Avatar({ who, class: cls = 'av', tag: Tag = 'div', k }: AvatarProps) {
  return (
    <Tag class={cls} data-k={k} style={avatarBg(who)}>
      {avatarInner(who)}
    </Tag>
  );
}

/** The button that opens the avatar sheet: your circle with "Photo" under it. */
export function AvatarButton({ who }: { who: AvatarOwner }) {
  return (
    <button class="avbtn" data-a="sheet" data-v="avatar" aria-label={t('common.choosePhoto')}>
      <Avatar who={who} tag="span" />
      <span>{t('common.photo')}</span>
    </button>
  );
}
