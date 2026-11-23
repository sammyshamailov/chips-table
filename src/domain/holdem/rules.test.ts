import { describe, expect, it } from 'vitest';
import type { RoomDoc, Seat } from '../types';
import { activePlayers, bet, blindSeats, canAct, classifyBet, fold, holdemState, newHand, nextStreet } from './rules';

const room = (o: Partial<RoomDoc> = {}): RoomDoc => ({
  sb: 5,
  bb: 10,
  handId: 1,
  streetId: 11,
  stage: 'preflop',
  potLevel: 0,
  ...o,
});
/** A player in hand 1, street 11, with `bet` on this street (all of it committed unless given). */
const seat = (pid: string, stack: number, streetBet = 0, o: Partial<Seat> = {}): Seat => ({
  pid,
  stack,
  handId: 1,
  streetId: 11,
  streetBet,
  committed: streetBet,
  folded: false,
  allIn: false,
  ...o,
});

describe('holdemState', () => {
  it('sums the pot above the pot level and finds the highest bet', () => {
    const h = holdemState(room({ potLevel: 10 }), [
      seat('a', 90, 30, { committed: 50 }),
      seat('b', 95, 5, { committed: 5 }),
    ]);
    expect(h.pot).toBe(40);
    expect(h.maxSt).toBe(30);
    expect(h.lvl).toBe(10);
  });
  it('ignores players from another hand and bets from an earlier street', () => {
    const r = room({ streetId: 12 });
    const h = holdemState(r, [
      seat('a', 90, 30),
      seat('b', 90, 10, { handId: 0 }),
      seat('c', 90, 0, { streetId: 12, streetBet: 0 }),
    ]);
    expect(h.st(h.list[0])).toBe(0);
    expect(h.inHand(h.list[1])).toBe(false);
    expect(h.com(h.list[1])).toBe(0);
    expect(h.pot).toBe(30);
    expect(h.maxSt).toBe(0);
  });
  it('nobody is in a hand while the table is idle', () => {
    const h = holdemState(room({ stage: 'idle' }), [seat('a', 90, 30)]);
    expect(h.inHand(h.list[0])).toBe(false);
    expect(h.pot).toBe(0);
  });
  it('reads missing fields as zero', () => {
    const h = holdemState({ stage: 'preflop' }, [{ pid: 'a' }]);
    expect(h.pot).toBe(0);
    expect(h.minTo).toBe(1);
    expect(h.lvl).toBe(0);
  });
  it('lists the live players (in the hand, not folded)', () => {
    const h = holdemState(room(), [
      seat('a', 90, 10),
      seat('b', 90, 10, { folded: true }),
      seat('c', 90, 0, { handId: 0 }),
    ]);
    expect(h.live.map(p => p.pid)).toEqual(['a']);
  });
});

describe('minimum raise', () => {
  const minTo = (bets: number[], bb = 10) =>
    holdemState(
      room({ bb }),
      bets.map((b, i) => seat('p' + i, 100, b)),
    ).minTo;
  it('opens at the big blind when nobody has bet', () => {
    expect(minTo([0, 0])).toBe(10);
    expect(minTo([0, 0], 0)).toBe(1);
  });
  it('after the blinds: big blind plus a big blind', () => {
    expect(minTo([5, 10, 0])).toBe(20);
  });
  it('raises by at least the last raise', () => {
    expect(minTo([30, 10])).toBe(50);
    expect(minTo([40, 0])).toBe(80);
  });
  it('a room without a big blind raises by at least 1', () => {
    expect(minTo([20, 10], 0)).toBe(30);
  });
  it('never raises by less than the big blind', () => {
    expect(minTo([12, 10], 10)).toBe(22);
  });
  it('everyone level: raise by the bet itself', () => {
    expect(minTo([20, 20])).toBe(40);
  });
});

describe('canAct', () => {
  const r = room();
  const h = holdemState(r, [seat('a', 90), seat('b', 90, 0, { folded: true }), seat('c', 0, 0, { allIn: true })]);
  it('only a player in the hand who has not folded and is not all-in', () => {
    expect(canAct(h, h.list[0])).toBe(true);
    expect(canAct(h, h.list[1])).toBe(false);
    expect(canAct(h, h.list[2])).toBe(false);
    expect(canAct(h, null)).toBe(false);
  });
  it('not at the showdown or between hands', () => {
    for (const stage of ['showdown', 'idle']) {
      const s = holdemState(room({ stage }), [seat('a', 90)]);
      expect(canAct(s, s.list[0])).toBe(false);
    }
  });
});

describe('classifyBet', () => {
  it('names each action', () => {
    expect(classifyBet(50, 50, 20, 0)).toBe('allin');
    expect(classifyBet(0, 20, 20, 50)).toBe('check');
    expect(classifyBet(10, 20, 20, 50)).toBe('call');
    expect(classifyBet(20, 20, 0, 50)).toBe('bet');
    expect(classifyBet(30, 40, 20, 50)).toBe('raise');
  });
});

