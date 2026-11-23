/**
 * The casino background: a quiet steady murmur of people, plus a slot machine now and then.
 *
 * The bed (sounds/amb/crowd-bed.mp3, generated speech-like murmur, no clear words) loops quietly under everything;
 * every 10-25 s one slot-machine one-shot plays on top. The owner liked the style of the generated talk clips, so the
 * bed is made in that style, and it sits 6 dB under how loud those clips were. Files: sounds/amb/*.mp3 (see
 * sounds/CREDITS.md). Works on any AudioContext, including an OfflineAudioContext for tests/audio.js.
 */

export const AMB_BASE = 'sounds/amb/';
/** Machines peak about −20 dBFS at the master. */
export const AMB_LEVEL = 0.045;
export const AMB_MAKEUP = 1;
/** The bed (a −20 dBFS file) sits at about −41 dBFS at the master (both channels). */
export const AMB_BED = 0.0753;

export type ClipKind = 'bed' | 'machine';
export const AMB_MANIFEST: { kind: ClipKind; url: string }[] = [
  { kind: 'bed' as ClipKind, url: `${AMB_BASE}crowd-bed.mp3` },
].concat([1, 2, 3, 4].map(i => ({ kind: 'machine' as ClipKind, url: `${AMB_BASE}machine-${i}.mp3` })));

/** A background clip; `buf` is null until it has loaded. */
export interface AmbienceClip {
  kind: ClipKind;
  url: string;
  buf: AudioBuffer | null;
}

export interface AmbiencePlayer {
  /** Starts the bed once it has loaded and schedules machines up to `until` (context time). */
  sched(until: number): void;
  stop(): void;
  /** How many machine one-shots were scheduled. */
  readonly events: number;
}

// Make the decoded bed loop cleanly: skip any silence the MP3 decoder leaves at the ends (some browsers do), then
// crossfade the last 50 ms into the first 50 ms. MP3 changes the edges slightly, so without this there's a faint
// click every time the loop repeats. Done once per buffer; returns [loopStart, loopEnd] in seconds.
const LOOPS = new WeakMap<AudioBuffer, [number, number]>();
export function loopBounds(buf: AudioBuffer): [number, number] {
  const known = LOOPS.get(buf);
  if (known) return known;
  const sr = buf.sampleRate,
    d0 = buf.getChannelData(0),
    lim = Math.min(d0.length, Math.floor(sr * 0.3));
  let a = 0,
    b = d0.length;
  while (a < lim && Math.abs(d0[a]) < 1e-4) a++;
  while (b > d0.length - lim && Math.abs(d0[b - 1]) < 1e-4) b--;
  const k = Math.min(Math.floor(sr * 0.05), Math.floor((b - a) / 4));
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < k; i++) {
      const t = ((i / k) * Math.PI) / 2;
      d[a + i] = d[a + i] * Math.sin(t) + d[b - k + i] * Math.cos(t);
    }
  }
  const r: [number, number] = [a / sr, (b - k) / sr];
  LOOPS.set(buf, r);
  return r;
}

/**
 * The background player on context `c`, into `dest`. `clips` is read on every pick, so clips that finish loading
 * later are used too.
 */
