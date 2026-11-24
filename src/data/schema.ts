/**
 * The stored documents as the app reads them: every fallback in one place (the anti-corruption layer).
 *
 * Phones on different versions share a table, so a document can be missing any field added after the first release,
 * or hold values a newer phone wrote. `normalizeRoom` / `normalizePlayer` turn whatever is stored into a complete
 * object, so the rest of the app doesn't check for missing fields. Rules:
 * - Missing or broken numbers are 0, flags false, strings '', arrays []; `stage`, `phase` and `roundId` fall back to
 *   the values a new table is created with.
 * - Where "missing" means something it stays distinguishable: `null` for `bjRound`, `bjPaidRound`, `lastAction`,
 *   `avatar`, `buttonPid`, `sbPid`, `bbPid`, `lastEvent`, `final`; and `roundEnd`, `mode`, `appMin` stay absent.
 * - Unknown fields and values are kept (a newer phone may have written them), so when this phone rewrites a hand it
 *   keeps what it doesn't understand.
 * - Normalise on read only. Writes stay the patches they always were: never write a normalised document back whole.
 *
 * The stored fields are listed in docs/ARCHITECTURE.md, "Stored data". A new field gets its fallback here.
 */
import { okChips } from '../domain/chips';
import type { BjHand, EventLineDoc, Game, LastAction, PlayerDoc, RoomDoc } from '../domain/types';

export type { RoomDoc, PlayerDoc } from '../domain/types';

/** A player's picture: `{k:'set', v: <character id>}` or `{k:'img', v: <data URL>}` (checked further by the UI). */
export interface Avatar {
  k: string;
  v: string;
}

/** One line of the final standings. */
export interface Standing {
  pid: string;
  name: string;
  stack: number;
}

/** `rooms/{CODE}`, normalised. */
export interface Room extends RoomDoc {
  code: string;
  game: Game;
  startStack: number;
  sb: number;
  bb: number;
  minBet: number;
  maxBet: number;
  hostId: string;
  hostName: string;
  createdAt: number;
  updatedAt: number;
  /**
   * The line under the header. `t`: the text in Hebrew (all an older phone reads). `key` and `p` (R-006): the catalog
   * key and its parameters, so each phone shows it in its own language; absent when an older phone wrote it.
   */
  lastEvent: EventLineDoc | null;
  handId: number;
  streetId: number;
  stage: string;
  potLevel: number;
  buttonPid: string | null;
  sbPid: string | null;
  bbPid: string | null;
  roundId: number;
  phase: string;
  house: number;
  dealerBJ: boolean;
  /** Absent when an older phone ended the round: readers fall back to the `lastEvent` text. */
  roundEnd?: string;
  /** Absent means a chips table. A value that isn't a string becomes its JSON text, so it never looks known. */
  mode?: string;
  /** Absent means 0. A value that isn't a number becomes `Number(value)` (NaN included), as the guard always read it. */
  appMin?: number;
  closed: boolean;
  final: { at: number; list: Standing[] } | null;
}

/** `rooms/{CODE}/players/{pid}`, normalised. */
export interface Player extends PlayerDoc {
  name: string;
  joinedAt: number;
  stack: number;
  sittingOut: boolean;
  handId: number;
  streetId: number;
  streetBet: number;
  committed: number;
  folded: boolean;
  allIn: boolean;
  /** The round the player's `hands` belong to; null when they haven't bet. */
  bjRound: number | null;
  hands: BjHand[];
  insurance: number;
  surrendered: boolean;
  /** The round the dealer last paid or refunded this player in; null when never. */
  bjPaidRound: number | null;
  lastAction: LastAction | null;
  ts: number;
  avatar: Avatar | null;
}

type Raw = Record<string, unknown>;

const has = (o: Raw, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const obj = (v: unknown): Raw | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown, d = 0): number => (isNum(v) ? v : d);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const objs = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(obj).filter((x): x is Raw => !!x) : []);

/** One Blackjack spot: `bet` a number, `chips` only when they add up to it, everything else as stored. */
export function normalizeHand(raw: Raw): BjHand {
  const h = { ...raw, bet: num(raw.bet) } as BjHand & Raw;
  if (has(h, 'chips') && !okChips(h.chips, h.bet)) delete h.chips;
  if (has(h, 'result') && h.result !== null && typeof h.result !== 'string') delete h.result;
  return h;
}

