/**
 * The sound engine: one AudioContext, created on the first touch (browsers require it), with the master chain
 * (gain .8 into a compressor). Effects are synthesized (chip clacks are short band-passed noise plus a click; the bell,
 * drumroll, fanfare and applause are oscillators and filtered noise), so nothing is downloaded for them. It also runs
 * the casino background (ambience.ts) and the dealer's voice (narration.ts) on the same context.
 *
 * Settings, stored on the phone: `chips.sound` (everything), `chips.ambi` (background), `chips.voice` (narration).
 */
import type { KeyValue } from '../data/local-store';
import { lang } from '../i18n';
import { AMB_LEVEL, AMB_MANIFEST, Ambience, type AmbienceClip, type AmbiencePlayer } from './ambience';
import { createVoice } from './narration';

export interface SoundDeps {
  storage: KeyValue;
  /** Called when the context starts running and when sound is switched on or off (the background follows). */
  sync: () => void;
}

export type Sound = ReturnType<typeof createSound>;

type ClipItem = AmbienceClip & { busy: boolean; failAt: number };

/** The engine. Creating it plays nothing and creates no AudioContext. */
export function createSound(deps: SoundDeps) {
  const AC =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const store = deps.storage;
  let ctx: AudioContext | null = null,
    out: GainNode | null = null,
    nbuf: AudioBuffer | null = null,
    on = store.get('chips.sound') !== '0',
    lastT = 0,
    burst = 0,
    amb: AmbiencePlayer | null = null,
    ambTimer: ReturnType<typeof setInterval> | undefined,
    bgBus: GainNode | null = null,
    ambiOn = store.get('chips.ambi') !== '0',
    voiceOn = store.get('chips.voice') !== '0';
  const bgClips: AmbienceClip[] = [];
  // Clips load the first time they are wanted (then the service worker keeps them). A missing or broken file
  // is skipped and tried again at most once a minute.
  const decode = (ab: ArrayBuffer) =>
    new Promise<AudioBuffer>((ok, no) => {
      const p = (ctx as AudioContext).decodeAudioData(ab, ok, no);
      if (p && p.then) p.then(ok, no);
    });
  const fetchBuf = (url: string) =>
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then(decode);
  const BG_ITEMS: ClipItem[] = AMB_MANIFEST.map(m => ({ kind: m.kind, url: m.url, buf: null, busy: false, failAt: 0 }));
  function loadBg() {
    if (!ctx) return;
    BG_ITEMS.forEach(it => {
      if (it.buf || it.busy || Date.now() - it.failAt < 60000) return;
      it.busy = true;
      fetchBuf(it.url).then(
        b => {
          it.buf = b;
          it.busy = false;
          if (!bgClips.includes(it)) bgClips.push(it);
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
  function duck(down: boolean) {
    if (!bgBus || !ctx) return;
    const t = ctx.currentTime;
    try {
      bgBus.gain.cancelScheduledValues(t);
      bgBus.gain.setValueAtTime(bgBus.gain.value, t);
      bgBus.gain.linearRampToValueAtTime(down ? 0.5 : 1, t + (down ? 0.15 : 0.5));
    } catch {
      // context closing
    }
  }
  const ready = () => on && !!ctx && ctx.state === 'running';
  const voice = createVoice({
    ready,
    ctx: () => ctx,
    out: () => out,
    fetchBuf,
    duck,
    enabled: () => voiceOn,
    lang: () => lang(),
  });
  function init() {
    if (!AC || !on) return;
    try {
      if (!ctx) {
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 4;
        out = ctx.createGain();
        out.gain.value = 0.8;
        out.connect(comp);
        comp.connect(ctx.destination);
        nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = nbuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended')
        ctx.resume().then(
          () => deps.sync(),
          () => {},
        );
    } catch {
      // no audio on this phone
    }
  }
  // The building blocks. They run only when ready(), so ctx, out and nbuf exist.
  const C = () => ctx as AudioContext;
  function env(g: GainNode, t: number, peak: number, a: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function noise(
    t: number,
    d: number,
    f: number,
    q: number,
    peak: number,
    type: BiquadFilterType = 'bandpass',
    f2?: number | null,
    dst: AudioNode = out as AudioNode,
  ) {
    const c = C(),
      s = c.createBufferSource();
    s.buffer = nbuf;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    fl.Q.value = q;
    const g = c.createGain();
    env(g, t, peak, 0.002, d);
    s.connect(fl);
    fl.connect(g);
    g.connect(dst);
    s.start(t, Math.random() * 0.8);
    s.stop(t + d + 0.05);
  }
  function tone(
    t: number,
    f: number,
    d: number,
    peak: number,
    type: OscillatorType = 'sine',
    f2?: number | null,
    a = 0.005,
    dst: AudioNode = out as AudioNode,
  ) {
    const c = C(),
      o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = c.createGain();
    env(g, t, peak, a, d);
    o.connect(g);
    g.connect(dst);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }
  // one clay chip landing on another: a bright, very short click with a little body
  function clack(t: number, v = 1, dst: AudioNode = out as AudioNode, lo = 2800, span = 2400) {
    const f = lo + Math.random() * span;
    noise(t, 0.026, f, 5, 0.5 * v, 'bandpass', null, dst);
    tone(t, f * 1.55, 0.016, 0.06 * v, 'triangle', null, 0.005, dst);
    noise(t + 0.003, 0.05, 1300 + Math.random() * 500, 9, 0.1 * v, 'bandpass', null, dst);
  }
  // A player somewhere at the table playing with their chips: quieter, panned to one side, slightly duller.
  function ambBus() {
    const c = C(),
      g = c.createGain();
    g.gain.value = 0.42;
    let n: AudioNode = g;
    try {
      const p = c.createStereoPanner();
      p.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.45);
      g.connect(p);
      n = p;
    } catch {
      // no panner: centred
    }
    n.connect(out as AudioNode);
    return g;
  }
  const AMB: ((t: number, bus: AudioNode) => void)[] = [
    (t, bus) => {
      // riffle: two stacks pushed into each other, chips interleaving fast
      const n = 14 + Math.floor(Math.random() * 10);
      for (let i = 0; i < n; i++) {
        clack(t, 0.55 + Math.random() * 0.35, bus, 2200, 1600);
        t += 0.022 + Math.random() * 0.014;
      }
      clack(t + 0.06, 0.5, bus, 2000, 900);
      clack(t + 0.1, 0.3, bus, 2000, 900);
    },
    (t, bus) => {
      // lifting a few chips and letting them drop back on the stack
      const k = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < k; j++) {
        let u = t + j * (0.34 + Math.random() * 0.2);
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
          clack(u, 0.7 - i * 0.1, bus);
          u += 0.03 + Math.random() * 0.02;
        }
      }
    },
    (t, bus) => {
      // counting chips one by one off a stack
      const n = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        clack(t, 0.6 + Math.random() * 0.3, bus, 2600, 2000);
        t += 0.16 + Math.random() * 0.12;
      }
    },
  ];
  const notes = (t: number, list: number[], gap: number, d: number, peak: number, type: OscillatorType = 'triangle') =>
    list.forEach((f, i) => {
      tone(t + i * gap, f, d, peak, type);
      tone(t + i * gap, f * 2, d * 0.6, peak * 0.25, 'sine');
    });
  const api = {
    init,
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      store.set('chips.sound', on ? '1' : '0');
      if (on) {
        init();
        setTimeout(() => api.chips(3), 60);
      } else api.voiceStop();
      deps.sync();
      return on;
    },
    /** The casino background setting. */
    get ambiOn() {
      return ambiOn;
    },
    setAmbi(v: boolean) {
      ambiOn = v;
      store.set('chips.ambi', v ? '1' : '0');
    },
    /** The narration setting. */
    get voiceOn() {
      return voiceOn;
    },
    setVoice(v: boolean) {
      voiceOn = v;
      store.set('chips.voice', v ? '1' : '0');
    },
    ambiStart() {
      if (!ready()) return;
      loadBg();
      if (amb) return;
      const c = C();
      try {
        if (!bgBus) {
          bgBus = c.createGain();
          bgBus.connect(out as AudioNode);
        }
        const a = Ambience(c, bgBus, AMB_LEVEL, bgClips);
        amb = a;
        a.sched(c.currentTime + 20);
        ambTimer = setInterval(() => {
          try {
            a.sched(c.currentTime + 20);
          } catch {
            // keep the timer going
          }
        }, 4000);
      } catch {
        amb = null;
      }
    },
    ambiStop() {
      if (!amb) return;
      clearInterval(ambTimer);
      amb.stop();
      amb = null;
    },
    voiceLoad() {
      if (ready()) voice.load();
    },
    /** The dealer's narration (see narration.ts). */
    say: (key: string) => voice.say(key),
    voiceStop: () => voice.stop(),
    chips(n = 3, v = 1) {
      if (!ready()) return;
      const t0 = C().currentTime;
      if (t0 - lastT < 0.07) {
        if (++burst > 4) return;
      } else burst = 0; // many chips at once: keep it pleasant
      lastT = t0;
      let t = t0;
      for (let i = 0; i < n; i++) {
        clack(t, v * (1 - i * 0.07));
        t += 0.028 + Math.random() * 0.05;
      }
    },
    ambient() {
      if (!ready()) return;
      AMB[Math.floor(Math.random() * AMB.length)](C().currentTime + 0.05, ambBus());
    },
    tap() {
      if (!ready()) return;
      const t = C().currentTime;
      clack(t, 0.9);
      clack(t + 0.05, 0.35);
    },
    tick() {
      if (!ready()) return;
      tone(C().currentTime, 1900, 0.014, 0.035, 'triangle');
    },
    slide() {
      if (!ready()) return;
      noise(C().currentTime, 0.24, 700, 0.7, 0.14, 'lowpass', 2400);
    },
    whoosh() {
      if (!ready()) return;
      noise(C().currentTime, 0.3, 350, 1.3, 0.22, 'bandpass', 2800);
    },
    drumroll(d = 1.8) {
      if (!ready()) return;
      const t0 = C().currentTime;
      let t = t0;
      while (t < t0 + d) {
        const k = (t - t0) / d,
          v = 0.12 + 0.38 * k * k;
        tone(t, 95 + Math.random() * 15, 0.05, v, 'sine', 60);
        noise(t, 0.04, 260, 0.9, v * 0.8, 'lowpass');
        t += 0.034 + Math.random() * 0.008;
      }
      noise(t, 1.4, 6000, 0.6, 0.35, 'highpass'); // cymbal
      noise(t, 0.9, 3200, 0.5, 0.2, 'bandpass', 9000);
    },
    fanfare() {
      if (!ready()) return;
      const t = C().currentTime + 0.03;
      const brass = (s: number, f: number, d: number, g: number) => {
        tone(s, f, d, g, 'sawtooth', null, 0.03);
        tone(s, f * 2, d * 0.8, g * 0.3, 'triangle', null, 0.03);
      };
      [
        [0, 392],
        [0.13, 392],
        [0.26, 392],
        [0.4, 523.25],
      ].forEach(([d, f]) => brass(t + d, f, 0.14, 0.07));
      [
        [0.62, 659.25],
        [0.62, 523.25],
        [0.62, 783.99],
        [0.62, 1046.5],
      ].forEach(([d, f]) => brass(t + d, f, 1.3, 0.05));
    },
    applause(d = 3.6) {
      if (!ready()) return;
      const c = C(),
        t0 = c.currentTime + 0.05;
      for (let i = 0; i < 260; i++) {
        const k = Math.pow(Math.random(), 1.6),
          t = t0 + k * d,
          v = (0.05 + Math.random() * 0.11) * (1 - k * 0.7);
        let dst: AudioNode = out as AudioNode;
        try {
          const p = c.createStereoPanner();
          p.pan.value = Math.random() * 2 - 1;
          p.connect(out as AudioNode);
          dst = p;
        } catch {
          // no panner: centred
        }
        noise(t, 0.02 + Math.random() * 0.025, 900 + Math.random() * 1800, 1.1, v, 'bandpass', null, dst);
      }
    },
    bell() {
      if (!ready()) return;
      const t = C().currentTime;
      [
        [1318.5, 1],
        [1975.5, 0.6],
      ].forEach(([f, g], i) => {
        tone(t + i * 0.13, f, 0.9, 0.07 * g, 'sine');
        tone(t + i * 0.13, f * 2.76, 0.3, 0.018 * g, 'sine');
      });
    },
    knock() {
      if (!ready()) return;
      const t = C().currentTime;
      [0, 0.14].forEach(d => {
        tone(t + d, 150, 0.09, 0.45, 'sine', 70);
        noise(t + d, 0.05, 450, 1, 0.28, 'lowpass');
      });
    },
    fold() {
      if (!ready()) return;
      noise(C().currentTime, 0.2, 2400, 0.8, 0.17, 'bandpass', 600);
    },
    win() {
      if (!ready()) return;
      notes(C().currentTime + 0.05, [659.25, 783.99, 1046.5, 1318.5], 0.085, 0.24, 0.11);
    },
    bj() {
      if (!ready()) return;
      const t = C().currentTime + 0.05;
      notes(t, [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], 0.075, 0.22, 0.1);
      [1046.5, 1318.5, 1567.98].forEach(f => tone(t + 0.5, f, 0.8, 0.045, 'triangle', null, 0.02));
      for (let i = 0; i < 9; i++) tone(t + 0.45 + i * 0.07, 2400 + Math.random() * 2400, 0.07, 0.03, 'sine');
    },
    lose() {
      if (!ready()) return;
      const t = C().currentTime + 0.05;
      tone(t, 392, 0.22, 0.09, 'triangle', 370);
      tone(t + 0.22, 311.13, 0.45, 0.09, 'triangle', 285);
    },
    push() {
      if (!ready()) return;
      const t = C().currentTime + 0.05;
      tone(t, 587.33, 0.14, 0.07, 'triangle');
      tone(t + 0.17, 587.33, 0.22, 0.06, 'triangle');
    },
  };
  return api;
}
