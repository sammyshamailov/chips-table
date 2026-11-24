import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en';
import { he } from './he';
import {
  CATALOGS,
  storedEvent,
  eventText,
  formatChips,
  hasKey,
  joinNames,
  lang,
  pickLang,
  setLang,
  t,
  tIn,
  type Key,
} from './index';

afterEach(() => setLang('he'));

describe('catalogs', () => {
  it('have the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  });
  it('have no empty message and the same placeholders in every language', () => {
    const holes = (m: unknown) =>
      JSON.stringify(m)
        .match(/\{\w+\}/g)
        ?.filter((x, i, a) => a.indexOf(x) === i)
        .sort() ?? [];
    for (const k of Object.keys(he) as Key[]) {
      for (const c of Object.values(CATALOGS)) {
        const m = c[k];
        expect(typeof m === 'string' ? m.length : m.other.length, k).toBeGreaterThan(0);
      }
      expect(holes(en[k]), k).toEqual(holes(he[k]));
    }
  });
  it('keep every event line key', () => {
    // Stored in tables (lastEvent.key): phones on other versions read them. Removing one breaks their event line.
    const stored = Object.keys(he).filter(k => k.startsWith('ev.'));
    expect(stored).toEqual(
      expect.arrayContaining([
        'ev.opened',
        'ev.reopened',
        'ev.handStarted',
        'ev.flop',
        'ev.turn',
        'ev.river',
        'ev.showdown',
        'ev.award',
        'ev.handCancelled',
        'ev.dealt',
        'ev.roundPaid',
        'ev.bjPaid',
        'ev.roundCancelled',
        'ev.gameWin',
        'ev.gameTie',
        'ev.adjust',
        'ev.newDealer',
        'ev.toHoldem',
        'ev.toBlackjack',
      ]),
    );
  });
});

describe('t()', () => {
  it('speaks the language set', () => {
    expect(lang()).toBe('he');
    expect(t('room.players')).toBe(he['room.players']);
    setLang('en');
    expect(t('room.players')).toBe('Players');
  });
  it('fills placeholders: numbers as chip amounts, strings as they are', () => {
    setLang('en');
    expect(t('join.sit', { amt: 1500 })).toBe('Sit down with 1,500 chips');
    expect(t('toast.added', { name: '{name} 1000' })).toBe('{name} 1000 joined the table');
    expect(t('htable.blinds', { sb: 5 })).toBe('Blinds 5/{bb}');
  });
  it('joins lists of names in the language', () => {
    expect(tIn('he', 'ev.gameTie', { names: ['Dana', 'Yossi'], amt: 1000 })).toBe(
      he['ev.gameTie'].replace('{names}', 'Dana' + he['common.listLast'] + 'Yossi').replace('{amt}', '1,000'),
    );
    expect(tIn('en', 'ev.gameTie', { names: ['Dana', 'Yossi', 'Avi'], amt: 1000 })).toBe(
      'Game over · tied for first: Dana, Yossi and Avi with 1,000',
    );
  });
  it('picks plural forms by n', () => {
    expect(tIn('en', 'settle.missing', { n: 1 })).toBe('1 hand left to mark');
    expect(tIn('en', 'settle.missing', { n: 3 })).toBe('3 hands left to mark');
    expect(tIn('en', 'bjt.bettors', { n: 1, total: 4 })).toBe('1 of 4 has bet');
    expect(tIn('en', 'bjt.bettors', { n: 0, total: 4 })).toBe('0 of 4 have bet');
    expect(tIn('he', 'settle.missing', { n: 1 })).toBe(he['settle.missing'].replace('{n}', '1'));
  });
  it('uses Hebrew plural categories, including two', () => {
    // A Hebrew message with all three forms, as he.ts may have one.
    const msg = { one: 'one hand', two: 'two hands', other: '{n} hands' };
    const saved = CATALOGS.he;
    CATALOGS.he = { ...he, 'settle.missing': msg };
    try {
      expect([1, 2, 5].map(n => tIn('he', 'settle.missing', { n }))).toEqual(['one hand', 'two hands', '5 hands']);
    } finally {
      CATALOGS.he = saved;
    }
  });
});

describe('formatChips', () => {
  it('rounds and groups with Latin digits', () => {
    expect(formatChips(1234.6)).toBe('1,235');
    expect(formatChips(null)).toBe('0');
    expect(formatChips(-50)).toBe('-50');
  });
});

describe('joinNames', () => {
  it('handles none and one', () => {
    expect(joinNames([], 'en')).toBe('');
    expect(joinNames(['Dana'], 'en')).toBe('Dana');
    expect(joinNames(['a', 'b', 'c'], 'he')).toBe('a' + he['common.listSep'] + 'b' + he['common.listLast'] + 'c');
  });
});

describe('pickLang', () => {
  it('keeps the phone’s choice', () => {
    expect(pickLang('en', ['he-IL'], true)).toBe('en');
    expect(pickLang('he', ['en-US'], false)).toBe('he');
  });
  it('keeps Hebrew for a phone that used the app before', () => {
    expect(pickLang(null, ['en-US'], true)).toBe('he');
    expect(pickLang('fr', ['en-US'], true)).toBe('he');
  });
  it('first run: Hebrew when the phone lists Hebrew before English', () => {
    expect(pickLang(null, ['he-IL', 'en-US'], false)).toBe('he');
    expect(pickLang(null, ['iw'], false)).toBe('he');
    expect(pickLang(null, ['fr', 'he'], false)).toBe('he');
    expect(pickLang(null, ['en-US', 'he-IL'], false)).toBe('en');
    expect(pickLang(null, ['fr'], false)).toBe('en');
    expect(pickLang(null, [], false)).toBe('en');
  });
});

describe('event line', () => {
  it('is written with its key, parameters and the Hebrew text', () => {
    setLang('en');
    const e = storedEvent('ev.handStarted', { hand: 3, sb: 5, bb: 10 });
    const heText = he['ev.handStarted'].replace('{hand}', '3').replace('{sb}', '5').replace('{bb}', '10');
    expect(e).toEqual({ t: heText, key: 'ev.handStarted', p: { hand: 3, sb: 5, bb: 10 } });
  });
  it('is read in the phone’s language from its key', () => {
    setLang('en');
    expect(eventText({ t: 'old text', key: 'ev.handStarted', p: { hand: 3, sb: 5, bb: 10 } })).toBe(
      'Hand 3 started · blinds 5/10',
    );
  });
  it('falls back to the stored text without a key, with an unknown key or a key that is not an event', () => {
    setLang('en');
    expect(eventText({ t: he['ev.opened'] })).toBe(he['ev.opened']);
    expect(eventText({ t: 'something new', key: 'ev.fromTheFuture', p: {} })).toBe('something new');
    expect(eventText({ t: 'x', key: 'room.players' })).toBe('x');
    expect(eventText({ t: 'x', key: 'toString' })).toBe('x');
    expect(eventText(null)).toBe('');
  });
  it('writes the Hebrew text in Hebrew whatever the phone speaks', () => {
    setLang('en');
    expect(storedEvent('ev.roundPaid', { round: 4, house: '+150' }).t).toBe(
      he['ev.roundPaid'].replace('{round}', '4').replace('{house}', '+150'),
    );
    // the house's balance stays inside a left-to-right isolate, as the old version wrote it
    expect(he['ev.roundPaid']).toContain('\u2066{house}\u2069');
    expect(storedEvent('ev.adjust', { name: 'Dana', amt: '\u2212500' }).t).toBe(
      he['ev.adjust'].replace('{name}', 'Dana').replace('{amt}', '\u2212500'),
    );
  });
  it('knows its keys', () => {
    expect(hasKey('ev.opened')).toBe(true);
    expect(hasKey('nope')).toBe(false);
    expect(hasKey(3)).toBe(false);
  });
});
