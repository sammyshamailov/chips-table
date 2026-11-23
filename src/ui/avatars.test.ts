import { describe, expect, it } from 'vitest';
import { AV_SET, avatarBg, hue, initial, validAv } from './avatars';

describe('validAv', () => {
  it('accepts every prepared character and small image data URLs', () => {
    for (const id of Object.keys(AV_SET)) expect(validAv({ k: 'set', v: id })).toBe(true);
    expect(validAv({ k: 'img', v: 'data:image/jpeg;base64,AAAA' })).toBe(true);
    expect(validAv({ k: 'img', v: 'data:image/webp;base64,AA==' })).toBe(true);
  });
  it('refuses unknown characters, inherited keys, other URLs, big images and junk', () => {
    expect(validAv({ k: 'set', v: 'nobody' })).toBe(false);
    expect(validAv({ k: 'set', v: 'toString' })).toBe(false);
    expect(validAv({ k: 'set', v: '__proto__' })).toBe(false);
    expect(validAv({ k: 'img', v: 'https://example.com/a.jpg' })).toBe(false);
    expect(validAv({ k: 'img', v: 'data:image/gif;base64,AAAA' })).toBe(false);
    expect(validAv({ k: 'img', v: 'data:image/jpeg;base64,' + 'A'.repeat(60000) })).toBe(false);
    for (const x of [null, undefined, 'tex', 3, {}, { k: 'set' }, { k: 'img', v: 5 }]) expect(validAv(x)).toBe(false);
  });
});

describe('the letter and its colour', () => {
  it('shows the first letter of the trimmed name, or ?', () => {
    expect(initial('  דנה')).toBe('ד');
    expect(initial('')).toBe('?');
    expect(initial('   ')).toBe('?');
    expect(initial(null)).toBe('?');
  });
  it('colours by player id, the same everywhere, only without a picture', () => {
    expect(hue('p_abc')).toBe(hue('p_abc'));
    expect(hue('p_abc')).toBeGreaterThanOrEqual(0);
    expect(hue('p_abc')).toBeLessThan(360);
    expect(avatarBg({ pid: 'p_abc' })).toBe(`background:hsl(${hue('p_abc')} 55% 68%)`);
    expect(avatarBg({ pid: 'p_abc', avatar: { k: 'set', v: 'tex' } })).toBe('');
  });
});