describe('bet', () => {
  const st = (bets: Seat[]) => holdemState(room(), bets);
  it('checks when nothing is owed', () => {
    const h = st([seat('a', 100), seat('b', 100)]);
    const res = bet(h, h.list[0], 0);
    expect(res).toEqual({
      ok: true,
      add: 0,
      patch: { stack: 100, streetBet: 0, streetId: 11, committed: 0, allIn: false, lastAction: { k: 'check', amt: 0 } },
    });
  });
  it('refuses a check when a bet is owed', () => {
    const h = st([seat('a', 100, 5), seat('b', 100, 10)]);
    expect(bet(h, h.list[0], 0)).toEqual({ ok: false, reason: 'short-of-call' });
  });
  it('refuses a player who cannot act', () => {
    const h = st([seat('a', 100, 0, { folded: true })]);
    expect(bet(h, h.list[0], 10)).toEqual({ ok: false, reason: 'cannot-act' });
    expect(bet(h, null, 10)).toEqual({ ok: false, reason: 'cannot-act' });
  });
  it('calls: amount is the chips added; committed grows', () => {
    const h = st([seat('a', 95, 5), seat('b', 90, 10)]);
    const res = bet(h, h.list[0], 5);
    expect(res.ok && res.patch).toEqual({
      stack: 90,
      streetBet: 10,
      streetId: 11,
      committed: 10,
      allIn: false,
      lastAction: { k: 'call', amt: 5 },
    });
  });
  it('bets into an empty street', () => {
    const h = st([seat('a', 100), seat('b', 100)]);
    const res = bet(h, h.list[0], 20);
    expect(res.ok && res.patch.lastAction).toEqual({ k: 'bet', amt: 20 });
  });
  it('a raise records the new street total', () => {
    const h = st([seat('a', 95, 5), seat('b', 90, 10)]);
    const res = bet(h, h.list[0], 25);
    expect(res.ok && res.patch.lastAction).toEqual({ k: 'raise', amt: 30 });
  });
  it('caps at the stack and goes all-in', () => {
    const h = st([seat('a', 40, 5), seat('b', 90, 10)]);
    const res = bet(h, h.list[0], 500);
    expect(res.ok && res.add).toBe(40);
    expect(res.ok && res.patch).toMatchObject({
      stack: 0,
      allIn: true,
      streetBet: 45,
      lastAction: { k: 'allin', amt: 45 },
    });
  });
  it('a negative amount counts as a check', () => {
    const h = st([seat('a', 100), seat('b', 100)]);
    expect(bet(h, h.list[0], -5).ok && true).toBe(true);
  });
  it('saves the exact chips only when they add up', () => {
    const h = st([seat('a', 100), seat('b', 100)]);
    const good = bet(h, h.list[0], 15, [10, 5]);
    expect(good.ok && good.patch.lastAction.chips).toEqual([10, 5]);
    const bad = bet(h, h.list[0], 15, [10]);
    expect(bad.ok && 'chips' in bad.patch.lastAction).toBe(false);
  });
  it('a player without a stack can only check', () => {
    const h = st([seat('a', 0, 0, { stack: undefined }), seat('b', 100)]);
    const res = bet(h, h.list[0], 50);
    expect(res.ok && res.patch).toMatchObject({ stack: 0, allIn: true, lastAction: { k: 'check', amt: 0 } });
  });
  it('takes a given kind', () => {
    const h = st([seat('a', 100), seat('b', 100)]);
    const res = bet(h, h.list[0], 20, [], 'raise');
    expect(res.ok && res.patch.lastAction).toEqual({ k: 'raise', amt: 20 });
  });
});

describe('fold', () => {
  it('folds a player who can act, nobody else', () => {
    const h = holdemState(room(), [seat('a', 100), seat('b', 100, 0, { folded: true })]);
    expect(fold(h, h.list[0])).toEqual({ ok: true, patch: { folded: true, lastAction: { k: 'fold' } } });
    expect(fold(h, h.list[1])).toEqual({ ok: false, reason: 'cannot-act' });
  });
});

