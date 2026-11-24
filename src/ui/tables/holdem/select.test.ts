import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizePlayer, normalizeRoom } from '../../../data/schema';
import { holdemState } from '../../../domain/holdem/rules';
import type { Override } from '../../../fx/layer';
import { setLang } from '../../../i18n';
import { actionText } from '../../labels';
import type { SeatView, Session } from '../../session';
import { holdemChoices, holdemDockProps, holdemHostProps, holdemStatus, holdemTableProps, seatTags } from './select';

// A hand in progress: hand 2, street 21 (preflop), blinds 5/10, button a, small blind b, big blind c.
const HAND = { handId: 2, streetId: 21, stage: 'preflop', buttonPid: 'a', sbPid: 'b', bbPid: 'c' };
const inHand = (more = {}) => ({ handId: 2, streetId: 21, ...more });

// The words are checked in English (the Hebrew screens are checked pixel by pixel, tests/visual.js).
beforeAll(() => setLang('en'));
afterAll(() => setLang('he'));

function session(
  room: Record<string, unknown>,
  players: Record<string, Record<string, unknown>>,
  { myId = 'a', mode = 'cloud', ov = {} as Record<string, Override>, pending = 0 } = {},
): Session {
  const r = normalizeRoom({ code: 'ABCD', game: 'holdem', hostId: 'a', hostName: 'Sam', sb: 5, bb: 10, ...room });
  const ps: SeatView[] = Object.entries(players).map(([pid, d], i) => ({
    pid,
    ...normalizePlayer({ name: pid, stack: 1000, joinedAt: i, ...d }),
  }));
  const state = {
    myId,
    mode,
    room: r,
    players: Object.fromEntries(ps.map(p => [p.pid, p])),
    pending,
  } as unknown as Session['state'];
  const partial: Partial<Session> = {
    state,
    fx: {
      ov: pid => ov[pid] || null,
      shownStack: p => (ov[p.pid] && ov[p.pid].stack != null ? (ov[p.pid].stack as number) : (p.stack as number)),
      ghost: () => [],
      signDrop: () => false,
    },
    denoms: () => [5, 10, 25],
    players: () => ps,
    me: () => ps.find(p => p.pid === myId) || null,
    holdem: () => holdemState(r, ps),
    looksClosed: () => false,
  };
  return partial as Session;
}
const seats = (s: Session) => holdemTableProps(s).seats;
const tagsOf = (s: Session, pid: string) => seatTags(s.holdem(), s.players().find(p => p.pid === pid) as SeatView);
const texts = (s: Session, pid: string) => tagsOf(s, pid).map(t => t.text);