/** The last action, or null when there is none or it has no kind. `amt` and `chips` kept only when well-formed. */
export function normalizeLastAction(raw: unknown): LastAction | null {
  const a = obj(raw);
  if (!a || typeof a.k !== 'string') return null;
  const out = { ...a } as LastAction & Raw;
  if (has(out, 'amt') && !isNum(out.amt)) delete out.amt;
  if (has(out, 'chips') && !Array.isArray(out.chips)) delete out.chips;
  return out;
}

/** A picture with a kind and a value, or null. */
export function normalizeAvatar(raw: unknown): Avatar | null {
  const a = obj(raw);
  return a && typeof a.k === 'string' && typeof a.v === 'string' ? ({ ...a } as unknown as Avatar) : null;
}

function normalizeFinal(raw: unknown): Room['final'] {
  const f = obj(raw);
  if (!f) return null;
  const list = objs(f.list).map(x => ({ ...x, pid: str(x.pid), name: str(x.name), stack: num(x.stack) }));
  return { ...f, at: num(f.at), list };
}

/** A stored event line: `t` and `ts` always; `key` only when it is a string, `p` only its string, number and list values. */
function normalizeLastEvent(raw: unknown): Room['lastEvent'] {
  const e = obj(raw);
  if (!e) return null;
  const out: EventLineDoc = { ...e, t: str(e.t), ts: num(e.ts) };
  if (typeof e.key !== 'string') delete out.key;
  const p = obj(e.p);
  if (!p) delete out.p;
  else
    out.p = Object.fromEntries(
      Object.entries(p).filter(
        ([, v]) =>
          typeof v === 'string' ||
          (typeof v === 'number' && Number.isFinite(v)) ||
          (Array.isArray(v) && v.every(x => typeof x === 'string')),
      ),
    ) as EventLineDoc['p'];
  return out;
}

/** `rooms/{CODE}` as stored (any version, or nothing) → a complete `Room`. */
export function normalizeRoom(raw: unknown): Room {
  const r = obj(raw) || {};
  const room: Room = {
    ...r,
    code: str(r.code),
    // Only Hold'em is ever checked by name; every view draws anything else as Blackjack.
    game: r.game === 'holdem' ? 'holdem' : 'blackjack',
    startStack: num(r.startStack),
    sb: num(r.sb),
    bb: num(r.bb),
    minBet: num(r.minBet),
    maxBet: num(r.maxBet),
    hostId: str(r.hostId),
    hostName: str(r.hostName),
    createdAt: num(r.createdAt),
    updatedAt: num(r.updatedAt),
    lastEvent: normalizeLastEvent(r.lastEvent),
    handId: num(r.handId),
    streetId: num(r.streetId),
    stage: str(r.stage, 'idle'),
    potLevel: num(r.potLevel),
    buttonPid: strOrNull(r.buttonPid),
    sbPid: strOrNull(r.sbPid),
    bbPid: strOrNull(r.bbPid),
    roundId: num(r.roundId, 1),
    phase: str(r.phase, 'betting'),
    house: num(r.house),
    dealerBJ: !!r.dealerBJ,
    closed: !!r.closed,
    final: normalizeFinal(r.final),
  };
  delete room.roundEnd;
  delete room.mode;
  delete room.appMin;
  if (typeof r.roundEnd === 'string') room.roundEnd = r.roundEnd;
  if (r.mode != null) room.mode = typeof r.mode === 'string' ? r.mode : JSON.stringify(r.mode);
  if (r.appMin != null) room.appMin = Number(r.appMin);
  return room;
}

/** `rooms/{CODE}/players/{pid}` as stored (any version, or nothing) → a complete `Player`. */
export function normalizePlayer(raw: unknown): Player {
  const p = obj(raw) || {};
  return {
    ...p,
    name: str(p.name),
    joinedAt: num(p.joinedAt),
    stack: num(p.stack),
    sittingOut: !!p.sittingOut,
    handId: num(p.handId),
    streetId: num(p.streetId),
    streetBet: num(p.streetBet),
    committed: num(p.committed),
    folded: !!p.folded,
    allIn: !!p.allIn,
    bjRound: numOrNull(p.bjRound),
    hands: objs(p.hands).map(normalizeHand),
    insurance: num(p.insurance),
    surrendered: !!p.surrendered,
    bjPaidRound: numOrNull(p.bjPaidRound),
    lastAction: normalizeLastAction(p.lastAction),
    ts: num(p.ts),
    avatar: normalizeAvatar(p.avatar),
  };
}
