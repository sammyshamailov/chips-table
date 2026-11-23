// normalizeRoom / normalizePlayer: documents of every shape the app has ever written, plus damaged ones.
import { describe, expect, it } from 'vitest';
import { normalizeAvatar, normalizeHand, normalizeLastAction, normalizePlayer, normalizeRoom } from './schema';

// A room as the first release created it (before hostName, roundEnd, closed, final, mode, appMin).
const ROOM_V1 = {
  code: 'ABCD',
  game: 'blackjack',
  startStack: 1000,
  sb: 5,
  bb: 10,
  minBet: 10,
  maxBet: 500,
  hostId: 'p_host',
  createdAt: 100,
  handId: 0,
  streetId: 0,
  stage: 'idle',
  potLevel: 0,
  buttonPid: null,
  roundId: 1,
  phase: 'betting',
  house: 0,
  dealerBJ: false,
  lastEvent: { t: 'השולחן נפתח', ts: 100 },
  updatedAt: 100,
};

// A player as the first release created one (before avatar, bjPaidRound, hands[i].chips and .paid).
const PLAYER_V1 = {
  name: 'Dana',
  joinedAt: 5,
  stack: 990,
  handId: 0,
  streetId: 0,
  streetBet: 0,
  committed: 0,
  folded: false,
  allIn: false,
  sittingOut: false,
  bjRound: 1,
  hands: [{ bet: 10 }],
  insurance: 0,
  surrendered: false,
  lastAction: { k: 'bet', amt: 10 },
  ts: 7,
};

describe('normalizeRoom', () => {
  it('fills in what the first release did not write, leaving roundEnd, mode and appMin absent', () => {
    const r = normalizeRoom(ROOM_V1);
    expect(r).toEqual({ ...ROOM_V1, hostName: '', sbPid: null, bbPid: null, closed: false, final: null });
    expect('roundEnd' in r || 'mode' in r || 'appMin' in r).toBe(false);
  });

  it("keeps today's fields as they are", () => {
    const today = {
      ...ROOM_V1,
      game: 'holdem',
      hostName: 'Avi',
      handId: 3,
      stage: 'flop',
      buttonPid: 'p_a',
      sbPid: 'p_b',
      bbPid: 'p_c',
      roundEnd: 'paid',
      closed: true,
      final: { at: 9, list: [{ pid: 'p_a', name: 'A', stack: 1200 }] },
      mode: 'chips',
      appMin: 0,
    };
    expect(normalizeRoom(today)).toEqual(today);
  });

  it('is unchanged by a second pass and leaves its input alone', () => {
    const input = JSON.parse(JSON.stringify(ROOM_V1));
    const once = normalizeRoom(input);
    expect(normalizeRoom(once)).toEqual(once);
    expect(input).toEqual(ROOM_V1);
  });

  it('turns nothing at all into a complete room with the values a new table starts with', () => {
    for (const raw of [undefined, null, 5, 'x', []]) {
      expect(normalizeRoom(raw)).toEqual({
        code: '',
        game: 'blackjack',
        startStack: 0,
        sb: 0,
        bb: 0,
        minBet: 0,
        maxBet: 0,
        hostId: '',
        hostName: '',
        createdAt: 0,
        updatedAt: 0,
        lastEvent: null,
        handId: 0,
        streetId: 0,
        stage: 'idle',
        potLevel: 0,
        buttonPid: null,
        sbPid: null,
        bbPid: null,
        roundId: 1,
        phase: 'betting',
        house: 0,
        dealerBJ: false,
        closed: false,
        final: null,
      });
    }
  });

  it('repairs damaged values', () => {
    const r = normalizeRoom({
      game: 'poker',
      sb: '5',
      bb: NaN,
      roundId: null,
      stage: 3,
      buttonPid: 7,
      closed: 1,
      lastEvent: 'x',
      final: { list: [null, { pid: 'p_a' }, 'x'] },
    });
    expect([r.game, r.sb, r.bb, r.roundId, r.stage, r.buttonPid, r.closed, r.lastEvent]).toEqual([
      'blackjack',
      0,
      0,
      1,
      'idle',
      null,
      true,
      null,
    ]);
    expect(r.final).toEqual({ at: 0, list: [{ pid: 'p_a', name: '', stack: 0 }] });
    expect(normalizeRoom({ lastEvent: { ts: 4 } }).lastEvent).toEqual({ t: '', ts: 4 });
  });

  it('keeps values and fields a newer phone may write', () => {
    const r = normalizeRoom({
      ...ROOM_V1,
      phase: 'cards',
      stage: 'cards',
      roundEnd: 'void',
      deckId: 'd1',
      mode: 'cards',
      appMin: 2,
    });
    expect([r.phase, r.stage, r.roundEnd, r.mode, r.appMin, (r as { deckId?: string }).deckId]).toEqual([
      'cards',
      'cards',
      'void',
      'cards',
      2,
      'd1',
    ]);
  });

  it('keeps the guard fields readable exactly as the guard always read them', () => {
    expect(normalizeRoom({ mode: null, appMin: null })).not.toHaveProperty('mode');
    expect(normalizeRoom({ mode: null, appMin: null })).not.toHaveProperty('appMin');
    expect(normalizeRoom({ appMin: '1' }).appMin).toBe(1);
    expect(normalizeRoom({ appMin: 'soon' }).appMin).toBeNaN();
    expect(normalizeRoom({ mode: ['chips'] }).mode).toBe('["chips"]');
    expect(normalizeRoom({ mode: 7 }).mode).toBe('7');
    expect(normalizeRoom({ roundEnd: 5 })).not.toHaveProperty('roundEnd');
  });
});

