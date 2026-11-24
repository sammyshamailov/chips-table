import { describe, expect, it } from 'vitest';
import { normalizePlayer, normalizeRoom } from '../data/schema';
import type { KeyValueStore } from '../data/browser-storage';
import { he } from '../i18n/he';
import { setLang } from '../i18n';
import { randomCode, randomId } from './ids';
import {
  createState,
  eventLine,
  isHost,
  me,
  nameOf,
  newPlayer,
  pendChips,
  playerList,
  playerPath,
  roomPath,
  standings,
} from './state';

function storage(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    get: k => (k in data ? data[k] : null),
    set: (k, v) => void (data[k] = v),
    del: k => void delete data[k],
  };
}

function table() {
  const S = createState(storage({ 'chips.pid': 'p_me', 'chips.name': 'Sam' }), () => 'p_new');
  S.code = 'ABCD';
  S.room = normalizeRoom({ code: 'ABCD', hostId: 'p_me', hostName: 'Sam' });
  S.players = {
    p_b: normalizePlayer({ name: 'Dana', joinedAt: 2, stack: 700 }),
    p_me: normalizePlayer({ name: 'Sam', joinedAt: 1, stack: 1200 }),
    p_c: normalizePlayer({ name: 'Yossi', joinedAt: 3, stack: 700 }),
  };
  return S;
}

describe('createState', () => {
  it('keeps the phone’s player id, name and avatar', () => {
    const ls = storage({ 'chips.pid': 'p_kept', 'chips.name': 'Dana', 'chips.avatar': '{"k":"set","v":"tex"}' });
    let made = 0;
    const S = createState(ls, () => (made++, 'p_new'));
    expect([S.myId, S.name, S.avatar, made]).toEqual(['p_kept', 'Dana', { k: 'set', v: 'tex' }, 0]);
  });

  it('makes and saves a player id only when there is none', () => {
    const ls = storage();
    const S = createState(ls, () => 'p_new');
    expect(S.myId).toBe('p_new');
    expect(ls.data['chips.pid']).toBe('p_new');
  });

  it('drops a damaged or unknown saved avatar', () => {
    expect(createState(storage({ 'chips.avatar': '{oops' }), () => 'p').avatar).toBeNull();
    expect(createState(storage({ 'chips.avatar': '{"k":"set","v":"toString"}' }), () => 'p').avatar).toBeNull();
  });

  it('starts on home with the new-table form filled in', () => {
    const S = createState(storage(), () => 'p');
    expect([S.mode, S.code, S.room, S.sheet, S.pending]).toEqual(['pending', null, null, null, 0]);
    expect(S.create).toEqual({
      game: 'holdem',
      stack: '1000',
      sb: '5',
      bb: '10',
      minBet: '10',
      maxBet: '500',
      play: true,
    });
  });
});

describe('questions about the state', () => {
  it('lists the players in the order they sat down, with their ids', () => {
    expect(playerList(table()).map(p => p.pid)).toEqual(['p_me', 'p_b', 'p_c']);
  });

  it('knows this phone’s player and whether it is the dealer', () => {
    const S = table();
    expect(me(S)).toMatchObject({ pid: 'p_me', name: 'Sam', stack: 1200 });
    expect(isHost(S)).toBe(true);
    S.myId = 'p_b';
    expect(isHost(S)).toBe(false);
    S.myId = 'p_gone';
    expect(me(S)).toBeNull();
  });

  it('names a player, the dealer who doesn’t sit, or anyone else', () => {
    const S = table();
    delete S.players.p_me;
    expect([nameOf(S, 'p_b'), nameOf(S, 'p_me'), nameOf(S, 'p_x')]).toEqual(['Dana', 'Sam', he['common.player']]);
  });

  it('ranks the standings by stack, ties in seat order', () => {
    expect(standings(table())).toEqual([
      { pid: 'p_me', name: 'Sam', stack: 1200 },
      { pid: 'p_b', name: 'Dana', stack: 700 },
      { pid: 'p_c', name: 'Yossi', stack: 700 },
    ]);
  });

  it('keeps the chips in hand while they add up, and makes them up when they don’t', () => {
    const S = table();
    S.pending = 30;
    S.pendChips = [5, 25];
    expect(pendChips(S)).toEqual([5, 25]);
    S.pending = 60;
    expect(pendChips(S)).toEqual([50, 10]);
  });

  it('writes a new player with its name cut to 20 letters and the phone’s avatar', () => {
    const S = table();
    S.name = '  ' + 'a'.repeat(25) + ' ';
    S.avatar = { k: 'set', v: 'tex' };
    const d = newPlayer(S, 500, 99);
    expect(d).toMatchObject({ name: 'a'.repeat(20), stack: 500, joinedAt: 99, ts: 99, avatar: { k: 'set', v: 'tex' } });
    expect(d).toMatchObject({ handId: 0, bjRound: null, hands: [], lastAction: null, folded: false });
    S.name = ' ';
    expect(newPlayer(S, 0, 1).name).toBe(he['common.player']);
    setLang('en');
    expect([newPlayer(S, 0, 1).name, nameOf(S, 'p_x')]).toEqual(['Player', 'Player']);
    setLang('he');
  });

  it('builds the document paths and the event line', () => {
    const S = table();
    expect([roomPath(S), playerPath(S), playerPath(S, 'p_b')]).toEqual([
      'rooms/ABCD',
      'rooms/ABCD/players/p_me',
      'rooms/ABCD/players/p_b',
    ]);
    expect(eventLine('ev.opened', {}, 5)).toEqual({
      lastEvent: { t: he['ev.opened'], key: 'ev.opened', p: {}, ts: 5 },
      updatedAt: 5,
    });
    // in Hebrew for older phones, whatever this phone speaks
    setLang('en');
    expect(eventLine('ev.newDealer', { name: 'Dana' }, 6).lastEvent).toEqual({
      t: he['ev.newDealer'].replace('{name}', 'Dana'),
      key: 'ev.newDealer',
      p: { name: 'Dana' },
      ts: 6,
    });
    setLang('he');
  });
});

describe('ids', () => {
  it('makes player ids and table codes from the allowed characters', () => {
    expect(randomId(10)).toMatch(/^[a-km-np-z2-9]{10}$/);
    expect(randomCode()).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });
});
