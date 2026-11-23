/**
 * The dealer's narration: recorded Hebrew lines (`sounds/voice/<key>.mp3`), and when each one is said.
 *
 * Triggers come from the table's events, so every phone says them, not only the acting one. One line at a time: a
 * new line is dropped while one plays, except `winner` and `closed`, which wait their turn. The background is ducked
 * 6 dB while a line plays. `winner` is said by the ceremony at the reveal and `closed` by the "to the table" button.
 */
import type { EventBus } from '../sync/events';
import type { DomainEvent } from '../sync/domain-events';

export const VOICE_KEYS = [
  'open',
  'locked',
  'blackjack',
  'payout',
  'winner',
  'newhand',
  'flop',
  'turn',
  'river',
  'allin',
  'closed',
] as const;
export type VoiceKey = (typeof VOICE_KEYS)[number];
/** Speech RMS about −20 dBFS at the master. */
export const VOICE_LEVEL = 0.7;
export const voiceUrl = (k: string) => `sounds/voice/${k}.mp3`;

/** One dealer line: plays `buf` at time `t` on `dest`. Shared with tests/audio.js (offline rendering). */
export function playLine(
  c: BaseAudioContext,
  dest: AudioNode,
  buf: AudioBuffer,
  t: number,
  level: number,
): AudioBufferSourceNode {
  const s = c.createBufferSource();
  s.buffer = buf;
  const g = c.createGain();
  g.gain.value = level;
  s.connect(g);
  g.connect(dest);
  s.start(t);
  return s;
}

/** What the voice needs from the sound engine. */
export interface VoiceIO {
  /** Sound on and the AudioContext running. */
  ready(): boolean;
  ctx(): AudioContext | null;
  out(): AudioNode | null;
  fetchBuf(url: string): Promise<AudioBuffer>;
  /** Lower (true) or restore (false) the background. */
  duck(on: boolean): void;
  /** The narration setting. */
  enabled(): boolean;
}

export interface Voice {
  /** Starts loading the lines (each file once; a failed one is retried at most once a minute). */
  load(): void;
  say(key: string): void;
  stop(): void;
}

/** The narration player. */
export function createVoice(io: VoiceIO): Voice {
  const vox: Record<string, AudioBuffer> = {};
  const VOX = VOICE_KEYS.map(k => ({
    key: k as string,
    url: voiceUrl(k),
    buf: null as AudioBuffer | null,
    busy: false,
    failAt: 0,
  }));
  let voice: AudioBufferSourceNode | null = null;
  const queue: string[] = [];
  function load() {
    if (!io.ctx()) return;
    VOX.forEach(it => {
      if (it.buf || it.busy || Date.now() - it.failAt < 60000) return;
      it.busy = true;
      io.fetchBuf(it.url).then(
        b => {
          it.buf = b;
          it.busy = false;
          vox[it.key] = b;
        },
        () => {
          it.busy = true;
          it.failAt = Date.now();
          setTimeout(() => {
            it.busy = false;
          }, 60000);
        },
      );
    });
  }
  function playNext() {
    const ctx = io.ctx(),
      out = io.out();
    if (voice || !queue.length || !io.ready() || !io.enabled() || !ctx || !out) return;
    const key = queue.shift() as string,
      buf = vox[key];
    if (!buf) {
      playNext();
      return;
    }
    const s = playLine(ctx, out, buf, ctx.currentTime + 0.02, VOICE_LEVEL);
    voice = s;
    io.duck(true);
    s.onended = () => {
      if (voice === s) voice = null;
      io.duck(false);
      setTimeout(playNext, 250);
    };
  }
  return {
    load,
    say(key) {
      if (!io.ready() || !io.enabled() || !(VOICE_KEYS as readonly string[]).includes(key)) return;
      load();
      if (!vox[key]) return;
      if (voice) {
        if ((key === 'winner' || key === 'closed') && !queue.includes(key)) queue.push(key);
        return;
      }
      queue.push(key);
      playNext();
    },
    stop() {
      queue.length = 0;
      if (voice) {
        const s = voice;
        voice = null;
        try {
          s.onended = null;
          s.stop();
        } catch {
          // already stopped
        }
        io.duck(false);
      }
    },
  };
}

/** The narration triggers, as subscribers to the table's events. Subscribe after the effects (fx/), as it always ran. */
export function subscribeNarration(bus: EventBus<DomainEvent>, say: (key: VoiceKey) => void): void {
  let allinHand: number | undefined; // "all-in" once per hand, on this phone
  bus.on('BlackjackPaid', { before: () => void setTimeout(() => say('blackjack'), 400) });
  bus.on('WentAllIn', {
    before: e => {
      if (allinHand === e.handId) return;
      allinHand = e.handId;
      setTimeout(() => say('allin'), 350);
    },
  });
  bus.on('BetsLocked', { after: () => say('locked') });
  bus.on('RoundPaid', {
    after: () => {
      say('payout');
      setTimeout(() => say('open'), 2500); // then the dealer opens the next round
    },
  });
  bus.on('HandStarted', { after: () => say('newhand') });
  bus.on('StreetDealt', { after: e => say(e.stage) });
}