describe('normalizePlayer', () => {
  it('fills in what the first release did not write', () => {
    expect(normalizePlayer(PLAYER_V1)).toEqual({ ...PLAYER_V1, bjPaidRound: null, avatar: null });
  });

  it("keeps today's fields as they are", () => {
    const today = {
      ...PLAYER_V1,
      bjPaidRound: 1,
      hands: [
        { bet: 10, chips: [5, 5], result: 'bj', paid: true },
        { bet: 20, split: true, doubled: true, result: null },
      ],
      lastAction: { k: 'bet', amt: 10, chips: [5, 5] },
      avatar: { k: 'set', v: 'tex' },
    };
    expect(normalizePlayer(today)).toEqual(today);
  });

  it('turns nothing at all into a complete player', () => {
    expect(normalizePlayer(undefined)).toEqual({
      name: '',
      joinedAt: 0,
      stack: 0,
      sittingOut: false,
      handId: 0,
      streetId: 0,
      streetBet: 0,
      committed: 0,
      folded: false,
      allIn: false,
      bjRound: null,
      hands: [],
      insurance: 0,
      surrendered: false,
      bjPaidRound: null,
      lastAction: null,
      ts: 0,
      avatar: null,
    });
  });

  it('keeps bjRound null apart from a round number', () => {
    expect(normalizePlayer({ bjRound: null }).bjRound).toBeNull();
    expect(normalizePlayer({ bjRound: 0 }).bjRound).toBe(0);
    expect(normalizePlayer({ bjRound: 'x' }).bjRound).toBeNull();
  });

  it('repairs damaged values and leaves its input alone', () => {
    const input = { stack: '50', hands: 'x', folded: 'yes', lastAction: { amt: 5 }, avatar: { k: 'img' } };
    const copy = JSON.parse(JSON.stringify(input));
    const p = normalizePlayer(input);
    expect([p.stack, p.hands, p.folded, p.lastAction, p.avatar]).toEqual([0, [], true, null, null]);
    expect(input).toEqual(copy);
    expect(normalizePlayer({ hands: [null, { bet: 5 }, 3] }).hands).toEqual([{ bet: 5 }]);
  });

  it('keeps fields a newer phone may write, on the player and on its hands', () => {
    const p = normalizePlayer({ ...PLAYER_V1, cards: ['As'], hands: [{ bet: 10, faceDown: true }] });
    expect((p as { cards?: string[] }).cards).toEqual(['As']);
    expect(p.hands).toEqual([{ bet: 10, faceDown: true }]);
  });
});

describe('normalizeHand', () => {
  it('keeps the chips only when they add up to the bet', () => {
    expect(normalizeHand({ bet: 15, chips: [10, 5] })).toEqual({ bet: 15, chips: [10, 5] });
    expect(normalizeHand({ bet: 15, chips: [10] })).toEqual({ bet: 15 });
    expect(normalizeHand({ bet: 15, chips: [7, 8] })).toEqual({ bet: 15 });
    expect(normalizeHand({ bet: 15, chips: 'x' })).toEqual({ bet: 15 });
  });

  it('adds no flags that were not stored (a rewritten hand stays the same shape)', () => {
    expect(normalizeHand({ bet: 10 })).toEqual({ bet: 10 });
    expect(Object.keys(normalizeHand({ bet: 10, doubled: true }))).toEqual(['bet', 'doubled']);
  });

  it('repairs the bet and a result that is not text', () => {
    expect(normalizeHand({ chips: [5] })).toEqual({ bet: 0 });
    expect(normalizeHand({ bet: 5, result: 3 })).toEqual({ bet: 5 });
    expect(normalizeHand({ bet: 5, result: null })).toEqual({ bet: 5, result: null });
  });
});

describe('normalizeLastAction / normalizeAvatar', () => {
  it('needs a kind; drops an amount or chips that are not well-formed', () => {
    expect(normalizeLastAction(null)).toBeNull();
    expect(normalizeLastAction({ amt: 1 })).toBeNull();
    expect(normalizeLastAction({ k: 'won', amt: 5 })).toEqual({ k: 'won', amt: 5 });
    expect(normalizeLastAction({ k: 'won', amt: 'x', chips: 5 })).toEqual({ k: 'won' });
    expect(normalizeLastAction({ k: 'bet', amt: 7, chips: [5, 2] })).toEqual({ k: 'bet', amt: 7, chips: [5, 2] });
  });

  it('needs a kind and a value, both text', () => {
    expect(normalizeAvatar({ k: 'set', v: 'tex' })).toEqual({ k: 'set', v: 'tex' });
    expect(normalizeAvatar({ k: 'img', v: 5 })).toBeNull();
    expect(normalizeAvatar('tex')).toBeNull();
    expect(normalizeAvatar(null)).toBeNull();
  });
});