describe("Hold'em table: what each row shows", () => {
  it('marks the button and, before the flop, the blinds', () => {
    const s = session(HAND, { a: inHand(), b: inHand({ streetBet: 5 }), c: inHand({ streetBet: 10 }) });
    expect(tagsOf(s, 'a')).toEqual([{ cls: 'btn-d', text: 'D' }]);
    expect(texts(s, 'b')).toEqual(['SB']);
    expect(texts(s, 'c')).toEqual(['BB']);
    const flop = session({ ...HAND, stage: 'flop', streetId: 22 }, { a: inHand(), b: inHand(), c: inHand() });
    expect(texts(flop, 'b')).toEqual([]);
    expect(texts(flop, 'a')).toEqual(['D']);
  });
  it('marks a fold (and dims the row), an all-in, a break and a player waiting for the next hand', () => {
    const s = session(HAND, {
      a: inHand({ folded: true }),
      b: inHand({ allIn: true }),
      c: inHand({ allIn: true, folded: true }),
      d: { sittingOut: true },
      e: {},
    });
    expect(tagsOf(s, 'a')).toEqual([
      { cls: 'btn-d', text: 'D' },
      { cls: 'fold', text: 'Folded' },
    ]);
    expect(tagsOf(s, 'b')).toEqual([{ text: 'SB' }, { cls: 'allin', text: 'ALL-IN' }]);
    expect(texts(s, 'c')).toEqual(['BB', 'Folded']);
    expect(texts(s, 'd')).toEqual(['On a break']);
    expect(texts(s, 'e')).toEqual(['Joins next hand']);
    expect(seats(s).map(x => x.out)).toEqual([true, false, true, false, false]);
  });
  it('tags nobody between hands, except a player on a break', () => {
    const s = session({ ...HAND, stage: 'idle' }, { a: inHand(), b: { sittingOut: true } });
    expect(texts(s, 'a')).toEqual([]);
    expect(texts(s, 'b')).toEqual(['On a break']);
  });
  it("shows this street's bet, the shown stack and the last action during the hand, and a win after it", () => {
    const s = session(
      HAND,
      {
        a: inHand({ streetBet: 30, stack: 970, lastAction: { k: 'raise', amt: 30 } }),
        b: { lastAction: { k: 'call', amt: 10 } },
      },
      { ov: { a: { stack: 1000 } } },
    );
    expect(seats(s)[0]).toMatchObject({ streetBet: 30, stack: 1000, action: 'Raised to 30', mine: true, host: true });
    expect(seats(s)[1]).toMatchObject({ streetBet: 0, action: '' });
    const after = session({ ...HAND, stage: 'idle' }, { a: { lastAction: { k: 'won', amt: 130 } }, b: inHand() });
    expect(seats(after).map(x => x.action)).toEqual(['Won 130', '']);
    const old = session(HAND, { a: inHand({ streetId: 11, streetBet: 40 }) });
    expect(seats(old)[0].streetBet).toBe(0);
  });
  it('offers "play as" for everyone else in single-device mode only', () => {
    const local = session(HAND, { a: {}, b: {} }, { mode: 'local' });
    expect(seats(local).map(x => x.claim)).toEqual([false, true]);
    expect(seats(session(HAND, { a: {}, b: {} })).map(x => x.claim)).toEqual([false, false]);
  });
  it("adds the dealer's own row only when the dealer doesn't play", () => {
    expect(holdemTableProps(session(HAND, { a: {}, b: {} })).dealer).toBeNull();
    const t = holdemTableProps(session({ hostId: 'h', hostName: '' }, { a: {} }, { myId: 'h' }));
    expect(t.dealer).toEqual({ pid: 'h', name: 'Dealer', letterName: 'D', mine: true });
  });
  it('turns over the board cards street by street, none between hands', () => {
    const cards = (stage: string) => holdemTableProps(session({ ...HAND, stage }, {})).cards;
    expect(['idle', 'preflop', 'flop', 'turn', 'river', 'showdown'].map(cards)).toEqual([0, 0, 3, 4, 5, 5]);
  });
  it("shows the pot and the street's highest bet", () => {
    const t = holdemTableProps(
      session(HAND, { a: inHand({ committed: 30, streetBet: 30 }), b: inHand({ committed: 5 }) }),
    );
    expect(t).toMatchObject({ pot: 35, streetBet: 30, stage: 'preflop', handId: 2 });
  });
});