describe('button and blinds', () => {
  const four = [seat('a', 100), seat('b', 100), seat('c', 100), seat('d', 100)];
  const pids = (x: { btn: Seat; sbP: Seat; bbP: Seat }) => [x.btn.pid, x.sbP.pid, x.bbP.pid];
  it('first hand: button on the first seat, blinds after it', () => {
    expect(pids(blindSeats(four, null))).toEqual(['a', 'b', 'c']);
  });
  it('moves one seat each hand and wraps around', () => {
    expect(pids(blindSeats(four, 'a'))).toEqual(['b', 'c', 'd']);
    expect(pids(blindSeats(four, 'c'))).toEqual(['d', 'a', 'b']);
    expect(pids(blindSeats(four, 'd'))).toEqual(['a', 'b', 'c']);
  });
  it('a button who left: starts again at the first seat', () => {
    expect(pids(blindSeats(four, 'gone'))).toEqual(['a', 'b', 'c']);
  });
  it('heads-up: the button posts the small blind', () => {
    const two = four.slice(0, 2);
    expect(pids(blindSeats(two, null))).toEqual(['a', 'a', 'b']);
    expect(pids(blindSeats(two, 'a'))).toEqual(['b', 'b', 'a']);
  });
  it('sitting out and empty stacks are skipped', () => {
    const list = [seat('a', 100), seat('b', 0), seat('c', 100, 0, { sittingOut: true }), seat('d', 100)];
    expect(activePlayers(list).map(p => p.pid)).toEqual(['a', 'd']);
  });
});

describe('newHand', () => {
  const idle = room({ stage: 'idle', handId: 3, streetId: 34, buttonPid: 'a' });
  it('posts the blinds and resets every active player', () => {
    const list = [seat('a', 100), seat('b', 100), seat('c', 100), seat('d', 0), seat('e', 50, 0, { sittingOut: true })];
    const res = newHand(idle, list);
    if (!res.ok) throw new Error(res.reason);
    expect(res.room).toEqual({
      handId: 4,
      streetId: 41,
      stage: 'preflop',
      potLevel: 0,
      buttonPid: 'b',
      sbPid: 'c',
      bbPid: 'a',
    });
    expect(res.posts).toEqual([
      {
        pid: 'a',
        patch: {
          handId: 4,
          streetId: 41,
          streetBet: 10,
          committed: 10,
          stack: 90,
          folded: false,
          allIn: false,
          lastAction: { k: 'blind', amt: 10 },
        },
      },
      {
        pid: 'b',
        patch: {
          handId: 4,
          streetId: 41,
          streetBet: 0,
          committed: 0,
          stack: 100,
          folded: false,
          allIn: false,
          lastAction: null,
        },
      },
      {
        pid: 'c',
        patch: {
          handId: 4,
          streetId: 41,
          streetBet: 5,
          committed: 5,
          stack: 95,
          folded: false,
          allIn: false,
          lastAction: { k: 'blind', amt: 5 },
        },
      },
    ]);
  });
  it('a blind bigger than the stack puts the player all-in', () => {
    const res = newHand(room({ stage: 'idle', buttonPid: null }), [seat('a', 100), seat('b', 3)]);
    if (!res.ok) throw new Error(res.reason);
    expect(res.posts[1].patch).toMatchObject({ streetBet: 3, committed: 3, stack: 0, allIn: true });
  });
  it('a room without blinds posts nothing that adds up (as before)', () => {
    const res = newHand({ stage: 'idle' }, [seat('a', 10), { pid: 'b', stack: 10 }, { pid: 'c' }]);
    expect(res.ok && Number.isNaN(res.posts[1].patch.streetBet)).toBe(true);
  });
  it('the first hand of a room is hand 1', () => {
    const res = newHand({ sb: 1, bb: 2, stage: 'idle' }, [seat('a', 10), seat('b', 10)]);
    expect(res.ok && res.room.handId).toBe(1);
    expect(res.ok && res.room.streetId).toBe(11);
  });
  it('refuses with fewer than two players who can play', () => {
    expect(newHand(idle, [seat('a', 100), seat('b', 0)])).toEqual({ ok: false, reason: 'too-few-players' });
  });
  it('refuses while chips are still in the pot', () => {
    const r = room({ stage: 'river' });
    expect(newHand(r, [seat('a', 90, 10), seat('b', 90, 10)])).toEqual({ ok: false, reason: 'pot-not-empty' });
  });
  it('a running hand with an empty pot may be replaced', () => {
    expect(newHand(room({ stage: 'flop', potLevel: 10 }), [seat('a', 90, 10), seat('b', 90, 10)]).ok).toBe(true);
  });
});

describe('nextStreet', () => {
  it('moves to the next street with a new street id', () => {
    expect(nextStreet(room({ stage: 'preflop', streetId: 11 }))).toEqual({
      ok: true,
      patch: { stage: 'flop', streetId: 12 },
    });
    expect(nextStreet(room({ stage: 'river', streetId: 14 }))).toEqual({
      ok: true,
      patch: { stage: 'showdown', streetId: 15 },
    });
    expect(nextStreet({ stage: 'turn' })).toEqual({ ok: true, patch: { stage: 'river', streetId: 1 } });
  });
  it('nothing after the showdown or between hands', () => {
    expect(nextStreet(room({ stage: 'showdown' })).ok).toBe(false);
    expect(nextStreet(room({ stage: 'idle' })).ok).toBe(false);
  });
});
