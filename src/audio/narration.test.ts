import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVoice, voiceUrl } from './narration';

/** A narration player on a fake audio context: records the files fetched and the buffer each line played. */
function setup(files: Set<string>, lang = { l: 'en' }) {
  const fetched: string[] = [],
    played: string[] = [];
  const ctx = {
    currentTime: 0,
    createBufferSource: () => {
      const s = {
        buffer: null as unknown as { url: string } | null,
        connect() {},
        start() {
          played.push((s.buffer as { url: string }).url);
        },
        stop() {},
        onended: null as null | (() => void),
      };
      return s;
    },
    createGain: () => ({ gain: { value: 0 }, connect() {} }),
  } as unknown as AudioContext;
  const voice = createVoice({
    ready: () => true,
    ctx: () => ctx,
    out: () => ({}) as AudioNode,
    fetchBuf: url => {
      fetched.push(url);
      return files.has(url) ? Promise.resolve({ url } as unknown as AudioBuffer) : Promise.reject(new Error('404'));
    },
    duck: () => {},
    enabled: () => true,
    lang: () => lang.l,
  });
  return { voice, fetched, played, lang };
}

const flush = () => new Promise(r => setTimeout(r, 0));

afterEach(() => vi.useRealTimers());

describe('narration languages', () => {
  it('keeps the Hebrew lines at their old path and puts other languages in a folder', () => {
    expect(voiceUrl('open')).toBe('sounds/voice/open.mp3');
    expect(voiceUrl('open', 'he')).toBe('sounds/voice/open.mp3');
    expect(voiceUrl('open', 'en')).toBe('sounds/voice/en/open.mp3');
  });

  it("loads and says the phone's language", async () => {
    const { voice, fetched, played } = setup(new Set(['sounds/voice/en/open.mp3']));
    voice.load();
    await flush();
    expect(fetched).toContain('sounds/voice/en/open.mp3');
    expect(fetched).not.toContain('sounds/voice/open.mp3');
    voice.say('open');
    expect(played).toEqual(['sounds/voice/en/open.mp3']);
  });

  it('falls back to the Hebrew line when the English one is missing', async () => {
    const { voice, fetched, played } = setup(new Set(['sounds/voice/locked.mp3']));
    voice.load();
    await flush();
    await flush();
    expect(fetched).toContain('sounds/voice/locked.mp3');
    voice.say('locked');
    expect(played).toEqual(['sounds/voice/locked.mp3']);
  });

  it('loads the new language after a switch', async () => {
    const both = new Set(['sounds/voice/open.mp3', 'sounds/voice/en/open.mp3']);
    const { voice, fetched, played, lang } = setup(both, { l: 'he' });
    voice.load();
    await flush();
    expect(fetched.filter(u => u.includes('/en/'))).toEqual([]);
    lang.l = 'en';
    voice.say('open'); // the switch's first line: not loaded yet, so nothing is said, and loading starts
    await flush();
    expect(played).toEqual([]);
    expect(fetched).toContain('sounds/voice/en/open.mp3');
    voice.say('open');
    expect(played).toEqual(['sounds/voice/en/open.mp3']);
  });
});