export function Ambience(c: BaseAudioContext, dest: AudioNode, level: number, clips: AmbienceClip[]): AmbiencePlayer {
  const T0 = c.currentTime,
    sr = c.sampleRate,
    rnd = (a: number, b: number) => a + Math.random() * (b - a);
  // events are peaky (a coin drop, a laugh): a gentle compressor evens them out so they can be heard without a high peak
  const bus = c.createGain(),
    cmp = c.createDynamicsCompressor(),
    mk = c.createGain();
  cmp.threshold.value = -42;
  cmp.knee.value = 12;
  cmp.ratio.value = 8;
  cmp.attack.value = 0.005;
  cmp.release.value = 0.25;
  mk.gain.value = AMB_MAKEUP;
  bus.connect(cmp);
  cmp.connect(mk);
  mk.connect(dest);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6000;
  lp.Q.value = 0.5;
  const room = c.createGain();
  room.gain.value = 1;
  const dry = c.createGain(),
    wet = c.createGain();
  dry.gain.value = 1;
  wet.gain.value = 0.25;
  bus.gain.value = 1;
  room.connect(lp);
  lp.connect(dry);
  dry.connect(bus);
  try {
    // a light generated reverb, about 1.2 s
    const n = Math.floor(sr * 1.2),
      ir = c.createBuffer(2, n, sr);
    let en = 0;
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp((-5 * i) / n);
        en += d[i] * d[i];
      }
    }
    const k = 1 / Math.sqrt(en / 2);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] *= k;
    }
    const cv = c.createConvolver();
    cv.buffer = ir;
    lp.connect(cv);
    cv.connect(wet);
    wet.connect(bus);
  } catch {
    // no reverb
  }
  // the bed: one looped source straight to the destination (not through the event compressor), faded in over 3 s
  let bedG: GainNode | null = null,
    bedSrc: AudioBufferSourceNode | null = null;
  let next = T0 + rnd(4, 8),
    busyUntil = T0,
    last: AmbienceClip | null = null,
    live: AudioBufferSourceNode[] = [],
    dead = false,
    count = 0;
  function startBed() {
    const it = clips.find(x => x.kind === 'bed' && x.buf);
    if (!it || !it.buf || bedSrc || dead) return;
    const [a, b] = loopBounds(it.buf),
      t = c.currentTime;
    bedG = c.createGain();
    bedG.gain.setValueAtTime(0, t);
    bedG.gain.linearRampToValueAtTime(AMB_BED, t + 3);
    bedG.connect(dest);
    bedSrc = c.createBufferSource();
    bedSrc.buffer = it.buf;
    bedSrc.loop = true;
    bedSrc.loopStart = a;
    bedSrc.loopEnd = b;
    bedSrc.connect(bedG);
    bedSrc.start(t, a + Math.random() * Math.max(0, b - a - 1)); // phones at one table don't play in step
  }
  function pick(): AmbienceClip | null {
    const list = clips.filter(x => x.buf && x.kind === 'machine' && x !== last);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  function sched(until: number) {
    if (dead) return;
    startBed();
    while (next < until) {
      const clip = pick();
      if (!clip || !clip.buf) return; // nothing loaded yet: try again at the next call
      const t = Math.max(next, busyUntil, c.currentTime),
        d = clip.buf.duration,
        quiet = 1;
      const src = c.createBufferSource();
      src.buffer = clip.buf;
      const g = c.createGain(),
        peak = level * quiet * Math.pow(10, rnd(-3, 3) / 20);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.03);
      g.gain.setValueAtTime(peak, Math.max(t + 0.03, t + d - 0.08));
      g.gain.linearRampToValueAtTime(0, t + d);
      src.connect(g);
      let n: AudioNode = g;
      try {
        const p = c.createStereoPanner();
        p.pan.value = rnd(-0.8, 0.8);
        g.connect(p);
        n = p;
      } catch {
        // no panner: centred
      }
      n.connect(room);
      src.start(t);
      live.push(src);
      src.onended = () => {
        live = live.filter(x => x !== src);
        try {
          n.disconnect();
          g.disconnect();
        } catch {
          // already disconnected
        }
      };
      last = clip;
      busyUntil = t + d;
      next = t + rnd(10, 25);
      if (next < busyUntil) next = busyUntil;
      count++;
    }
  }
  function stop() {
    dead = true;
    const t = c.currentTime;
    try {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 0.4);
    } catch {
      // context closing
    }
    try {
      if (bedG) {
        bedG.gain.cancelScheduledValues(t);
        bedG.gain.setValueAtTime(bedG.gain.value, t);
        bedG.gain.linearRampToValueAtTime(0, t + 0.6);
      }
    } catch {
      // context closing
    }
    setTimeout(() => {
      live.forEach(x => {
        try {
          x.stop();
        } catch {
          // already stopped
        }
      });
      live = [];
      try {
        bus.disconnect();
      } catch {
        // already disconnected
      }
      try {
        if (bedSrc) bedSrc.stop();
      } catch {
        // already stopped
      }
      try {
        if (bedG) bedG.disconnect();
      } catch {
        // already disconnected
      }
    }, 800);
  }
  return {
    sched,
    stop,
    get events() {
      return count;
    },
  };
}
