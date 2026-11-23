/**
 * Table types this build understands: the guard against tables written by newer phones (R-009).
 *
 * Room fields `mode` (missing = `'chips'`) and `appMin` (missing = 0) are only read for now. A table that needs a
 * newer build is shown as an update screen, is never written to, and plays no effects. Raise `FEATURE_LEVEL` only
 * when this build can really play tables written with that `appMin`.
 */
import type { RoomDoc } from './types';

/** The highest `appMin` this build can play. */
export const FEATURE_LEVEL = 1;

/** The table modes this build can play. */
export const KNOWN_MODES: readonly string[] = ['chips'];

/** True when this build must not play the room: it needs a newer build, or it is a mode this build doesn't know. */
export function tableUnsupported(r: RoomDoc | null | undefined): boolean {
  if (!r) return false;
  const min = Number(r.appMin);
  if (r.appMin != null && !(min <= FEATURE_LEVEL)) return true; // also catches a non-number
  return r.mode != null && !KNOWN_MODES.includes(r.mode);
}