describe("Hold'em dock", () => {
  const status = (room: Record<string, unknown>, me: Record<string, unknown>) =>
    holdemStatus(session(room, { a: me }).holdem(), session(room, { a: me }).me() as SeatView);
  it('says why you cannot act', () => {
    expect(status(HAND, { sittingOut: true })).toBe("You're on a break. Come back from the Players menu.");
    expect(status({ ...HAND, stage: 'idle' }, {})).toBe('Waiting for the next hand');
    expect(status(HAND, {})).toBe("You'll join the next hand");
    expect(status(HAND, inHand({ folded: true }))).toBe('You folded this hand');
    expect(status(HAND, inHand({ allIn: true }))).toBe("You're all in. Good luck.");
    expect(status({ ...HAND, stage: 'showdown' }, inHand())).toBe('Showdown. Waiting for the dealer to award the pot.');
    expect(status(HAND, inHand())).toBeNull();
  });
  it('has no controls while you cannot act', () => {
    const d = holdemDockProps(session(HAND, { a: inHand({ folded: true }) }, { pending: 25 }));
    expect(d).toMatchObject({
      go: null,
      presets: [],
      pending: 25,
      status: 'You folded this hand',
      denoms: [5, 10, 25],
    });
  });

  // You (a) are the button, facing the big blind's 10; the small blind put in 5.
  const facing = (pending: number, me = {}) => {
    const s = session(
      HAND,
      { a: inHand(me), b: inHand({ streetBet: 5, committed: 5 }), c: inHand({ streetBet: 10, committed: 10 }) },
      { pending },
    );
    return holdemChoices(s.holdem(), s.me() as SeatView, pending);
  };
  it('names the main button after the chips in your hand', () => {
    expect(facing(0).go).toEqual({ label: 'Call 10', disabled: false, amount: 10 });
    expect(facing(5).go).toEqual({ label: '5 short of a call', disabled: true, amount: 5 });
    expect(facing(10).go).toEqual({ label: 'Call 10', disabled: false, amount: 10 });
    expect(facing(15).go).toEqual({ label: 'Raise at least to 20', disabled: true, amount: 15 });
    expect(facing(25).go).toEqual({ label: 'Raise to 25', disabled: false, amount: 25 });
    expect(facing(1000).go).toEqual({ label: 'All in 1,000', disabled: false, amount: 1000 });
    expect(facing(0, { stack: 8 }).go).toEqual({ label: 'All in 8', disabled: false, amount: 8 });
  });
  it('checks or bets when nothing is bet on the street', () => {
    const s = (pending: number) => {
      const x = session({ ...HAND, stage: 'flop', streetId: 22 }, { a: inHand({ streetId: 22 }) }, { pending });
      return holdemChoices(x.holdem(), x.me() as SeatView, pending);
    };
    expect(s(0).go.label).toBe('Check');
    expect(s(20).go.label).toBe('Bet 20');
    expect(s(0).presets.map(([t]) => t)).toEqual(['Min', '½ pot', 'Pot', 'All in']);
  });
  it('offers call, minimum raise, half the pot, the pot and all-in', () => {
    // pot 15, to call 10: half the pot raises to 10 + round(25 / 2) = 23 (at least the minimum, 20), the pot to 35.
    expect(facing(0).presets).toEqual([
      ['Call', 10],
      ['Min', 20],
      ['½ pot', 23],
      ['Pot', 35],
      ['All in', 1000],
    ]);
    expect(facing(0, { stack: 15 }).presets).toEqual([
      ['Call', 10],
      ['Min', 15],
      ['½ pot', 15],
      ['Pot', 15],
      ['All in', 15],
    ]);
  });
  it('shows your chips as the effects show them', () => {
    const d = holdemDockProps(session(HAND, { a: inHand({ stack: 900 }) }, { ov: { a: { stack: 950 } } }));
    expect(d.stack).toBe(950);
  });
});

describe("Hold'em dealer controls", () => {
  it('offers the pot to the last player when everyone else folded', () => {
    const s = session(HAND, {
      a: inHand({ folded: true }),
      b: inHand({ committed: 5 }),
      c: inHand({ committed: 10, folded: true }),
    });
    expect(holdemHostProps(s)).toEqual({ stage: 'preflop', pot: 15, solo: { pid: 'b', name: 'b' } });
  });
  it('has no one-tap winner while two are in the hand, or with an empty pot', () => {
    expect(holdemHostProps(session(HAND, { a: inHand({ committed: 5 }), b: inHand() })).solo).toBeNull();
    expect(holdemHostProps(session(HAND, { a: inHand(), b: inHand({ folded: true }) })).solo).toBeNull();
  });
});

describe('actionText', () => {
  it("says each Hold'em action with its amount", () => {
    const say = (k: string, amt?: number) => actionText({ k, amt });
    expect([say('fold'), say('check'), say('call', 10), say('raise', 1200), say('bet', 20)]).toEqual([
      'Folded',
      'Checked',
      'Called 10',
      'Raised to 1,200',
      'Bet 20',
    ]);
    expect([say('allin', 300), say('blind', 5), say('won', 130), say('refund', 15)]).toEqual([
      'All in 300',
      'Blind 5',
      'Won 130',
      'Got back 15',
    ]);
    expect([say('bjres', 20), say('bjres', -20), say('bjres', 0)]).toEqual(['Won 20', 'Lost 20', 'Push']);
  });
  it('says nothing for no action or an unknown one', () => {
    expect(actionText(null)).toBe('');
    expect(actionText({ k: 'tap' })).toBe('');
    expect(actionText({ k: 'toString' })).toBe('');
  });
});
