/** Random ids: player ids and table codes, from the browser's crypto random numbers. */

/** Lowercase letters and digits without the look-alikes (no l, o, 0, 1): 32 characters. */
const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
/** Capital letters without I and O: 24 characters. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const pick = (chars: string, n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), b => chars[b % chars.length]).join('');

/** `n` characters of `ID_CHARS`. */
export const randomId = (n = 8): string => pick(ID_CHARS, n);

/** A new player id: `p_` and ten characters. */
export const newPlayerId = (): string => 'p_' + randomId(10);

/** A table code: four capital letters. */
export const randomCode = (): string => pick(CODE_CHARS, 4);
