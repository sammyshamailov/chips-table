// @ts-nocheck
// The game rules are pure functions in src/domain/ (R-005 phase 2); this script reads S, calls them and writes what they return.
import { DEN, chipsOf, sumOf, okChips, handStack, handHalves, chipLabel, denoms as denomsFor } from './domain/chips';
import * as HR from './domain/holdem/rules';
import * as Pots from './domain/holdem/pots';
import * as BJ from './domain/blackjack/rules';
import * as BJA from './domain/blackjack/actions';
import * as BJR from './domain/blackjack/round';
// Storage is behind the Store port in src/data/ (R-005 phase 3): the adapters, the write queue, and normalize*(),
// which fills in every missing field of a stored document when it is read.
import { connect } from './data/connect';
import { createLocalStore } from './data/local-store';
import { createWriter } from './data/writes';
import { normalizeRoom, normalizePlayer } from './data/schema';
(() => {
const app = document.getElementById('app'), sheetEl = document.getElementById('sheet'), toastEl = document.getElementById('toast'), rotEl = document.getElementById('rot'), finEl = document.getElementById('fin');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Math.round(n || 0).toLocaleString('en-US');
const ls = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }, del(k){ try { localStorage.removeItem(k); } catch(e){} } };
const rid = (n=8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const now = () => Date.now();
/* ---------- table types this build understands (guard for newer phones' tables) ----------
   Room fields `mode` (missing = 'chips') and `appMin` (missing = 0) are only READ for now. A table that needs a
   newer build is shown as an update screen and is never written to. Raise FEATURE_LEVEL only when this build
   can really play tables written with that appMin. */
const FEATURE_LEVEL = 1, KNOWN_MODES = ['chips'];
function tableUnsupported(r){
  if (!r) return false;
  const min = Number(r.appMin); if (r.appMin != null && !(min <= FEATURE_LEVEL)) return true;   // also catches a non-number
  return r.mode != null && !KNOWN_MODES.includes(r.mode);
}
const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch(e){} };

const S = {
  mode: 'pending', db: null, readOnly: false,
  myId: ls.get('chips.pid') || ('p_' + rid(10)),
  name: ls.get('chips.name') || '',
  code: null, room: null, roomLoaded: false, players: {}, unsubs: [],
  pending: 0, pendChips: [], sheet: null, sel: [], settle: {}, dealerBJ: false, confirm: null, adj: {},
  rooms: [], joinCode: '', newName: '',
  create: { game: 'holdem', stack: '1000', sb: '5', bb: '10', minBet: '10', maxBet: '500', play: true },
  edit: null
};
ls.set('chips.pid', S.myId);
let installEvt = null;

/* ---------- casino background: a quiet steady murmur of people, plus a slot machine now and then ----------
   The bed (sounds/amb/crowd-bed.mp3, generated speech-like murmur, no clear words) loops quietly under everything;
   every 10-25 s one slot-machine one-shot plays on top. The owner liked the style of the generated talk clips,
   so the bed is made in that style, and it sits 6 dB under how loud those clips were.
   Files: sounds/amb/*.mp3 (see sounds/CREDITS.md). Works on any AudioContext, including an
   OfflineAudioContext for tests/audio.js. */
const AMB_BASE = 'sounds/amb/', AMB_LEVEL = .045, AMB_MAKEUP = 1, AMB_BED = .0753;     // machines peak about -20 dBFS at the master; the bed (-20 dBFS file) sits at about -41 dBFS (both channels)
const AMB_MANIFEST = [{ kind: 'bed', url: `${AMB_BASE}crowd-bed.mp3` }].concat([1, 2, 3, 4].map(i => ({ kind: 'machine', url: `${AMB_BASE}machine-${i}.mp3` })));
// Make the decoded bed loop cleanly: skip any silence the MP3 decoder leaves at the ends (some browsers do), then
// crossfade the last 50 ms into the first 50 ms. MP3 changes the edges slightly, so without this there's a faint
// click every time the loop repeats. Done once per buffer; returns [loopStart, loopEnd] in seconds.
const LOOPS = new WeakMap();
function loopBounds(buf){
  if (LOOPS.has(buf)) return LOOPS.get(buf);
  const sr = buf.sampleRate, d0 = buf.getChannelData(0), lim = Math.min(d0.length, Math.floor(sr * .3));
  let a = 0, b = d0.length; while (a < lim && Math.abs(d0[a]) < 1e-4) a++; while (b > d0.length - lim && Math.abs(d0[b - 1]) < 1e-4) b--;
  const k = Math.min(Math.floor(sr * .05), Math.floor((b - a) / 4));
  for (let ch = 0; ch < buf.numberOfChannels; ch++){
    const d = buf.getChannelData(ch);
    for (let i = 0; i < k; i++){ const t = (i / k) * Math.PI / 2; d[a + i] = d[a + i] * Math.sin(t) + d[b - k + i] * Math.cos(t); }
  }
  const r = [a / sr, (b - k) / sr]; LOOPS.set(buf, r); return r;
}
// clips: array of { kind, buf, url }, read on every pick, so clips that finish loading later are used too.
function Ambience(c, dest, level, clips){
  const T0 = c.currentTime, sr = c.sampleRate, rnd = (a, b) => a + Math.random() * (b - a);
  // events are peaky (a coin drop, a laugh): a gentle compressor evens them out so they can be heard without a high peak
  const bus = c.createGain(), cmp = c.createDynamicsCompressor(), mk = c.createGain(); cmp.threshold.value = -42; cmp.knee.value = 12; cmp.ratio.value = 8; cmp.attack.value = .005; cmp.release.value = .25; mk.gain.value = AMB_MAKEUP;
  bus.connect(cmp); cmp.connect(mk); mk.connect(dest);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = .5;
  const room = c.createGain(); room.gain.value = 1; const dry = c.createGain(), wet = c.createGain(); dry.gain.value = 1; wet.gain.value = .25;
  bus.gain.value = 1; room.connect(lp); lp.connect(dry); dry.connect(bus);
  try {                                                                 // a light generated reverb, about 1.2 s
    const n = Math.floor(sr * 1.2), ir = c.createBuffer(2, n, sr); let en = 0;
    for (let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for (let i = 0; i < n; i++){ d[i] = (Math.random() * 2 - 1) * Math.exp(-5 * i / n); en += d[i] * d[i]; } }
    const k = 1 / Math.sqrt(en / 2); for (let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] *= k; }
    const cv = c.createConvolver(); cv.buffer = ir; lp.connect(cv); cv.connect(wet); wet.connect(bus);
  } catch(e){}
  // the bed: one looped source straight to the destination (not through the event compressor), faded in over 3 s
  let bedG = null, bedSrc = null;
  function startBed(){
    const it = clips.find(x => x.kind === 'bed' && x.buf); if (!it || bedSrc || dead) return;
    const [a, b] = loopBounds(it.buf), t = c.currentTime;
    bedG = c.createGain(); bedG.gain.setValueAtTime(0, t); bedG.gain.linearRampToValueAtTime(AMB_BED, t + 3); bedG.connect(dest);
    bedSrc = c.createBufferSource(); bedSrc.buffer = it.buf; bedSrc.loop = true; bedSrc.loopStart = a; bedSrc.loopEnd = b;
    bedSrc.connect(bedG); bedSrc.start(t, a + Math.random() * Math.max(0, b - a - 1));      // phones at one table don't play in step
  }
  let next = T0 + rnd(4, 8), busyUntil = T0, last = null, live = [], dead = false;
  function pick(){
    const list = clips.filter(x => x.buf && x.kind === 'machine' && x !== last);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  function sched(until){
    if (dead) return;
    startBed();
    while (next < until){
      const clip = pick(); if (!clip) return;                           // nothing loaded yet: try again at the next call
      const t = Math.max(next, busyUntil, c.currentTime), d = clip.buf.duration, quiet = 1;
      const src = c.createBufferSource(); src.buffer = clip.buf;
      const g = c.createGain(), peak = level * quiet * Math.pow(10, rnd(-3, 3) / 20);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .03); g.gain.setValueAtTime(peak, Math.max(t + .03, t + d - .08)); g.gain.linearRampToValueAtTime(0, t + d);
      src.connect(g); let n = g;
      try { const p = c.createStereoPanner(); p.pan.value = rnd(-.8, .8); g.connect(p); n = p; } catch(e){}
      n.connect(room); src.start(t); live.push(src); src.onended = () => { live = live.filter(x => x !== src); try { n.disconnect(); g.disconnect(); } catch(e){} };
      last = clip; busyUntil = t + d; next = t + rnd(10, 25);
      if (next < busyUntil) next = busyUntil;
      sched.count = (sched.count || 0) + 1;
    }
  }
  function stop(){
    dead = true; const t = c.currentTime;
    try { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + .4); } catch(e){}
    try { if (bedG){ bedG.gain.cancelScheduledValues(t); bedG.gain.setValueAtTime(bedG.gain.value, t); bedG.gain.linearRampToValueAtTime(0, t + .6); } } catch(e){}
    setTimeout(() => { live.forEach(x => { try { x.stop(); } catch(e){} }); live = []; try { bus.disconnect(); } catch(e){} try { if (bedSrc) bedSrc.stop(); } catch(e){} try { if (bedG) bedG.disconnect(); } catch(e){} }, 800);
  }
  return { sched, stop, get events(){ return sched.count || 0; } };
}
// One dealer line: plays buffer `buf` at time t on `dest`. Shared by SND.say and tests/audio.js.
const VOICE_KEYS = ['open', 'locked', 'blackjack', 'payout', 'winner', 'newhand', 'flop', 'turn', 'river', 'allin', 'closed'], VOICE_LEVEL = .7;    // speech RMS about -20 dBFS at the master
function playLine(c, dest, buf, t, level){
  const s = c.createBufferSource(); s.buffer = buf; const g = c.createGain(); g.gain.value = level; s.connect(g); g.connect(dest); s.start(t); return s;
}
window.ChipsAmbience = Ambience; window.ChipsLine = playLine;     // for tests/audio.js
window.CHIPS_BG = { manifest: AMB_MANIFEST, level: AMB_LEVEL, bedLevel: AMB_BED, loopBounds, voiceKeys: VOICE_KEYS, voiceLevel: VOICE_LEVEL, voiceUrl: k => `sounds/voice/${k}.mp3` };

/* ---------- sounds: synthesized with Web Audio, so nothing to download and it works offline ---------- */
const SND = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, out = null, nbuf = null, on = ls.get('chips.sound') !== '0', lastT = 0, burst = 0, amb = null, ambTimer = 0, bgBus = null, bgClips = [], vox = {}, voxLoading = false, voice = null, voiceQ = [];
  // Clips load the first time they are wanted (then the service worker keeps them). A missing or broken file
  // is skipped and tried again at most once a minute.
  const decode = ab => new Promise((ok, no) => { const p = ctx.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); });
  const fetchBuf = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(decode);
  const BG_ITEMS = AMB_MANIFEST.map(m => ({ kind: m.kind, url: m.url, buf: null, busy: false, failAt: 0 }));
  function loadBg(){
    if (!ctx) return;
    BG_ITEMS.forEach(it => {
      if (it.buf || it.busy || now() - it.failAt < 60000) return; it.busy = true;
      fetchBuf(it.url).then(b => { it.buf = b; it.busy = false; if (!bgClips.includes(it)) bgClips.push(it); }, () => { it.busy = true; it.failAt = now(); setTimeout(() => { it.busy = false; }, 60000); });
    });
  }
  const VOX = VOICE_KEYS.map(k => ({ key: k, url: `sounds/voice/${k}.mp3`, buf: null, busy: false, failAt: 0 }));
  function loadVoice(){
    if (!ctx) return;
    VOX.forEach(it => {
      if (it.buf || it.busy || now() - it.failAt < 60000) return; it.busy = true;
      fetchBuf(it.url).then(b => { it.buf = b; it.busy = false; vox[it.key] = b; }, () => { it.busy = true; it.failAt = now(); setTimeout(() => { it.busy = false; }, 60000); });
    });
  }
  function duck(on_){ if (!bgBus) return; const t = ctx.currentTime; try { bgBus.gain.cancelScheduledValues(t); bgBus.gain.setValueAtTime(bgBus.gain.value, t); bgBus.gain.linearRampToValueAtTime(on_ ? .5 : 1, t + (on_ ? .15 : .5)); } catch(e){} }
  function playNext(){
    if (voice || !voiceQ.length || !ready() || !VOICE_ON) return;
    const key = voiceQ.shift(), buf = vox[key]; if (!buf){ playNext(); return; }
    const s = playLine(ctx, out, buf, ctx.currentTime + .02, VOICE_LEVEL); voice = s; duck(true);
    s.onended = () => { if (voice === s) voice = null; duck(false); setTimeout(playNext, 250); };
  }
  function init(){
    if (!AC || !on) return;
    try {
      if (!ctx){
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
        out = ctx.createGain(); out.gain.value = .8; out.connect(comp); comp.connect(ctx.destination);
        nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume().then(() => ambiSync(), () => {});
    } catch(e){}
  }
  const ready = () => on && ctx && ctx.state === 'running';
  function env(g, t, peak, a, d){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noise(t, d, f, q, peak, type = 'bandpass', f2, dst = out){
    const s = ctx.createBufferSource(); s.buffer = nbuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d); fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, peak, .002, d);
    s.connect(fl); fl.connect(g); g.connect(dst); s.start(t, Math.random() * .8); s.stop(t + d + .05);
  }
  function tone(t, f, d, peak, type = 'sine', f2, a = .005, dst = out){
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = ctx.createGain(); env(g, t, peak, a, d); o.connect(g); g.connect(dst); o.start(t); o.stop(t + a + d + .05);
  }
  // one clay chip landing on another: a bright, very short click with a little body
  function clack(t, v = 1, dst = out, lo = 2800, span = 2400){ const f = lo + Math.random() * span; noise(t, .026, f, 5, .5 * v, 'bandpass', null, dst); tone(t, f * 1.55, .016, .06 * v, 'triangle', null, .005, dst); noise(t + .003, .05, 1300 + Math.random() * 500, 9, .1 * v, 'bandpass', null, dst); }
  // A player somewhere at the table playing with their chips: quieter, panned to one side, slightly duller.
  function ambBus(){ const g = ctx.createGain(); g.gain.value = .42; let n = g; try { const p = ctx.createStereoPanner(); p.pan.value = (Math.random() < .5 ? -1 : 1) * (.35 + Math.random() * .45); g.connect(p); n = p; } catch(e){} n.connect(out); return g; }
  const AMB = [
    (t, bus) => {                       // riffle: two stacks pushed into each other, chips interleaving fast
      const n = 14 + Math.floor(Math.random() * 10);
      for (let i = 0; i < n; i++){ clack(t, .55 + Math.random() * .35, bus, 2200, 1600); t += .022 + Math.random() * .014; }
      clack(t + .06, .5, bus, 2000, 900); clack(t + .1, .3, bus, 2000, 900);
    },
    (t, bus) => {                       // lifting a few chips and letting them drop back on the stack
      const k = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < k; j++){ let u = t + j * (.34 + Math.random() * .2); for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++){ clack(u, .7 - i * .1, bus); u += .03 + Math.random() * .02; } }
    },
    (t, bus) => {                       // counting chips one by one off a stack
      const n = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++){ clack(t, .6 + Math.random() * .3, bus, 2600, 2000); t += .16 + Math.random() * .12; }
    }
  ];
  const notes = (t, list, gap, d, peak, type = 'triangle') => list.forEach((f, i) => { tone(t + i * gap, f, d, peak, type); tone(t + i * gap, f * 2, d * .6, peak * .25, 'sine'); });
  const api = {
    init,
    get on(){ return on; },
    toggle(){ on = !on; ls.set('chips.sound', on ? '1' : '0'); if (on){ init(); setTimeout(() => api.chips(3), 60); } else api.voiceStop(); ambiSync(); return on; },
    ambiStart(){
      if (!ready()) return; loadBg(); if (amb) return;
      try {
        if (!bgBus){ bgBus = ctx.createGain(); bgBus.connect(out); }
        const a = Ambience(ctx, bgBus, AMB_LEVEL, bgClips); amb = a; a.sched(ctx.currentTime + 20);
        ambTimer = setInterval(() => { try { a.sched(ctx.currentTime + 20); } catch(e){} }, 4000);
      } catch(e){ amb = null; }
    },
    ambiStop(){ if (!amb) return; clearInterval(ambTimer); amb.stop(); amb = null; },
    voiceLoad(){ if (ready()) loadVoice(); },
    // The dealer's narration. One line at a time: a new line is dropped while one plays, except 'winner' and 'closed',
    // which wait their turn. The background is ducked 6 dB while a line plays.
    say(key){
      if (!ready() || !VOICE_ON || !VOICE_KEYS.includes(key)) return; loadVoice();
      if (!vox[key]) return;
      if (voice){ if ((key === 'winner' || key === 'closed') && !voiceQ.includes(key)) voiceQ.push(key); return; }
      voiceQ.push(key); playNext();
    },
    voiceStop(){ voiceQ.length = 0; if (voice){ const s = voice; voice = null; try { s.onended = null; s.stop(); } catch(e){} duck(false); } },
    chips(n = 3, v = 1){
      if (!ready()) return; const t0 = ctx.currentTime;
      if (t0 - lastT < .07){ if (++burst > 4) return; } else burst = 0; lastT = t0;   // many chips at once: keep it pleasant
      let t = t0; for (let i = 0; i < n; i++){ clack(t, v * (1 - i * .07)); t += .028 + Math.random() * .05; }
    },
    ambient(){ if (!ready()) return; AMB[Math.floor(Math.random() * AMB.length)](ctx.currentTime + .05, ambBus()); },
    tap(){ if (!ready()) return; const t = ctx.currentTime; clack(t, .9); clack(t + .05, .35); },
    tick(){ if (!ready()) return; tone(ctx.currentTime, 1900, .014, .035, 'triangle'); },
    slide(){ if (!ready()) return; noise(ctx.currentTime, .24, 700, .7, .14, 'lowpass', 2400); },
    whoosh(){ if (!ready()) return; noise(ctx.currentTime, .3, 350, 1.3, .22, 'bandpass', 2800); },
    drumroll(d = 1.8){
      if (!ready()) return; const t0 = ctx.currentTime; let t = t0;
      while (t < t0 + d){ const k = (t - t0) / d, v = .12 + .38 * k * k; tone(t, 95 + Math.random() * 15, .05, v, 'sine', 60); noise(t, .04, 260, .9, v * .8, 'lowpass'); t += .034 + Math.random() * .008; }
      noise(t, 1.4, 6000, .6, .35, 'highpass'); noise(t, .9, 3200, .5, .2, 'bandpass', 9000);    // cymbal
    },
    fanfare(){
      if (!ready()) return; const t = ctx.currentTime + .03;
      const brass = (s, f, d, g) => { tone(s, f, d, g, 'sawtooth', null, .03); tone(s, f * 2, d * .8, g * .3, 'triangle', null, .03); };
      [[0, 392], [.13, 392], [.26, 392], [.4, 523.25]].forEach(([d, f]) => brass(t + d, f, .14, .07));
      [[.62, 659.25], [.62, 523.25], [.62, 783.99], [.62, 1046.5]].forEach(([d, f]) => brass(t + d, f, 1.3, .05));
    },
    applause(d = 3.6){
      if (!ready()) return; const t0 = ctx.currentTime + .05;
      for (let i = 0; i < 260; i++){
        const k = Math.pow(Math.random(), 1.6), t = t0 + k * d, v = (.05 + Math.random() * .11) * (1 - k * .7);
        let dst = out; try { const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 2 - 1; p.connect(out); dst = p; } catch(e){}
        noise(t, .02 + Math.random() * .025, 900 + Math.random() * 1800, 1.1, v, 'bandpass', null, dst);
      }
    },
    bell(){ if (!ready()) return; const t = ctx.currentTime; [[1318.5, 1], [1975.5, .6]].forEach(([f, g], i) => { tone(t + i * .13, f, .9, .07 * g, 'sine'); tone(t + i * .13, f * 2.76, .3, .018 * g, 'sine'); }); },
    knock(){ if (!ready()) return; const t = ctx.currentTime; [0, .14].forEach(d => { tone(t + d, 150, .09, .45, 'sine', 70); noise(t + d, .05, 450, 1, .28, 'lowpass'); }); },
    fold(){ if (!ready()) return; noise(ctx.currentTime, .2, 2400, .8, .17, 'bandpass', 600); },
    win(){ if (!ready()) return; notes(ctx.currentTime + .05, [659.25, 783.99, 1046.5, 1318.5], .085, .24, .11); },
    bj(){
      if (!ready()) return; const t = ctx.currentTime + .05;
      notes(t, [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], .075, .22, .1);
      [1046.5, 1318.5, 1567.98].forEach(f => tone(t + .5, f, .8, .045, 'triangle', null, .02));
      for (let i = 0; i < 9; i++) tone(t + .45 + i * .07, 2400 + Math.random() * 2400, .07, .03, 'sine');
    },
    lose(){ if (!ready()) return; const t = ctx.currentTime + .05; tone(t, 392, .22, .09, 'triangle', 370); tone(t + .22, 311.13, .45, .09, 'triangle', 285); },
    push(){ if (!ready()) return; const t = ctx.currentTime + .05; tone(t, 587.33, .14, .07, 'triangle'); tone(t + .17, 587.33, .22, .06, 'triangle'); }
  };
  return api;
})();
['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, () => SND.init(), { passive: true, capture: true }));
// The casino in the background runs only inside a table, with the screen on, sound on, and ambience on.
let AMBI_ON = ls.get('chips.ambi') !== '0', VOICE_ON = ls.get('chips.voice') !== '0';
function ambiSync(){
  const inTable = SND.on && !!(S.code && S.room && !S.room.closed) && document.visibilityState === 'visible';
  if (inTable && AMBI_ON) SND.ambiStart(); else SND.ambiStop();
  if (inTable && VOICE_ON) SND.voiceLoad();
}
document.addEventListener('visibilitychange', () => ambiSync());
// Casino vibes: now and then someone at the table plays with their chips. Only inside a table, only when the screen is on.
(function ambLoop(){ setTimeout(() => { if (S.code && S.room && !S.room.closed && document.visibilityState === 'visible') SND.ambient(); ambLoop(); }, 45000 + Math.random() * 75000); })();

/* ---------- effects: flying chips and cards ----------
   Everything here is derived from changes in the synced documents, so the stored data format is unchanged.
   While chips are in the air, FX.ov holds what a player's spot and stack looked like before, and the
   table keeps showing that until the chips land. */
const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; } })();
const FX = { rects: {}, ov: {}, pendFly: 0, n: 0, signDrop: 0, cer: false };      // pendFly: how many of your pending chips are still in the air
const fxLayer = document.getElementById('fx');
const pageRect = el => { const b = el.getBoundingClientRect(); return (b.width || b.height) ? { x: b.left + scrollX + b.width / 2, y: b.top + scrollY + b.height / 2, w: b.width, h: b.height } : null; };
function measure(){ const m = {}; document.querySelectorAll('[data-k]').forEach(el => { const r = pageRect(el); if (r) m[el.dataset.k] = r; }); return m; }
function rectOf(k){ const el = document.querySelector('[data-k="' + k + '"]'); return el ? pageRect(el) : null; }
const oldRect = k => FX.rects[k] || rectOf(k);
const shift = (r, dx, dy = 0) => r && { ...r, x: r.x + dx, y: r.y + dy };
const unitPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 3.4;
function seatTarget(pid){
  const s = rectOf('seat:' + pid);
  if (pid !== S.myId) return s;
  const d = rectOf('mystack');
  return onScreen(s) ? s : (d || s);
}
function setOv(pid, o, ms){ const tok = ++FX.n; FX.ov[pid] = { ...o, tok, until: now() + ms + 600 }; setTimeout(() => clearOv(pid, tok), ms + 650); return tok; }
function clearOv(pid, tok){ if (FX.ov[pid] && FX.ov[pid].tok === tok){ delete FX.ov[pid]; render(); } }
const ov = pid => { const o = FX.ov[pid]; return o && o.until > now() ? o : null; };
const shownStack = p => { const o = ov(p.pid); return o && o.stack != null ? o.stack : p.stack; };

function fly(o){
  let done = false, el = null;
  const fin = () => { if (done) return; done = true; if (el) el.remove(); if (o.land) o.land(); };
  if (!o.from || !o.to || RM){ setTimeout(fin, RM ? Math.min(o.delay || 0, 300) : 0); return; }
  el = document.createElement('div'); el.className = 'fly';
  el.style.left = o.from.x + 'px'; el.style.top = o.from.y + 'px';
  el.innerHTML = `<div class="fly-y"><div class="fly-c">${o.html || stackHTML(o.amt)}</div></div>`;
  fxLayer.appendChild(el);
  const dx = o.to.x - o.from.x, dy = o.to.y - o.from.y, dur = o.dur || 540, delay = o.delay || 0;
  const lift = o.lift ?? Math.min(70, 14 + Math.hypot(dx, dy) * .22);
  const opt = { duration: dur, delay, fill: 'both' };
  try {
    const a = el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }], { ...opt, easing: 'cubic-bezier(.5,0,.3,1)' });
    el.firstChild.animate([{ transform: 'translateY(0) scale(1)', easing: 'ease-out' }, { transform: `translateY(${-lift}px) scale(1.12)`, offset: .45, easing: 'ease-in' }, { transform: `translateY(0) scale(${o.fadeOut ? .7 : 1})` }], opt);
    if (o.fadeOut || o.fadeIn) el.firstChild.firstChild.animate([{ opacity: o.fadeIn ? 0 : 1 }, { opacity: 1, offset: o.fadeIn ? .25 : .72 }, { opacity: o.fadeOut ? 0 : 1 }], opt);
    a.onfinish = fin;
  } catch(e){ fin(); return; }
  if (o.sound) setTimeout(o.sound, delay);
  setTimeout(fin, delay + dur + 500);
}
function floatText(at, text, cls = ''){
  if (!at) return;
  const el = document.createElement('div'); el.className = 'ft ' + cls; el.textContent = text;
  el.style.left = at.x + 'px'; el.style.top = at.y + 'px'; fxLayer.appendChild(el);
  const c = 'translate(-50%,-50%)';
  try { el.animate([{ transform: `${c} translateY(0) scale(.5)`, opacity: 0 }, { transform: `${c} translateY(-8px) scale(1.15)`, opacity: 1, offset: .2 }, { transform: `${c} translateY(-14px) scale(1)`, opacity: 1, offset: .65 }, { transform: `${c} translateY(-40px) scale(1)`, opacity: 0 }], { duration: 1600, easing: 'ease-out', fill: 'both' }); } catch(e){}
  setTimeout(() => el.remove(), 1700);
}
function pulse(k, s = 1.14){ const el = document.querySelector('[data-k="' + k + '"]'); if (!el || RM) return; try { el.animate([{ scale: '1' }, { scale: String(s) }, { scale: '1' }], { duration: 300, easing: 'ease-out' }); } catch(e){} }
const ghostChips = () => { const c = pendChips(); return c.slice(0, Math.max(0, c.length - FX.pendFly)); };
function paintGhost(){ const el = document.querySelector('[data-k="ghost"]'); if (el){ const g = ghostChips(); el.innerHTML = g.length ? stackHTML(g) : ''; } }
const LAND = matchMedia('(orientation: landscape)');
const PORTRAIT_PHONE = matchMedia('(orientation: portrait) and (max-width: 700px) and (pointer: coarse)');
const landRoom = () => LAND.matches && !!S.code;
function setU(){
  const aw = app.clientWidth || 340; let w = Math.min(aw, 520);
  if (landRoom()) w = Math.max(220, Math.min(600, (innerHeight - 20) / (.98 + .185), aw - 276));   // .185: the dealer above the table   // leave room for the side panel
  const st = document.documentElement.style; st.setProperty('--u', (w / 100).toFixed(3) + 'px'); st.setProperty('--tw', Math.floor(w) + 'px');
}
window.addEventListener('resize', setU);
const onTurn = () => { if (S.code) render(); else setU(); };
[LAND, PORTRAIT_PHONE].forEach(q => { try { q.addEventListener('change', onTurn); } catch(e){ try { q.addListener(onTurn); } catch(e2){} } });
// Is this point visible, and not hidden behind the fixed bottom dock (portrait)?
function onScreen(r){
  if (!r) return false;
  let bottom = scrollY + innerHeight; const dock = document.querySelector('.dock');
  if (dock && getComputedStyle(dock).position === 'fixed') bottom = dock.getBoundingClientRect().top + scrollY;
  return r.y > scrollY && r.y < bottom - 8;
}

/* ---------- staying up to date ----------
   A phone that keeps the app open (or resumes it from the background) would otherwise keep running old code.
   Each deploy writes a new APP_BUILD into config.js; when the live one differs, reload as soon as the player is idle. */
const BUILD = window.APP_BUILD || null; let newBuild = false, checking = false;
async function checkUpdate(){
  if (!BUILD || newBuild || checking || !navigator.onLine) return; checking = true;
  try {
    const t = await (await fetch('config.js', { cache: 'no-store' })).text();
    const m = t.match(/APP_BUILD\s*=\s*"([^"]+)"/);
    if (m && m[1] !== BUILD){ newBuild = true; render(); }
  } catch(e){} finally { checking = false; }
}
const idle = () => !S.pending && !S.sheet && !Object.keys(FX.ov).length && !(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName));
let reloading = false;
function maybeReload(){ if (!newBuild || reloading || !idle()) return; reloading = true; toast('מעדכן לגרסה החדשה…'); setTimeout(() => location.reload(), 900); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
window.addEventListener('focus', () => checkUpdate());
window.addEventListener('online', () => checkUpdate());
setInterval(checkUpdate, 3 * 60 * 1000); setTimeout(checkUpdate, 8000);

/* ---------- avatars: a photo (camera or gallery) or one of the prepared characters ----------
   Stored on the player document as avatar: { k:'img', v:'data:image/jpeg;base64,...' } or { k:'set', v:'<id>' }.
   Photos are cropped and shrunk on the phone to about 5-14 KB, so no file storage is needed. */
const SKIN = ['#f3cfb3', '#e2ab84', '#c68863', '#8d5a3b', '#5e3a26'];
const AV_SET = {
  //     background  skin     hair      hair colour  shirt      extras
  ace:    ['#3d6fb6', SKIN[0], 'short',  '#5a3a24', '#1f2a44', []],
  rose:   ['#d0558f', SKIN[0], 'long',   '#e9c46a', '#f4f1ea', ['earrings']],
  bun:    ['#2a9d8f', SKIN[1], 'bun',    '#1d1d1f', '#17171c', ['bowtie']],
  curls:  ['#e07a26', SKIN[3], 'curly',  '#2a1a12', '#264653', []],
  sage:   ['#2e8a4f', SKIN[2], 'bald',   '#9a9a9a', '#5c4033', ['beard']],
  rookie: ['#5fa8d3', SKIN[0], 'cap',    '#c8372d', '#c8372d', []],
  tex:    ['#b07a2a', SKIN[1], 'cowboy', '#6b4428', '#7a2e1f', ['mustache']],
  shark:  ['#6b3fa0', SKIN[1], 'short',  '#1d1d1f', '#17171c', ['shades']],
  ruby:   ['#74cf9f', SKIN[0], 'long',   '#b5452a', '#3d405b', ['glasses']],
  gent:   ['#e0b766', SKIN[2], 'short',  '#2a1a12', '#17171c', ['bowtie']],
  diva:   ['#8e1f2c', SKIN[3], 'long',   '#1d1d1f', '#e0b766', ['shades', 'earrings']],
  sunny:  ['#9bc53d', SKIN[0], 'curly',  '#e9c46a', '#3d6fb6', []],
  boss:   ['#1c2b4a', SKIN[4], 'bald',   '#1d1d1f', '#f4f1ea', ['mustache', 'bowtie']],
  nana:   ['#a78bfa', SKIN[0], 'bun',    '#d6d6d6', '#7a4a2a', ['glasses', 'earrings']],
  chill:  ['#3fa9b5', SKIN[2], 'beanie', '#e07a26', '#2a2a2e', []],
  red:    ['#7a4a2a', SKIN[0], 'short',  '#c0562d', '#2e8a4f', ['beard']]
};
function avSVG(id){
  const a = AV_SET[id]; if (!a) return '';
  const [bg, sk, hair, hc, shirt, ex] = a, has = x => ex.includes(x);
  const back = hair === 'long' ? `<path d="M16 32c0-13 7-20 16-20s16 7 16 20v18H16z" fill="${hc}"/>` : '';
  const top = {
    short: `<path d="M18.5 29c-1-11 5.5-16.5 13.5-16.5S46.5 18 45.5 29c-2.5-6-7-8.5-13.5-8.5s-11 2.5-13.5 8.5z" fill="${hc}"/>`,
    long: `<path d="M18.5 30c-1-12 5.5-17.5 13.5-17.5S46.5 18 45.5 30c-3-7-8-9-13.5-9.5-4 2-9 5-13.5 9.5z" fill="${hc}"/>`,
    bun: `<circle cx="32" cy="11" r="6" fill="${hc}"/><path d="M18.5 29c-1-11 5.5-16.5 13.5-16.5S46.5 18 45.5 29c-2.5-6-7-8.5-13.5-8.5s-11 2.5-13.5 8.5z" fill="${hc}"/>`,
    curly: [[21, 21], [26, 16], [32, 14], [38, 16], [43, 21], [45, 27], [19, 27]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.2" fill="${hc}"/>`).join(''),
    bald: `<path d="M19 27c-1.2 2-1.2 5 0 7M45 27c1.2 2 1.2 5 0 7" stroke="${hc}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`,
    cap: `<path d="M18.5 27c0-9 6-14 13.5-14s13.5 5 13.5 14z" fill="${hc}"/><path d="M30 26.5h20c1.5 0 1.5 3 0 3H30z" fill="${hc}"/><circle cx="32" cy="13.5" r="1.6" fill="#fff"/>`,
    cowboy: `<ellipse cx="32" cy="22.5" rx="20" ry="4" fill="${hc}"/><path d="M22 22c0-8 3-11 10-11s10 3 10 11z" fill="${hc}"/><path d="M22 20.5h20" stroke="#e0b766" stroke-width="2"/>`,
    beanie: `<path d="M18.5 26c0-9 6-14.5 13.5-14.5S45.5 17 45.5 26z" fill="${hc}"/><rect x="17.5" y="23.5" width="29" height="5" rx="2.5" fill="${hc}" stroke="rgba(0,0,0,.15)"/><circle cx="32" cy="10.5" r="3" fill="${hc}"/>`
  }[hair] || '';
  const extra = [
    has('beard') ? `<path d="M20.5 33c1 9 6 13 11.5 13s10.5-4 11.5-13c-3 4-7 5.5-11.5 5.5S23.5 37 20.5 33z" fill="${hc}"/>` : '',
    has('mustache') ? `<path d="M26.5 36.2c2.5-2.2 4-1.6 5.5-.4 1.5-1.2 3-1.8 5.5.4-2.4.4-3.8 1.4-5.5 1.4s-3.1-1-5.5-1.4z" fill="${has('beard') ? '#000' : hc}" opacity=".85"/>` : '',
    has('shades') ? `<path d="M22.5 27.5h8l-.6 3.6c-.3 1.4-1.4 2.2-2.8 2.2h-1.4c-1.4 0-2.5-.8-2.8-2.2zM33.5 27.5h8l-.6 3.6c-.3 1.4-1.4 2.2-2.8 2.2h-1.4c-1.4 0-2.5-.8-2.8-2.2zM30.5 28.5h3" fill="#111" stroke="#111" stroke-width="1"/>` : '',
    has('glasses') ? `<circle cx="27" cy="30" r="3.6" fill="none" stroke="#2a1a12" stroke-width="1.3"/><circle cx="37" cy="30" r="3.6" fill="none" stroke="#2a1a12" stroke-width="1.3"/><path d="M30.6 30h2.8" stroke="#2a1a12" stroke-width="1.3"/>` : '',
    has('earrings') ? `<circle cx="18.6" cy="35" r="1.6" fill="#e0b766"/><circle cx="45.4" cy="35" r="1.6" fill="#e0b766"/>` : '',
    has('bowtie') ? `<path d="M32 50l-5.5-3v6zM32 50l5.5-3v6z" fill="#b3203c"/><circle cx="32" cy="50" r="1.4" fill="#86152d"/>` : ''
  ].join('');
  const eyes = has('shades') ? '' : `<circle cx="27" cy="30" r="1.7" fill="#2a1a12"/><circle cx="37" cy="30" r="1.7" fill="#2a1a12"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${bg}"/>${back}
    <path d="M8 66c2-13 12-19 24-19s22 6 24 19z" fill="${shirt}"/><path d="M27.5 40h9v8.5c-2.8 2-6.2 2-9 0z" fill="${sk}"/>
    <ellipse cx="18.8" cy="31" rx="2.2" ry="3" fill="${sk}"/><ellipse cx="45.2" cy="31" rx="2.2" ry="3" fill="${sk}"/>
    <ellipse cx="32" cy="30" rx="13.4" ry="14.5" fill="${sk}"/>${eyes}
    <path d="M27.5 36.5q4.5 3.6 9 0" stroke="#7a3b2e" stroke-width="1.5" fill="none" stroke-linecap="round"/>${top}${extra}</svg>`;
}
const validAv = a => !!a && ((a.k === 'set' && !!AV_SET[a.v]) || (a.k === 'img' && typeof a.v === 'string' && a.v.length < 60000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(a.v)));
// What goes inside an avatar circle: the photo, the character, or the first letter of the name.
function avInner(p){
  const a = p && p.avatar;
  if (validAv(a)) return a.k === 'img' ? `<img src="${a.v}" alt="">` : avSVG(a.v);
  return esc(((p && p.name) || '?').trim().charAt(0) || '?');
}
const avBg = p => validAv(p && p.avatar) ? '' : `background:hsl(${hue(p.pid)} 55% 68%)`;
let avSaved = null; try { avSaved = JSON.parse(ls.get('chips.avatar') || 'null'); } catch(e){}
S.avatar = validAv(avSaved) ? avSaved : null;
const myAv = () => ({ pid: S.myId, name: S.name || '?', avatar: S.avatar });
function setAvatar(a){
  S.avatar = validAv(a) ? a : null;
  if (S.avatar) ls.set('chips.avatar', JSON.stringify(S.avatar)); else ls.del('chips.avatar');
  if (S.code && me()) w(pPath(), 'update', { avatar: S.avatar });         // others see it at once; no lastAction, so no animation
  SND.chips(2); render();
}
// Camera and gallery inputs live outside the re-rendered DOM: a table update while the picker is open would otherwise detach them.
async function loadAvatarFile(file){
  if (!file) return;
  if (!/^image\//.test(file.type || 'image/')){ toast('זה לא קובץ תמונה'); return; }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const N = 112, c = document.createElement('canvas'); c.width = c.height = N;
    const w0 = img.naturalWidth, h0 = img.naturalHeight, side = Math.min(w0, h0);
    const sx = (w0 - side) / 2, sy = Math.max(0, (h0 - side) * .3);       // portrait photos: keep the face, which is usually high up
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); g.drawImage(img, sx, sy, side, side, 0, 0, N, N);
    let q = .82, d = c.toDataURL('image/jpeg', q); while (d.length > 14000 && q > .35){ q -= .1; d = c.toDataURL('image/jpeg', q); }
    setAvatar({ k: 'img', v: d }); toast('התמונה עודכנה');
  } catch(e){ toast('לא הצלחנו לקרוא את התמונה. נסו תמונה אחרת.'); }
  finally { URL.revokeObjectURL(url); }
}
['avcam', 'avfile'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', () => { const f = el.files && el.files[0]; el.value = ''; loadAvatarFile(f); }); });

/* ---------- connect: the store (Firestore or this phone only, src/data/connect.ts), then the last table ----------
   dbReady renders synchronously while this script is still loading (rule 2): what it reaches is declared above. */
// One write at a time per document (src/data/writes.ts). Never writes to a table this build doesn't understand.
const writer = createWriter({ store: () => S.db, onError: e => handleErr(e),
  refuse: path => !!(S.code && S.room && tableUnsupported(S.room) && (path === 'rooms/' + S.code || path.startsWith('rooms/' + S.code + '/'))) });
let roomsUnsub = null;
const dbReady = (async () => {
  const c = connect(window.FIREBASE_CONFIG, window.firebase, ls);
  S.db = c.store; S.mode = c.mode;
  subRooms();
  const hash = (location.hash || '').replace('#', '').toUpperCase();
  const last = /^[A-Z]{4}$/.test(hash) ? hash : ls.get('chips.room');
  if (last && !S.code) enterRoom(last); else render();
})();

function subRooms(){
  if (roomsUnsub) roomsUnsub();
  roomsUnsub = S.db.collection('rooms').orderBy('updatedAt','desc').limit(6).onSnapshot(s => {
    S.rooms = s.docs.filter(d => d.exists).map(d => normalizeRoom(d.data())).filter(r => !r.closed && now() - (r.updatedAt||0) < 1000*60*60*48);
    if (!S.code) renderRooms();
  }, () => {});
}
function useLocal(){
  leaveSubs(); S.db = createLocalStore(ls); S.mode = 'local'; S.readOnly = false; S.code = null; ls.del('chips.room'); subRooms(); render();
}

/* ---------- writes, one at a time per document (the queue is src/data/writes.ts; `writer` is made above dbReady) ---------- */
function w(path, op, data){ return writer.write(path, op, data); }
function handleErr(e){
  const code = e && e.code;
  if (code === 'permission-denied') toast('השרת חסם את העדכון. בדקו שהדבקתם את חוקי האבטחה של Firestore.');
  else if (code === 'resource-exhausted') toast('נגמרה המכסה היומית החינמית של Firebase. נסו שוב מחר.');
  else if (code === 'not-found') toast('השולחן או השחקן כבר לא קיימים.');
  else toast('העדכון לא נשמר. בדקו חיבור ונסו שוב.');
}
// A stack change made by the dealer is an increment, so it adds to whatever the player's document holds on the
// server instead of overwriting it with a number worked out from a possibly stale copy.
function inc(n){ return writer.inc(n); }
const roomPath = () => 'rooms/' + S.code;
const pPath = (id = S.myId) => 'rooms/' + S.code + '/players/' + id;
const setEvent = t => ({ lastEvent: { t, ts: now() }, updatedAt: now() });

/* ---------- room session ---------- */
function leaveSubs(){ S.unsubs.forEach(u => { try { u(); } catch(e){} }); S.unsubs = []; }
function enterRoom(code){
  leaveSubs();
  Object.assign(S, { syncErr:null, synced:false, pSynced:false, code, room:null, roomLoaded:false, players:{}, pending:0, sheet:null, confirm:null });
  FX.ov = {}; FX.pendFly = 0; S.rotOff = false;
  ls.set('chips.room', code);
  const mine = code;
  const onErr = e => { if (S.code !== mine) return; S.syncErr = (e && e.code) || 'error'; toast('שגיאת סנכרון: ' + S.syncErr); render(); if (e && (e.code === 'unavailable' || e.code === 'internal')) setTimeout(() => { if (S.code === mine) enterRoom(mine); }, 2500); };
  S.unsubs.push(S.db.doc('rooms/' + code).onSnapshot(s => {
    if (S.code !== mine) return;
    if (!s.exists){ if (!s.metadata.fromCache){ S.room = null; S.roomLoaded = true; render(); } return; }
    const nr = normalizeRoom(s.data()); let run = null; try { run = tableUnsupported(nr) ? null : fxRoom(S.room, nr); } catch(e){ console.error(e); }
    S.room = nr; S.roomLoaded = true; S.synced = !s.metadata.fromCache; render();
    if (run) try { run(); } catch(e){ console.error(e); }
  }, onErr));
  S.unsubs.push(S.db.collection('rooms/' + code + '/players').onSnapshot(s => {
    if (S.code !== mine) return;
    const m = {}; s.docs.forEach(d => { if (d.exists) m[d.id] = normalizePlayer(d.data()); });
    let runs = []; try { runs = tableUnsupported(S.room) ? [] : fxPlayers(S.players, m); } catch(e){ console.error(e); }
    S.players = m; S.pSynced = !s.metadata.fromCache; render();
    runs.forEach(f => { try { f(); } catch(e){ console.error(e); } });
  }, onErr));
  wake(); render();
}
function goHome(){ leaveSubs(); unlockTurn(); finHide(); try { history.replaceState(null, '', location.pathname); } catch(e){} S.code = null; S.room = null; S.sheet = null; ls.del('chips.room'); render(); }

let lock = null;
async function wake(){ try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => lock = null); } } catch(e){} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.code) wake(); });

const players = () => Object.entries(S.players).map(([pid, d]) => ({ pid, ...d })).sort((a,b) => (a.joinedAt||0) - (b.joinedAt||0));
const me = () => S.players[S.myId] ? { pid: S.myId, ...S.players[S.myId] } : null;
const isHost = () => S.room && S.room.hostId === S.myId;
const newPlayer = (stack) => ({ name: S.name.trim().slice(0,20) || 'שחקן', joinedAt: now(), stack, handId:0, streetId:0, streetBet:0, committed:0, folded:false, allIn:false, sittingOut:false, bjRound:null, hands:[], insurance:0, surrendered:false, lastAction:null, ts: now(), avatar: S.avatar || null });
const nameOf = id => (S.players[id] && S.players[id].name) || (S.room && S.room.hostId === id && S.room.hostName) || 'שחקן';

/* ---------- chip denominations ----------
   The chip rules (DEN, chipsOf, okChips, handStack, handHalves…) live in src/domain/chips.ts; the HTML stays here. */
function denoms(){ const r = S.room; return denomsFor(r.game, r.sb, r.minBet); }
const chipStyle = d => { const dark = [5,10,25,100,250,500,2500,5000,10000].includes(d); return `--c:var(--c${d});--e:${d===1||d===2||d===1000?'var(--c5)':'var(--chalk)'};--t:${dark?'#fff':'#1a1a1a'}`; };
// A stack can be drawn from an amount (made up from the biggest chips) or from the exact chips a player put down.
function stackHTML(amt, per = 8){
  const c = Array.isArray(amt) ? amt : chipsOf(amt); if (!c.length) return '';
  const p = c.length > per * 4 ? Math.ceil(c.length / 4) : c.length > per * 3 ? Math.ceil(c.length / 3) : per, cols = [];
  for (let i = 0; i < c.length; i += p) cols.push(c.slice(i, i + p));
  return `<div class="stk">${cols.map(col => `<div class="col" style="--n:${col.length}">${col.map((d, i) => `<i class="cd" style="${chipStyle(d)};--i:${i}"></i>`).join('')}</div>`).join('')}</div>`;
}
// The chips in your hand right now. Anything that changed the pending amount without chips (presets, clearing) resets it.
function pendChips(){ if (sumOf(S.pendChips) !== S.pending) S.pendChips = chipsOf(S.pending); return S.pendChips; }

/* ---------- turning document changes into animations ----------
   Every player write sets lastAction and ts, so a new ts tells us exactly what just happened.
   Each handler may set an override before the render, and returns a function that runs after it. */
function fxPlayers(old, nw){
  const r = S.room; if (!r) return [];
  const runs = [];
  for (const pid in nw){
    const a = old[pid], b = nw[pid];
    if (!a || !b || !b.lastAction || (b.ts || 0) === (a.ts || 0)) continue;
    const f = (r.game === 'holdem' ? fxHold : fxBJ)(pid, a, b, r);
    if (f) runs.push(f);
  }
  return runs;
}
function fxBJ(pid, a, b, r){
  const k = b.lastAction.k, mine = pid === S.myId, A = a.hands || [], B = b.hands || [];
  const sum = hs => hs.reduce((x, h) => x + (h.bet || 0), 0);
  const seat = () => seatTarget(pid), spot = j => rectOf(`spot:${pid}:${j}`), u = unitPx();
  if (k === 'bet'){
    const prev = a.bjRound === b.bjRound ? A : [], d = sum(B) - sum(prev); if (d <= 0) return null;
    if (mine) return () => { SND.chips(4); pulse(`spot:${pid}:0`, 1.08); };      // my pending chips were already on the spot
    const pc = prev[0] ? handStack(prev[0]) : [], nc = B[0] ? handStack(B[0]) : d;      // just the chips added this time
    const delta = Array.isArray(nc) && Array.isArray(pc) && pc.every((x, n) => nc[n] === x) && sumOf(nc.slice(pc.length)) === d ? nc.slice(pc.length) : d;
    const tok = setOv(pid, { hands: prev }, 700);
    return () => fly({ from: seat(), to: spot(0), amt: delta, sound: SND.slide, land: () => { SND.chips(3); clearOv(pid, tok); } });
  }
  if (k === 'clear'){
    const amt = sum(A); if (!amt) return null;
    const from = oldRect(`spot:${pid}:0`), tok = setOv(pid, { stack: a.stack }, 700);
    return () => fly({ from, to: seat(), amt: A.length === 1 ? handStack(A[0]) : amt, fadeOut: true, sound: SND.slide, land: () => { SND.chips(2); clearOv(pid, tok); } });
  }
  if (k === 'double'){
    const i = B.findIndex((h, j) => h.doubled && !(A[j] && A[j].doubled)); if (i < 0) return null;
    const half = B[i].bet / 2, hv = handHalves(B[i]);
    const tok = setOv(pid, { hands: B.map((h, j) => j === i ? { ...h, doubled: false, bet: half, chips: Array.isArray(hv[0]) ? hv[0] : undefined } : h) }, 800);
    return () => { SND.whoosh(); const t = spot(i); fly({ from: seat(), to: shift(t, u * 3.8), amt: hv[1], dur: 600, land: () => { SND.chips(4); clearOv(pid, tok); pulse(`spot:${pid}:${i}`); floatText(shift(t, 0, -u * 9), '×2'); } }); };
  }
  if (k === 'split'){
    if (B.length <= A.length) return null;
    const same = (x, y) => x && y && x.bet === y.bet && !!x.split === !!y.split && !!x.doubled === !!y.doubled && x.result === y.result;
    let j = 0; while (j < A.length && same(A[j], B[j])) j++;
    const i = A[j] && !A[j].split && B[j] && B[j].split && A[j].bet === B[j].bet ? j : Math.max(0, j - 1);
    const from = oldRect(`spot:${pid}:${i}`);
    const tok = setOv(pid, { hands: B.map((h, x) => x === i || x === i + 1 ? { ...h, _hide: true } : h) }, 900);
    return () => {
      SND.whoosh();
      fly({ from, to: spot(i), amt: handStack(B[i]), dur: 420, lift: 12, land: () => { const o = FX.ov[pid]; if (o && o.tok === tok){ o.hands[i]._hide = false; render(); } } });
      fly({ from: seat(), to: spot(i + 1), amt: handStack(B[i + 1]), delay: 140, dur: 580, land: () => { SND.chips(4); clearOv(pid, tok); const t = spot(i + 1); floatText(shift(t, 0, -u * 9), 'ספליט'); } });
    };
  }
  if (k === 'ins'){
    const amt = b.insurance || 0; if (!amt) return null;
    const tok = setOv(pid, { ins: 0 }, 700);
    return () => fly({ from: seat(), to: rectOf('ins:' + pid), amt, sound: SND.slide, land: () => { SND.chips(3); clearOv(pid, tok); } });
  }
  if (k === 'surrender'){
    const h = B[0]; if (!h) return null; const back = Math.floor(h.bet / 2); if (!back) return null;
    const tok = setOv(pid, { stack: a.stack }, 700);
    return () => { SND.fold(); fly({ from: spot(0), to: seat(), amt: back, fadeOut: true, land: () => { SND.chips(2); clearOv(pid, tok); } }); };
  }
  if (k === 'bjpay'){
    setTimeout(() => SND.say('blackjack'), 400);
    const h0 = A[0]; if (!h0) return null; const win = b.lastAction.amt || 0, from = oldRect(`spot:${pid}:0`);
    const tok = setOv(pid, { hands: [{ ...h0, _hide: true }], stack: a.stack }, 1700);
    return () => {
      const dealer = rectOf('dealer'), st = seat(), f = from || spot(0), off = shift(f, u * 4.2);
      dealerNod(); SND.chips(3); floatText(shift(f, 0, -u * 10), "בלאק ג'ק!");
      fly({ from: f, to: st, amt: handStack(h0), delay: 1000, fadeOut: true });
      fly({ from: dealer, to: off, amt: win, delay: 120, dur: 600, sound: () => SND.chips(3), land: () => fly({ from: off, to: st, amt: win, delay: 280, fadeOut: true }) });
      setTimeout(() => { clearOv(pid, tok); SND.chips(4); pulse('seat:' + pid, 1.2); floatText(shift(rectOf('seat:' + pid) || st, 0, -u * 12), '+' + fmt(win), 'w'); if (mine) SND.bj(); }, 1560);
    };
  }
  if (k === 'bjres'){
    if (!B.length) return null;
    const T1 = 1000, from = A.map((_, j) => oldRect(`spot:${pid}:${j}`)), insFrom = oldRect('ins:' + pid);
    const tok = setOv(pid, { hands: A.map(h => ({ ...h, _hide: true })), ins: 0, stack: a.stack, hideRes: true }, T1 + 700);
    return () => {
      const dealer = rectOf('dealer'), st = seat(); let handsNet = 0, anyBJ = false;
      B.forEach((h, j) => {
        if (h.paid) return;                                    // already paid when the dealer declared the blackjack
        const f = from[j] || spot(j), amt = handStack(A[j] || h), res = h.result;
        if (res === 'lose' || res === 'surrender'){
          handsNet -= res === 'lose' ? h.bet : h.bet - Math.floor(h.bet / 2);
          fly({ from: f, to: dealer, amt, delay: 80 * j, dur: 640, fadeOut: true, sound: SND.slide });
        } else if (res === 'push'){
          fly({ from: f, to: st, amt, delay: T1, fadeOut: true });
        } else if (res === 'win' || res === 'bj'){
          const pay = res === 'bj' ? Math.floor(h.bet * 1.5) : h.bet, off = shift(f, u * 4.2), d0 = 120 + 80 * j;
          handsNet += pay; anyBJ = anyBJ || res === 'bj';
          fly({ from: f, to: st, amt, delay: T1, fadeOut: true });
          fly({ from: dealer, to: off, amt: pay, delay: d0, dur: 600, sound: () => SND.chips(3), land: () => fly({ from: off, to: st, amt: pay, delay: Math.max(0, T1 - d0 - 600), fadeOut: true }) });
        }
      });
      const ins = a.insurance || 0;
      if (ins){
        const won = (b.lastAction.amt || 0) - handsNet > 0, f = insFrom || rectOf('ins:' + pid);
        if (!won) fly({ from: f, to: dealer, amt: ins, dur: 600, fadeOut: true });
        else { const off = shift(f, u * 3.4); fly({ from: f, to: st, amt: ins, delay: T1, fadeOut: true }); fly({ from: dealer, to: off, amt: ins * 2, delay: 160, dur: 600, land: () => fly({ from: off, to: st, amt: ins * 2, delay: Math.max(0, T1 - 760), fadeOut: true }) }); }
      }
      const net = b.lastAction.amt || 0;
      setTimeout(() => {
        clearOv(pid, tok); if (net >= 0) SND.chips(4);
        pulse('seat:' + pid, 1.2);
        floatText(shift(rectOf('seat:' + pid) || st, 0, -u * 12), net > 0 ? '+' + fmt(net) : net < 0 ? '−' + fmt(-net) : 'תיקו', net > 0 ? 'w' : net < 0 ? 'l' : 'p');
        if (mine){ if (net > 0) (anyBJ ? SND.bj : SND.win)(); else if (net < 0) SND.lose(); else SND.push(); }
      }, (B.some(h => ['win', 'bj', 'push'].includes(h.result)) || (ins && net > handsNet) ? T1 + 560 : 760));
    };
  }
  if (k === 'refund'){
    const amt = b.lastAction.amt || 0;
    if (A.length && !B.length){        // the dealer cancelled the round: bets go back from the spots
      const fr = A.map((_, j) => oldRect(`spot:${pid}:${j}`)), fi = a.insurance ? oldRect('ins:' + pid) : null;
      const tok = setOv(pid, { hands: A.map(h => ({ ...h, _hide: true })), ins: 0, stack: a.stack }, 800);
      return () => { const st = seat(); SND.slide(); A.forEach((h, j) => { if (!h.paid) fly({ from: fr[j], to: st, amt: handStack(h), delay: 70 * j, fadeOut: true }); }); if (fi) fly({ from: fi, to: st, amt: a.insurance, fadeOut: true }); setTimeout(() => { SND.chips(3); clearOv(pid, tok); }, 640); };
    }
    if (!amt) return null;
    if (amt > 0){ const tok = setOv(pid, { stack: a.stack }, 700); return () => fly({ from: rectOf('dealer'), to: seat(), amt, fadeOut: true, sound: SND.slide, land: () => { SND.chips(3); clearOv(pid, tok); } }); }
    return () => fly({ from: seat(), to: rectOf('dealer'), amt: -amt, fadeOut: true, sound: SND.slide, land: () => SND.chips(2) });
  }
  return null;
}
function fxHold(pid, a, b, r){
  const k = b.lastAction.k;
  if (k === 'allin' && FX.allinHand !== r.handId){ FX.allinHand = r.handId; setTimeout(() => SND.say('allin'), 350); }
  if (['blind', 'call', 'bet', 'raise', 'allin'].includes(k)){
    const d = (a.stack || 0) - (b.stack || 0); if (d <= 0) return null;
    const c = b.lastAction.chips;
    return () => fly({ from: seatTarget(pid), to: rectOf('pot'), amt: okChips(c, d) ? c : d, sound: SND.slide, land: () => { SND.chips(3); pulse('pot', 1.06); } });
  }
  if (k === 'won' || k === 'refund'){
    const d = (b.stack || 0) - (a.stack || 0); if (d <= 0) return null;
    const tok = setOv(pid, { stack: a.stack }, 700);
    return () => fly({ from: rectOf('pot'), to: seatTarget(pid), amt: d, fadeOut: true, sound: SND.slide, land: () => { SND.chips(4); clearOv(pid, tok); if (k === 'won'){ pulse('seat:' + pid, 1.2); if (pid === S.myId) SND.win(); } } });
  }
  if (k === 'check') return () => SND.knock();
  if (k === 'fold') return () => SND.fold();
  return null;
}
function fxRoom(a, b){
  if (!a || !b || a.code !== b.code) return null;
  const runs = [];
  if (!a.closed && b.closed && b.final) runs.push(() => ceremony());              // the ceremony says 'winner' at the reveal
  if (b.game === 'blackjack' && a.phase === 'betting' && b.phase === 'playing' && a.roundId === b.roundId) runs.push(() => { lockFx(); SND.say('locked'); });
  // a round that was paid (not cancelled): the payout line, then the dealer opens the next round
  if (a.game === 'blackjack' && b.game === 'blackjack' && a.phase === 'playing' && b.phase === 'betting' && (b.roundId || 0) > (a.roundId || 0) && (b.roundEnd ? b.roundEnd === 'paid' : /שולם/.test((b.lastEvent && b.lastEvent.t) || '')))   // roundEnd is missing when an older phone did the payout
    runs.push(() => { SND.say('payout'); setTimeout(() => SND.say('open'), 2500); });
  if (b.game === 'holdem' && (b.handId || 0) > (a.handId || 0)) runs.push(() => { SND.bell(); dealerNod(); SND.say('newhand'); });
  else if (b.game === 'holdem' && a.stage !== b.stage && ['flop', 'turn', 'river'].includes(b.stage)) runs.push(() => SND.say(b.stage));
  return runs.length ? () => runs.forEach(f => f()) : null;
}
// The dealer locked the bets: a bell, and every stack on the felt gives a little bump.
function lockFx(){ SND.bell(); dealerNod(); players().filter(cur).forEach(p => p.hands.forEach((_, j) => pulse(`spot:${p.pid}:${j}`, 1.1))); }

/* ---------- Hold'em model ----------
   The rules live in src/domain/holdem/ (rules.ts, pots.ts). This section reads S, writes what they return
   (dealer stack changes as increments) and says it in Hebrew. */
const STAGES = HR.STAGES;
const STAGE_HE = { idle:'בין ידיים', preflop:'פרה-פלופ', flop:'פלופ', turn:'טרן', river:'ריבר', showdown:'שואודאון' };
function H(){ return HR.holdemState(S.room, players()); }
const canAct = HR.canAct;

async function hAct(add, kind){
  const res = HR.bet(H(), me(), add, pendChips(), kind); if (!res.ok) return;
  buzz();
  const ok = await w(pPath(), 'update', { ...res.patch, ts: now() });
  if (ok) S.pending = 0;
  render();
}
async function hFold(){ const res = HR.fold(H(), me()); if (!res.ok) return; buzz(); await w(pPath(), 'update', { ...res.patch, ts: now() }); }

async function newHand(){
  const r = S.room, plan = HR.newHand(r, players());
  if (!plan.ok){ toast(plan.reason === 'pot-not-empty' ? 'יש עדיין צ\'יפים בקופה. חלקו את הקופה או בטלו את היד.' : 'צריך לפחות שני שחקנים עם צ\'יפים'); return; }
  const ok = await w(roomPath(), 'update', { ...plan.room, ...setEvent(`יד ${plan.room.handId} התחילה · בליינדים ${fmt(r.sb)}/${fmt(r.bb)}`) });
  if (!ok) return;
  buzz();
  await Promise.all(plan.posts.map(x => w(pPath(x.pid), 'update', { ...x.patch, ts: now() })));
}
async function nextStreet(){
  const res = HR.nextStreet(S.room); if (!res.ok) return;
  buzz();
  await w(roomPath(), 'update', { ...res.patch, ...setEvent(STAGE_HE[res.patch.stage]) });
}
function computeAward(win){ return Pots.computeAward(H(), win); }
async function award(win){
  const res = Pots.award(H(), win); if (!res.ok){ toast('בחרו זוכה'); return; }
  const names = res.pays.map(([id,a]) => `${nameOf(id)} +${fmt(a)}`).join(' · ');
  const ok = await w(roomPath(), 'update', { ...res.room, ...setEvent(names) });
  if (!ok) return;
  buzz();
  await Promise.all(res.pays.map(([id,a]) => w(pPath(id), 'update', { stack: inc(a), lastAction: { k:'won', amt:a }, ts: now() })));
  S.sel = [];
  if (res.left === 0) S.sheet = null; else toast(`נשארה קופה צדדית של ${fmt(res.left)} – בחרו את הזוכה בה`);
  render();
}
async function cancelHand(){
  const c = Pots.cancelHandRefunds(H());
  await w(roomPath(), 'update', { ...c.room, ...setEvent('היד בוטלה והצ\'יפים הוחזרו') });
  await Promise.all(c.refunds.map(x => w(pPath(x.pid), 'update', { stack: inc(x.amt), lastAction:{ k:'refund', amt: x.amt }, ts: now() })));
  S.sheet = null; S.confirm = null; render();
}

/* ---------- Blackjack model ----------
   The rules live in src/domain/blackjack/ (rules.ts, actions.ts, round.ts); see the Hold'em model above. */
const cur = p => BJ.isCurrent(p, S.room);
const bjStake = BJ.stake;
async function bjBet(){
  const r = S.room, res = BJA.placeBet(me(), r, S.pending, pendChips());
  if (!res.ok){
    if (res.reason === 'over-max') toast(`ההימור המקסימלי הוא ${fmt(r.maxBet)}`);
    else if (res.reason === 'under-min') toast(`ההימור המינימלי הוא ${fmt(r.minBet)}`);
    return;
  }
  buzz();
  const pend = S.pending, pc = S.pendChips; S.pending = 0; S.pendChips = []; FX.pendFly = 0;
  const ok = await w(pPath(), 'update', { ...res.patch, ts: now() });
  if (!ok){ S.pending = pend; S.pendChips = pc; } render();
}
async function bjClear(){
  const res = BJA.clearBet(me(), S.room); if (!res.ok) return;
  await w(pPath(), 'update', { ...res.patch, ts: now() });
}
async function bjDo(kind, i){
  const res = BJA.play(me(), S.room, kind, i); if (!res.ok) return;
  buzz();
  await w(pPath(), 'update', { ...res.patch, ts: now() });
}
async function bjPayout(){
  const r = S.room, res = BJR.settleRound(r, players(), S.settle, S.dealerBJ);   // paid blackjacks are done
  if (!res.ok){ toast('סמנו תוצאה לכל הידיים'); return; }
  buzz();
  // Players first, then the room: nobody can open the next round while a payout is still on its way.
  const results = await Promise.all(res.writes.map(x => w(pPath(x.pid), 'update', { stack: inc(x.stackInc), ...x.patch, ts: now() })));
  if (results.some(ok => !ok)) return;      // the toast is up; pressing again pays only the players not yet settled
  const d = res.houseDelta;
  const ok = await w(roomPath(), 'update', { ...res.room, ...setEvent(`סיבוב ${r.roundId} שולם · הבית ⁦${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}⁩`) });
  if (!ok) return;
  S.sheet = null; S.settle = {}; S.dealerBJ = false; render();
}
// The dealer declares a player's blackjack mid-round: paid 3:2 at once, and the hand is marked paid
// so the end-of-round payout and a cancelled round both leave it alone.
const bjEligible = p => BJ.blackjackEligible(p, S.room);
async function bjNow(pid){
  const p = S.players[pid], res = BJA.payBlackjackNow(p, S.room); if (!res.ok) return;
  buzz();
  if (!await w(pPath(pid), 'update', { stack: inc(res.stackInc), ...res.patch, ts: now() })) return;
  await w(roomPath(), 'update', { ...res.room, ...setEvent(`${p.name}: בלאק ג'ק! +${fmt(res.win)}`) });
  S.confirm = null; if (!players().some(bjEligible)) S.sheet = null; render();
}
async function bjCancelRound(){
  const c = BJR.cancelRound(S.room, players());
  // Players first, then the room (see bjPayout); bjPaidRound keeps a retry from refunding twice.
  const results = await Promise.all(c.refunds.map(x => w(pPath(x.pid), 'update', { stack: inc(x.stackInc), ...x.patch, ts: now() })));
  if (results.some(ok => !ok)) return;
  if (!await w(roomPath(), 'update', { ...c.room, ...setEvent('הסיבוב בוטל וההימורים הוחזרו') })) return;
  S.sheet = null; S.confirm = null; render();
}

/* ---------- create / join ---------- */
const randCode = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 24]).join('');
async function createRoom(){
  if (!S.name.trim()){ toast('כתבו את השם שלכם קודם'); document.getElementById('name')?.focus(); return; }
  await dbReady;
  if (S.readOnly){ toast('אין לך הרשאת כתיבה בשולחן המשותף'); return; }
  const c = S.create, n = v => Math.max(0, Math.floor(Number(v) || 0));
  if (n(c.stack) < 1){ toast('קבעו כמות צ\'יפים התחלתית'); return; }
  let code = randCode();
  for (let i = 0; i < 4; i++){ try { const s = await S.db.doc('rooms/' + code).get(); if (!s.exists) break; } catch(e){ break; } code = randCode(); }
  const room = { code, game: c.game, startStack: n(c.stack), sb: Math.max(1, n(c.sb)), bb: Math.max(1, n(c.bb)), minBet: Math.max(1, n(c.minBet)), maxBet: n(c.maxBet),
    hostId: S.myId, hostName: S.name.trim().slice(0,20), createdAt: now(), handId:0, streetId:0, stage:'idle', potLevel:0, buttonPid:null, roundId:1, phase:'betting', house:0, dealerBJ:false, ...setEvent('השולחן נפתח') };
  if (!await w('rooms/' + code, 'set', room)) return;
  S.code = code;
  if (c.play) await w('rooms/' + code + '/players/' + S.myId, 'set', newPlayer(room.startStack));
  enterRoom(code);
}
async function joinTable(){
  if (!S.name.trim()){ toast('כתבו את השם שלכם קודם'); document.getElementById('jname')?.focus(); return; }
  ls.set('chips.name', S.name.trim());
  await w(pPath(), 'set', newPlayer(S.room.startStack || 0));
}
function claimSeat(pid){ S.myId = pid; ls.set('chips.pid', pid); S.pending = 0; render(); }

/* ---------- UI helpers ---------- */
let tt;
function toast(t){ toastEl.textContent = t; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => toastEl.hidden = true, 3200); }
function hue(s){ let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
const avatar = (p, k) => `<div class="av"${k ? ` data-k="${esc(k)}"` : ''} style="${avBg(p)}">${avInner(p)}</div>`;
const actText = a => { if (!a) return ''; const x = fmt(a.amt); return ({ fold:'קיפל', check:'צ\'ק', call:`השווה ${x}`, raise:`העלה ל-${x}`, bet:`הימר ${x}`, allin:`אול-אין ${x}`, blind:`בליינד ${x}`, won:`זכה ב-${x}`, refund:`הוחזר ${x}`, clear:'ביטל הימור', double:'דאבל דאון', split:'ספליט', ins:'ביטוח', surrender:'כניעה', bjres: a.amt > 0 ? `הרוויח ${x}` : a.amt < 0 ? `הפסיד ${fmt(-a.amt)}` : 'תיקו' })[a.k] || ''; };
const RES_HE = { win:'ניצחון', bj:'בלאק ג\'ק', push:'תיקו', lose:'הפסד', surrender:'כניעה' };

/* ---------- turn-the-phone prompt: shown only inside a table, on a phone held upright ---------- */
const canLock = () => !!(window.screen && screen.orientation && screen.orientation.lock && document.documentElement.requestFullscreen);
function renderRot(){
  const show = !!(S.code && S.room && !S.rotOff && PORTRAIT_PHONE.matches);
  if (!show){ if (!rotEl.hidden){ rotEl.hidden = true; rotEl.innerHTML = ''; } return; }
  if (!rotEl.hidden) return;                       // already showing: don't restart the animation on every update
  rotEl.innerHTML = `<div class="rot-card" role="dialog" aria-modal="true" aria-labelledby="rot-t">
    <div class="rot-anim" aria-hidden="true">
      <svg class="rot-arrow" viewBox="0 0 120 120"><path d="M96 34 A46 46 0 0 0 30 30"/><path d="M38 22 L28 31 L41 36"/></svg>
      <div class="phone"><div class="scr"><div class="scr-in"><i class="mf"></i><i class="mc a"></i><i class="mc b"></i><i class="mc c"></i></div></div></div>
    </div>
    <h2 id="rot-t">סובבו את הטלפון</h2>
    <p class="muted">לרוחב יש לשולחן הרבה יותר מקום: כל השחקנים, הצ'יפים והכפתורים במסך אחד.</p>
    ${canLock() ? '<button class="btn primary wide" data-a="rotlock">מסך מלא לרוחב</button>' : ''}
    <button class="btn ghost wide" data-a="rotoff">להמשיך לאורך</button>
  </div>`;
  rotEl.hidden = false;
}
function unlockTurn(){ try { screen.orientation.unlock(); } catch(e){} try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch(e){} }

/* ---------- the dealer: an original illustration, standing behind the table ---------- */
function dealerSVG(){
  const ph = `animation-delay:-${((now() % 5200) / 1000).toFixed(2)}s`;    // keeps the blink rhythm steady across re-renders
  return `<svg class="dsvg" viewBox="0 0 120 110" aria-hidden="true">
    <defs><linearGradient id="dg-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c8a6"/><stop offset="1" stop-color="#dca783"/></linearGradient></defs>
    <path d="M52.5 52H67.5L68 66Q60 70 52 66Z" fill="#d49e7b"/>
    <path d="M16 110C16 80 32 63 60 63S104 80 104 110Z" fill="#f4f1ea"/>
    <path d="M16 110C16 82 30 66 48 63.5L60 90V110Z" fill="#17171c"/><path d="M104 110C104 82 90 66 72 63.5L60 90V110Z" fill="#17171c"/>
    <circle cx="60" cy="94" r="1.2" fill="#e0b766"/><circle cx="60" cy="102" r="1.2" fill="#e0b766"/><rect x="75" y="80" width="12" height="4.2" rx="1" fill="#e0b766"/>
    <path d="M51 62L60 70L55 76L46 65Z" fill="#fff"/><path d="M69 62L60 70L65 76L74 65Z" fill="#fff"/>
    <path d="M60 70L50.5 65.5V74.5ZM60 70L69.5 65.5V74.5Z" fill="#b3203c"/><circle cx="60" cy="70" r="2.3" fill="#86152d"/>
    <g class="dhead">
      <circle cx="60" cy="11.5" r="8.5" fill="#3a2217"/><path d="M53 13Q60 9 67 13" stroke="#5a3626" stroke-width="1.2" fill="none"/>
      <ellipse cx="44.6" cy="39" rx="3" ry="4.2" fill="#e0ab88"/><ellipse cx="75.4" cy="39" rx="3" ry="4.2" fill="#e0ab88"/>
      <ellipse cx="60" cy="37" rx="15.5" ry="18.5" fill="url(#dg-skin)"/>
      <path d="M44 38C41 19 51 15.5 60 15.5S79 19 76 38C75 30 71 25 64 24C57 27 50 30 44 38Z" fill="#3a2217"/>
      <path d="M64 24C58 26.5 52 29.5 47 34C51 28 57 25 64 24Z" fill="#5a3626"/>
      <circle cx="44.6" cy="45.2" r="1.8" fill="#e0b766"/><circle cx="75.4" cy="45.2" r="1.8" fill="#e0b766"/>
      <path d="M49.5 32.3Q53.5 30.1 57 32.1M63 32.1Q66.5 30.1 70.5 32.3" stroke="#3a2217" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <ellipse cx="53.5" cy="37.6" rx="2" ry="2.5" fill="#2a1a12"/><ellipse cx="66.5" cy="37.6" rx="2" ry="2.5" fill="#2a1a12"/>
      <circle cx="54.2" cy="36.7" r=".75" fill="#fff"/><circle cx="67.2" cy="36.7" r=".75" fill="#fff"/>
      <path d="M51.3 36.3L49.8 35.1M68.7 36.3L70.2 35.1" stroke="#2a1a12" stroke-width=".9" stroke-linecap="round"/>
      <g class="lids" style="${ph}"><ellipse cx="53.5" cy="37.4" rx="2.7" ry="3.1" fill="#edc19e"/><ellipse cx="66.5" cy="37.4" rx="2.7" ry="3.1" fill="#edc19e"/></g>
      <path d="M60 39.5Q58.8 43.5 60.8 44.2" stroke="#c48a68" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <ellipse cx="50.6" cy="44.6" rx="3" ry="1.8" fill="#f08a8a" opacity=".35"/><ellipse cx="69.4" cy="44.6" rx="3" ry="1.8" fill="#f08a8a" opacity=".35"/>
      <path d="M55.4 47.6Q60 52.2 64.6 47.6Q60 49.4 55.4 47.6Z" fill="#c2414f"/>
    </g>
  </svg>`;
}
function dealerNod(){ if (RM) return; document.querySelectorAll('.dhead').forEach(el => { try { el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg) translateY(1px)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }], { duration: 750, easing: 'ease-in-out' }); } catch(e){} }); }

/* ---------- the end of the game: announce the winner, close the table ---------- */
const standings = () => players().map(p => ({ pid: p.pid, name: p.name, stack: p.stack || 0 })).sort((a, b) => b.stack - a.stack);
function rankHTML(list, top = list[0] ? list[0].stack : 0){
  return `<ol class="rank">${list.map((x, i) => {
    const place = list.findIndex(y => y.stack === x.stack) + 1;      // equal stacks share a place
    return `<li class="${x.stack === top ? 'win' : ''}" style="--d:${i}"><span class="pl num">${place}</span>${avatar(S.players[x.pid] ? { ...x, avatar: S.players[x.pid].avatar } : x)}<b>${esc(x.name)}</b><span class="num">${fmt(x.stack)}</span></li>`;
  }).join('')}</ol>`;
}
async function endGame(){
  const list = standings(); if (!list.length){ toast('אין שחקנים בשולחן'); return; }
  const top = list[0].stack, win = list.filter(x => x.stack === top);
  const t = win.length > 1 ? `תיקו בצמרת: ${win.map(x => x.name).join(' ו')} עם ${fmt(top)}` : `${win[0].name} ניצח/ה עם ${fmt(top)} צ'יפים`;
  if (await w(roomPath(), 'update', { closed: true, final: { at: now(), list }, ...setEvent('המשחק הסתיים · ' + t) })){ S.sheet = null; render(); }
}
const CROWN = '<svg class="crown" viewBox="0 0 64 40" aria-hidden="true"><path d="M4 34L8 8l14 13L32 3l10 18L56 8l4 26Z" fill="#e0b766" stroke="#8a6420" stroke-width="2" stroke-linejoin="round"/><rect x="4" y="32" width="56" height="6" rx="2" fill="#c99a45"/><circle cx="32" cy="22" r="3.5" fill="#c8372d"/><circle cx="17" cy="25" r="2.6" fill="#2f5fb8"/><circle cx="47" cy="25" r="2.6" fill="#2e8a4f"/></svg>';
function closedSign(){ const drop = FX.signDrop && now() - FX.signDrop < 1800; return `<div class="csign${drop ? ' drop' : ''}" aria-label="השולחן סגור"><span>השולחן סגור</span></div>`; }
function finalCard(){
  const f = S.room.final || {}, list = f.list || [], top = list[0] ? list[0].stack : 0, win = list.filter(x => x.stack === top);
  return `<section class="host fincard"><h3>המשחק הסתיים</h3>
    ${win.length ? `<div class="fc-win">${CROWN}<b>${win.map(x => esc(x.name)).join(' ו')}</b><span class="muted">${win.length > 1 ? 'תיקו בצמרת' : 'המנצח/ת'} · <span class="num">${fmt(top)}</span> צ'יפים</span></div>` : ''}
    ${rankHTML(list)}
    <div class="btns"><button class="btn" data-a="replay">צפייה בטקס שוב</button>${isHost() ? '<button class="btn ghost" data-a="reopen">פתיחת השולחן מחדש</button>' : ''}<button class="btn ghost" data-a="home">למסך הראשי</button></div>
  </section>`;
}
let finTimers = [];
function finHide(){ finTimers.forEach(clearTimeout); finTimers = []; finEl.hidden = true; finEl.innerHTML = ''; FX.cer = false; }
const looksClosed = () => !!(S.room && S.room.closed && !FX.cer);
function chipRain(n){
  if (RM) return; const cols = DEN.slice(0, 11);
  for (let i = 0; i < n; i++){
    const el = document.createElement('i'), d = cols[Math.floor(Math.random() * cols.length)], sz = 16 + Math.random() * 20;
    el.className = 'cf'; el.style.cssText = `${chipStyle(d)};left:${Math.random() * 100}%;width:${sz}px;height:${sz}px`;
    finEl.appendChild(el);
    const sway = (Math.random() - .5) * 160, spin = 360 + Math.random() * 900;
    try { el.animate([{ transform: 'translate(0,-12vh) rotateX(0) rotate(0)' }, { transform: `translate(${sway}px,112vh) rotateX(${spin}deg) rotate(${spin / 2}deg)` }], { duration: 2400 + Math.random() * 2400, delay: Math.random() * 1600, easing: 'cubic-bezier(.35,.05,.6,1)', fill: 'both' }).onfinish = () => el.remove(); } catch(e){ el.remove(); }
  }
}
function countUp(el, to, ms){ if (!el) return; const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / ms); el.textContent = fmt(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
function ceremony(){
  const r = S.room, f = r && r.final; if (!f || !f.list || !f.list.length) return;
  finHide(); FX.cer = true; S.sheet = null; render();
  const list = f.list, top = list[0].stack, win = list.filter(x => x.stack === top), lead = win[0];
  const T = (ms, fn) => finTimers.push(setTimeout(fn, RM ? Math.min(ms, 200) : ms));
  // 1. spotlight on the winner's seat, drumroll
  const tbl = document.querySelector('.bjt, .stage .table'); if (tbl) tbl.scrollIntoView({ block: 'center', behavior: 'instant' });
  const seat = rectOf('seat:' + lead.pid), x = seat ? seat.x - scrollX : innerWidth / 2, y = seat ? seat.y - scrollY : innerHeight / 2;
  finEl.innerHTML = `<div class="fin-dim" style="--x:${x}px;--y:${y}px"></div>`;
  finEl.hidden = false; SND.drumroll(1.9); dealerNod();
  const throb = setInterval(() => pulse('seat:' + lead.pid, 1.25), 420); finTimers.push(throb);
  // 2. the reveal: fanfare, applause, the winner's card, raining chips
  T(1950, () => {
    clearInterval(throb); SND.fanfare(); SND.applause(); SND.say('winner'); setTimeout(() => SND.chips(6), 300); setTimeout(() => SND.chips(5), 900);
    finEl.insertAdjacentHTML('beforeend', `<div class="fin-card" role="dialog" aria-modal="true" aria-labelledby="fin-t">
      ${CROWN}
      <div class="fin-avs">${win.map(w_ => `<div class="fin-av" style="${avBg(S.players[w_.pid] || w_)}">${avInner(S.players[w_.pid] || w_)}</div>`).join('')}</div>
      <div class="fin-t">${win.length > 1 ? 'תיקו בצמרת!' : 'המנצח/ת!'}</div>
      <h2 id="fin-t" class="fin-name">${win.map(w_ => esc(w_.name)).join(' ו')}</h2>
      <div class="fin-amt"><span class="num" data-count>0</span> צ'יפים</div>
      <div class="fin-rest">${list.length > 1 ? rankHTML(list) : ''}
        <div class="btns"><button class="btn primary" data-a="finclose">לשולחן</button><button class="btn ghost" data-a="home">למסך הראשי</button></div></div>
    </div>`);
    finEl.querySelector('.fin-dim').classList.add('lit');
    countUp(finEl.querySelector('[data-count]'), top, 1400);
    chipRain(70); T(1500, () => chipRain(40));
  });
  // 3. the standings slide in
  T(3700, () => { const el = finEl.querySelector('.fin-rest'); if (el) el.classList.add('on'); SND.chips(3); });
}

/* ---------- views ---------- */
const ICON_SND_ON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const ICON_SND_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
function render(){
  FX.rects = measure();
  const a = document.activeElement, id = a && a.id; let s1, s2; try { s1 = a.selectionStart; s2 = a.selectionEnd; } catch(e){}
  const sideTop = (app.querySelector('.side') || {}).scrollTop || 0;      // keep the landscape panel where the player scrolled it
  if (!S.code){ app.innerHTML = homeView(); app.className = ''; renderRooms(); }
  else { app.innerHTML = roomView(); const sd = app.querySelector('.side'); if (sd && sideTop) sd.scrollTop = sideTop; }
  setU(); renderRot(); ambiSync();
  if (newBuild) setTimeout(maybeReload, 0);
  if (S.sheet && ((S.room && !tableUnsupported(S.room)) || S.sheet === 'avatar')){ sheetEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${sheetView()}</div>`; sheetEl.hidden = false; }
  else { sheetEl.hidden = true; sheetEl.innerHTML = ''; }
  if (id){ const el = document.getElementById(id); if (el && el !== document.activeElement){ el.focus({ preventScroll:true }); try { if (s1 != null) el.setSelectionRange(s1, s2); } catch(e){} } }
}

function modeBanner(){
  if (S.mode === 'pending') return `<div class="banner">מתחבר לשרת…</div>`;
  if (S.mode === 'local') return `<div class="banner"><b>מצב מכשיר אחד</b><span class="muted">האפליקציה עוד לא מחוברת לשרת, אז הכל נשמר רק בטלפון הזה. כדי לשחק ביחד, מלאו את פרטי Firebase בקובץ config.js (ההוראות בקובץ README).</span><button class="btn small ghost" data-a="retry">ניסיון חיבור מחדש</button></div>`;
  if (S.readOnly) return '';
  return '';
}

function homeView(){
  const c = S.create, hold = c.game === 'holdem';
  return `
  <header class="brand"><h1>צ'יפים<span>.</span></h1><p>הקלפים אמיתיים, הצ'יפים כאן. כל אחד מהטלפון שלו.</p></header>
  <div class="stack">
    ${installEvt ? '<button class="btn ghost wide" data-a="install">התקנת האפליקציה בטלפון</button>' : ''}
    ${modeBanner()}
    <div class="card">
      <div class="me-row"><button class="avbtn" data-a="sheet" data-v="avatar" aria-label="בחירת תמונה"><span class="av" style="${avBg(myAv())}">${avInner(myAv())}</span><span>תמונה</span></button>
      <label class="field"><span class="label">השם שלך</span><input id="name" data-bind="name" value="${esc(S.name)}" maxlength="20" placeholder="למשל: סמי" autocomplete="nickname"></label></div>
    </div>
    <div class="card">
      <span class="label">הצטרפות לשולחן</span>
      <div class="row"><input id="jcode" data-bind="joinCode" value="${esc(S.joinCode)}" maxlength="4" placeholder="קוד חדר" style="direction:ltr;text-align:center;letter-spacing:6px;font-weight:700;text-transform:uppercase"><button class="btn primary" data-a="join">הצטרפות</button></div>
      <div id="roomsList" class="rooms"></div>
    </div>
    <div class="card">
      <span class="label">שולחן חדש</span>
      <div class="seg" role="group" aria-label="סוג משחק">
        <button data-a="cgame" data-v="holdem" aria-pressed="${hold}">טקסס הולדם</button>
        <button data-a="cgame" data-v="blackjack" aria-pressed="${!hold}">בלאק ג'ק</button>
      </div>
      <label class="field"><span class="label">צ'יפים לכל שחקן</span><input id="cstack" data-bind="create.stack" inputmode="numeric" value="${esc(c.stack)}" style="direction:ltr"></label>
      ${hold ? `<div class="grid2">
        <label class="field"><span class="label">ביג בליינד</span><input id="cbb" data-bind="create.bb" inputmode="numeric" value="${esc(c.bb)}" style="direction:ltr"></label>
        <label class="field"><span class="label">סמול בליינד</span><input id="csb" data-bind="create.sb" inputmode="numeric" value="${esc(c.sb)}" style="direction:ltr"></label>
      </div>` : `<div class="grid2">
        <label class="field"><span class="label">הימור מינימלי</span><input id="cmin" data-bind="create.minBet" inputmode="numeric" value="${esc(c.minBet)}" style="direction:ltr"></label>
        <label class="field"><span class="label">הימור מקסימלי (0 = ללא)</span><input id="cmax" data-bind="create.maxBet" inputmode="numeric" value="${esc(c.maxBet)}" style="direction:ltr"></label>
      </div>`}
      <label class="check"><input type="checkbox" id="cplay" data-bind="create.play" ${c.play ? 'checked' : ''}> ${hold ? 'אני גם משחק, לא רק מנהל' : 'אני גם מהמר (לא רק הדילר)'}</label>
      <button class="btn primary wide" data-a="create">פתיחת שולחן</button>
      <span class="muted">מי שפותח את השולחן הוא הדילר: מתחיל ידיים, מקדם רחובות ומחלק את הקופה לזוכים.</span>
    </div>
  </div>`;
}
function renderRooms(){
  const el = document.getElementById('roomsList'); if (!el) return;
  el.innerHTML = S.rooms.length ? `<span class="muted">שולחנות פעילים</span>` + S.rooms.map(r => tableUnsupported(r) ? `<button class="roomrow" data-a="open" data-v="${esc(r.code)}"><span><span class="code">${esc(r.code)}</span></span><span class="muted">צריך עדכון</span></button>` : `<button class="roomrow" data-a="open" data-v="${esc(r.code)}"><span><span class="code">${esc(r.code)}</span></span><span class="muted">${r.game === 'holdem' ? 'הולדם' : 'בלאק ג\'ק'} · ${r.lastEvent ? esc(r.lastEvent.t) : ''}</span></button>`).join('') : '';
}

function roomView(){
  if (!S.roomLoaded) return `<div class="spin">טוען את השולחן…</div>`;
  if (!S.room) return `<div class="stack" style="padding-top:40px"><div class="card"><h2 style="font-family:var(--f-display);font-size:36px">החדר ${esc(S.code)} לא נמצא</h2><span class="muted">בדקו את הקוד ונסו שוב.</span><button class="btn primary" data-a="home">חזרה</button></div></div>`;
  if (tableUnsupported(S.room)){ app.className = ''; return updateView(); }
  const r = S.room, m = me(), hold = r.game === 'holdem';
  const body = hold ? holdemView() : bjView();
  const closed = !!r.closed;
  const dock = m && !closed ? (hold ? holdemDock() : bjDock()) : '';
  app.className = 'in-room' + (dock ? ' has-dock' : '');
  return `<div class="room"><div class="side">
  <div class="top">
    <button class="code-btn" data-a="copy" aria-label="העתקת קוד החדר"><small>${hold ? 'טקסס הולדם' : 'בלאק ג\'ק'} · ${S.mode === 'cloud' ? (S.syncErr ? '<span style="color:var(--danger)">שגיאה: ' + esc(S.syncErr) + '</span>' : (S.synced && S.pSynced ? '<span style="color:var(--ok)">● מחובר</span>' : '<span style="color:var(--brass)">● מתחבר…</span>')) : '<span style="color:var(--danger)">● לא מחובר</span>'}</small><span class="code">${esc(r.code)}</span></button>
    <div class="actions">
      <button class="btn small ghost icon-btn" data-a="snd" aria-label="${SND.on ? 'השתקת צלילים' : 'הפעלת צלילים'}" aria-pressed="${SND.on}">${SND.on ? ICON_SND_ON : ICON_SND_OFF}</button>
      <button class="btn small ghost" data-a="sheet" data-v="players">שחקנים</button>
      <button class="btn small ghost" data-a="sheet" data-v="settings">הגדרות</button>
    </div>
  </div>
  ${S.mode !== 'cloud' || S.readOnly ? `<div class="mb" style="margin-bottom:12px">${modeBanner()}</div>` : ''}
  ${newBuild ? `<div class="updw"><button class="btn primary wide" data-a="reload">יש גרסה חדשה · לחצו לעדכון</button></div>` : ''}
  <div class="event">${r.lastEvent ? esc(r.lastEvent.t) : ''}</div>
  ${!m && !closed ? `<div class="o-join">${joinCard()}</div>` : ''}
  ${isHost() && !closed ? `<div class="o-host">${hold ? holdemHost() : bjHost()}</div>` : ''}
  ${looksClosed() ? `<div class="o-host">${finalCard()}</div>` : ''}
  ${dock ? `<div class="dock"><div class="dock-in">${dock}</div></div>` : ''}
  </div><div class="stage${hold ? '' : ' fit'}">${body}</div></div>`;
}

function updateView(){
  return `<div class="stack" style="padding-top:40px"><div class="card" id="needupd"><h2 style="font-family:var(--f-display);font-size:34px">השולחן הזה צריך גרסה חדשה יותר</h2>
    <span class="muted">השולחן ${esc(S.code)} נפתח בגרסה חדשה של האפליקציה. כדי להצטרף אליו צריך לעדכן.</span>
    <button class="btn primary wide" data-a="upd">עדכון</button><button class="btn ghost wide" data-a="home">חזרה למסך הראשי</button></div></div>`;
}
function joinCard(){
  const list = players();
  if (isHost() && S.room.game === 'blackjack') return `<div class="card" style="margin-top:14px"><span class="muted">אתה הדילר. אם תרצה גם להמר:</span><button class="btn ghost" data-a="sit">הצטרפות כמהמר</button></div>`;
  return `<div class="card" style="margin-top:14px">
    <span class="label">הצטרפות לשולחן</span>
    <div class="me-row"><button class="avbtn" data-a="sheet" data-v="avatar" aria-label="בחירת תמונה"><span class="av" style="${avBg(myAv())}">${avInner(myAv())}</span><span>תמונה</span></button>
    <input id="jname" data-bind="name" value="${esc(S.name)}" maxlength="20" placeholder="השם שלך"></div>
    <button class="btn primary" data-a="sit">שבו לשולחן עם ${fmt(S.room.startStack)} צ'יפים</button>
    ${list.length ? `<span class="muted">כבר ישבתם מטלפון אחר? בחרו את עצמכם:</span><div class="btns">${list.map(p => `<button class="btn small ghost" data-a="claim" data-v="${esc(p.pid)}">${esc(p.name)}</button>`).join('')}</div>` : ''}
  </div>`;
}

function dealerRow(){
  const r = S.room; if (!r || S.players[r.hostId]) return '';
  const mine = r.hostId === S.myId;
  return `<div class="seat ${mine ? 'me' : ''}">${avatar({ pid: r.hostId, name: r.hostName || 'ד' })}<div class="who"><div class="nm"><b>${esc(r.hostName || 'הדילר')}</b>${mine ? '<span class="tag">את/ה</span>' : ''}<span class="tag host">דילר</span></div><div class="sub"><span>${r.game === 'blackjack' ? 'הבית' : 'מנהל את השולחן'}</span></div></div><div></div></div>`;
}
function seatRow(p, extraTags, right, sub){
  const host = S.room.hostId === p.pid;
  const swap = S.mode === 'local' && p.pid !== S.myId ? `<button class="btn small ghost" data-a="claim" data-v="${esc(p.pid)}">שחק בתור</button>` : '';
  return `<div class="seat ${p.pid === S.myId ? 'me' : ''} ${p._out ? 'out' : ''}">
    ${avatar(p, 'seat:' + p.pid)}
    <div class="who"><div class="nm"><b>${esc(p.name)}</b>${p.pid === S.myId ? '<span class="tag">את/ה</span>' : ''}${host ? '<span class="tag host">דילר</span>' : ''}${extraTags}</div>
      <div class="sub"><span class="num">${fmt(p.stack)} צ'יפים</span>${sub ? `<span>${sub}</span>` : ''}</div></div>
    <div style="display:grid;gap:6px;justify-items:end">${right}${swap}</div>
  </div>`;
}

function holdemView(){
  const h = H(), r = h.r;
  const si = STAGES.indexOf(r.stage), cards = si < 0 ? 0 : [0,3,4,5,5][si];
  const rows = h.list.map(p => {
    const inH = h.inHand(p);
    let tags = '';
    if (inH && r.buttonPid === p.pid) tags += '<span class="tag btn-d">D</span>';
    if (inH && r.stage === 'preflop' && r.sbPid === p.pid) tags += '<span class="tag">SB</span>';
    if (inH && r.stage === 'preflop' && r.bbPid === p.pid) tags += '<span class="tag">BB</span>';
    if (inH && p.folded) tags += '<span class="tag fold">קיפל</span>';
    if (inH && p.allIn && !p.folded) tags += '<span class="tag allin">ALL-IN</span>';
    if (p.sittingOut) tags += '<span class="tag">בהפסקה</span>';
    else if (!inH && r.stage !== 'idle') tags += '<span class="tag">ממתין ליד הבאה</span>';
    const sb = h.st(p);
    const right = sb ? `<div class="amt num"><span class="mini"></span>${fmt(sb)}</div>` : '';
    return seatRow({ ...p, stack: shownStack(p), _out: inH && p.folded }, tags, right, inH || p.lastAction?.k === 'won' ? esc(actText(p.lastAction)) : '');
  }).join('');
  return `
  <div class="hdealer">${dealerSVG()}</div>
  <section class="table${looksClosed() ? ' closed' : ''}">
    ${looksClosed() ? closedSign() : ''}
    <div class="stage-row"><span class="pill ${r.stage === 'idle' ? 'ok' : ''}">${STAGE_HE[r.stage] || ''}${r.handId ? ` · יד ${r.handId}` : ''}</span><span class="meta num">בליינדים ${fmt(r.sb)}/${fmt(r.bb)}</span></div>
    <div class="board" aria-label="קלפים על השולחן">${[0,1,2,3,4].map(i => `<span class="slot ${i < cards ? 'on' : ''}"></span>`).join('')}</div>
    <div class="pot"><span class="lbl">קופה</span><span class="big num" data-k="pot">${fmt(h.pot)}</span></div>
    <div class="tocall">${r.stage === 'idle' ? (r.handId ? 'היד הסתיימה. הדילר יתחיל יד חדשה.' : 'מחכים שהדילר יתחיל את היד הראשונה') : h.maxSt ? `ההימור ברחוב: ${fmt(h.maxSt)}` : 'אין הימור ברחוב הזה'}</div>
  </section>
  <div class="seats">${dealerRow()}${rows || '<div class="muted" style="text-align:center;padding:16px">עוד אין שחקנים. שתפו את הקוד.</div>'}</div>`;
}

function holdemDock(){
  const h = H(), m = me();
  const stackHead = `<div class="dock-head"><div class="mystack"><span class="big num" data-k="mystack">${fmt(shownStack(m))}</span><span class="muted">הצ'יפים שלך</span></div>${pendingBox()}</div>`;
  if (m.sittingOut) return `${stackHead}<div class="status">אתם בהפסקה. אפשר לחזור מתפריט השחקנים.</div>`;
  if (!h.inHand(m)) return `${stackHead}<div class="status">${h.r.stage === 'idle' ? 'מחכים ליד הבאה' : 'תצטרפו ביד הבאה'}</div>`;
  if (m.folded) return `${stackHead}<div class="status">קיפלתם ביד הזו</div>`;
  if (m.allIn) return `${stackHead}<div class="status">אתם באול-אין. בהצלחה.</div>`;
  if (!canAct(h, m)) return `${stackHead}<div class="status">שואודאון. מחכים לדילר שיחלק את הקופה.</div>`;
  const mySt = h.st(m), toCall = Math.max(0, h.maxSt - mySt), stack = m.stack || 0;
  const add = Math.min(S.pending, stack), newSt = mySt + add;
  let label, dis = false;
  if (add === 0) label = toCall === 0 ? 'צ\'ק' : (toCall >= stack ? `אול-אין ${fmt(stack)}` : `השוואה ${fmt(toCall)}`);
  else if (add === stack) label = `אול-אין ${fmt(stack)}`;
  else if (newSt < h.maxSt){ label = `חסר ${fmt(h.maxSt - newSt)} להשוואה`; dis = true; }
  else if (newSt === h.maxSt) label = `השוואה ${fmt(add)}`;
  else if (newSt < h.minTo){ label = `העלאה מינימלית ל-${fmt(h.minTo)}`; dis = true; }
  else label = h.maxSt === 0 ? `הימור ${fmt(add)}` : `העלאה ל-${fmt(newSt)}`;
  const callAmt = add === 0 ? Math.min(toCall, stack) : add;
  const toAdd = to => Math.max(0, Math.min(stack, to - mySt));
  const potTo = h.maxSt + h.pot + toCall, halfTo = h.maxSt + Math.round((h.pot + toCall) / 2);
  const presets = [
    toCall ? ['השוואה', Math.min(toCall, stack)] : null,
    ['מינימום', toAdd(h.minTo)],
    ['½ קופה', toAdd(Math.max(h.minTo, halfTo))],
    ['קופה', toAdd(Math.max(h.minTo, potTo))],
    ['אול-אין', stack]
  ].filter(Boolean);
  return `${stackHead}
    <div class="tray">${denoms().map(d => `<button class="chip" style="${chipStyle(d)}" data-a="add" data-v="${d}" aria-label="הוספת ${d}"><span>${chipLabel(d)}</span></button>`).join('')}</div>
    <div class="presets">${presets.map(([t,v]) => `<button data-a="setp" data-v="${v}">${t} <span class="num">${fmt(v)}</span></button>`).join('')}</div>
    <div class="acts"><button class="btn danger" data-a="fold">קיפול</button><button class="btn primary" data-a="hgo" data-v="${callAmt}" ${dis ? 'disabled' : ''}>${label}</button></div>`;
}
function pendingBox(){
  return `<div class="pending"><button data-a="clearp" aria-label="ניקוי">×</button><span class="v num" data-k="pend">${fmt(S.pending)}</span><span class="muted">להוסיף</span></div>`;
}

function holdemHost(){
  const h = H(), r = h.r, i = STAGES.indexOf(r.stage);
  const nextLbl = { preflop:'פתיחת פלופ', flop:'פתיחת טרן', turn:'פתיחת ריבר', river:'לשואודאון' }[r.stage];
  const solo = h.live.length === 1 && h.pot > 0 ? h.live[0] : null;
  return `<section class="host"><h3>בקרת דילר</h3>
    ${solo ? `<button class="btn primary" data-a="solo" data-v="${esc(solo.pid)}">${esc(solo.name)} לוקח את הקופה (${fmt(h.pot)})</button>` : ''}
    <div class="btns">
      ${r.stage === 'idle' || h.pot === 0 ? `<button class="btn ${solo ? '' : 'primary'}" data-a="newhand">יד חדשה</button>` : ''}
      ${nextLbl && h.pot >= 0 && r.stage !== 'idle' ? `<button class="btn" data-a="next">${nextLbl}</button>` : ''}
      ${h.pot > 0 ? `<button class="btn ${r.stage === 'showdown' ? 'primary' : ''}" data-a="sheet" data-v="award">חלוקת הקופה</button>` : ''}
      ${r.stage !== 'idle' ? `<button class="btn ghost" data-a="sheet" data-v="cancel">ביטול היד</button>` : ''}
      <button class="btn ghost" data-a="sheet" data-v="end">סיום המשחק</button>
    </div>
  </section>`;
}

/* Table geometry, in % of the table box. Everything sits on ellipses that share one centre near the dealer. */
const GEO = { cy: 8, seat: [47, 75], spot: [34, 56], ins: [19.5, 32], bj: [25, 43], insText: [19.5, 33.6], in1: [17, 27.5], in2: [22, 37], max: 64 };
const ept = (phi, e) => [50 + e[0] * Math.sin(phi), GEO.cy + e[1] * Math.cos(phi)];
// Seats are spaced evenly along the arc of betting circles, so circles never overlap however many players sit down.
const ARC = (() => {
  const pts = []; let L = 0, prev = ept(-GEO.max * Math.PI / 180, GEO.spot);
  for (let d = -GEO.max; d <= GEO.max + .001; d += .5){ const q = ept(d * Math.PI / 180, GEO.spot); L += Math.hypot(q[0] - prev[0], (q[1] - prev[1]) * .98); pts.push([d, L]); prev = q; }
  return { pts, L };
})();
function seatLayout(n){
  if (n <= 1) return { angles: [0], size: 13.5 };
  const gap = Math.min(17, ARC.L / (n - 1)), mid = ARC.L / 2;
  const angles = Array.from({ length: n }, (_, k) => {
    const target = mid + gap * ((n - 1) / 2 - k);                  // k = 0 sits on the right, the first seat when reading Hebrew
    const hit = ARC.pts.find(q => q[1] >= target) || ARC.pts[ARC.pts.length - 1];
    return hit[0] * Math.PI / 180;
  });
  return { angles, size: Math.min(13.5, gap * .86) };
}
function arc(id, e, deg){
  const a = deg * Math.PI / 180, k = .98, [x1, y1] = ept(-a, e), [x2, y2] = ept(a, e);
  return `<path id="${id}" d="M${x1.toFixed(2)} ${(y1 * k).toFixed(2)} A${e[0]} ${(e[1] * k).toFixed(2)} 0 0 0 ${x2.toFixed(2)} ${(y2 * k).toFixed(2)}"/>`;
}
function bjVis(p){
  const r = S.room, o = ov(p.pid), hs = p.hands || [];
  const show = p.bjRound === r.roundId || (p.bjRound === r.roundId - 1 && hs.some(h => !h.result));   // a round being paid out stays on the felt
  return { hands: o && o.hands ? o.hands : (show ? hs : []), ins: o && o.ins != null ? o.ins : (show ? p.insurance || 0 : 0) };
}
function bjSeat(p, phi, base){
  const r = S.room, o = ov(p.pid), mine = p.pid === S.myId, vis = bjVis(p), c = cur(p), pid = esc(p.pid);
  const [sx, sy] = ept(phi, GEO.seat), [bx, by] = ept(phi, GEO.spot), [ix, iy] = ept(phi * .78, GEO.ins);
  const hs = vis.hands.length ? vis.hands : [null], m = hs.length, size = m === 1 ? base : Math.min(base * (m === 2 ? .8 : .66), 15 / m + 3);
  const gc = mine && r.phase === 'betting' ? ghostChips() : null, ghost = gc ? gc.length : -1;
  const spots = hs.map((h, j) => {
    const x = Math.max(size / 2 + .5, Math.min(99.5 - size / 2, bx + (j - (m - 1) / 2) * size * 1.04));
    const paid = h && h.paid, show = h && !h._hide && !paid;
    let inner = show ? (h.doubled ? `<div class="duo">${handHalves(h).map(x => stackHTML(x)).join('')}</div>` : stackHTML(handStack(h))) : '';
    if (j === 0 && gc) inner += `<div class="ghost" data-k="ghost">${ghost ? stackHTML(gc) : ''}</div>`;
    const lbl = paid && !h._hide ? `<span class="bl bjl">בלאק ג'ק ✓</span>` : show ? `<span class="bl num">${fmt(h.bet)}${h.doubled ? (m > 1 ? '×2' : ' · ×2') : ''}${h.result === 'surrender' ? ' · ½' : ''}</span>` : '';
    const glow = mine && j === 0 && r.phase === 'betting' && !show && !ghost;
    return `<div class="spot${m > 1 ? ' sm' : ''}${mine ? ' mine' : ''}${show ? ' has' : ''}${glow ? ' glow' : ''}" data-k="spot:${pid}:${j}" style="left:${x.toFixed(2)}%;top:${by.toFixed(2)}%;width:${size.toFixed(2)}%;--chip:calc(var(--u)*${(size * .53).toFixed(2)})">${inner}${lbl}</div>`;
  }).join('');
  const ins = `<div class="insk" data-k="ins:${pid}" style="left:${ix.toFixed(2)}%;top:${iy.toFixed(2)}%">${vis.ins ? stackHTML(vis.ins) + `<span class="bl num">ביטוח ${fmt(vis.ins)}</span>` : ''}</div>`;
  const res = !(o && o.hideRes) && !c && p.bjRound === r.roundId - 1 && p.lastAction && (p.lastAction.k === 'bjres' || p.lastAction.k === 'bjpay') ? (p.lastAction.amt || 0) : null;
  const claim = S.mode === 'local' && !mine ? ` data-a="claim" data-v="${pid}" role="button" title="שחק בתור ${esc(p.name)}"` : mine ? ` data-a="sheet" data-v="avatar" role="button" title="החלפת התמונה שלך"` : '';
  return spots + ins + `<div class="st${mine ? ' me' : ''}${r.phase === 'playing' && !c ? ' out' : ''}"${claim} style="left:${sx.toFixed(2)}%;top:${sy.toFixed(2)}%">
    ${res != null ? `<span class="rb ${res > 0 ? 'w' : res < 0 ? 'l' : 'p'} num">${res > 0 ? '+' + fmt(res) : res < 0 ? '−' + fmt(-res) : 'תיקו'}</span>` : ''}
    ${avatar(p, 'seat:' + p.pid)}
    <b class="sn">${esc(p.name)}</b><span class="ss num">${fmt(shownStack(p))}</span></div>`;
}
function bjView(){
  const r = S.room, list = players(), n = list.length;
  const bettors = list.filter(cur), inTable = bettors.reduce((a, p) => a + bjStake(p) + (p.insurance || 0), 0), house = r.house || 0;
  const lay = seatLayout(n);
  const seats = list.map((p, k) => bjSeat(p, lay.angles[k], lay.size)).join('');
  const print = `<svg class="print" viewBox="0 0 100 98" preserveAspectRatio="none" aria-hidden="true" direction="ltr"><defs>${arc('pa-bj', GEO.bj, 48)}${arc('pa-it', GEO.insText, 40)}${arc('pa-i1', GEO.in1, 42)}${arc('pa-i2', GEO.in2, 42)}</defs><use href="#pa-i1" class="ln"/><use href="#pa-i2" class="ln"/><text class="t1"><textPath href="#pa-bj" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text><text class="t2"><textPath href="#pa-it" startOffset="50%" text-anchor="middle">INSURANCE PAYS 2 TO 1</textPath></text></svg>`;
  return `
  <section class="bjt${n > 7 ? ' dense' : ''}${looksClosed() ? ' closed' : ''}" aria-label="שולחן בלאק ג'ק">
    ${looksClosed() ? closedSign() : ''}
    <div class="dfig">${dealerSVG()}</div>
    <div class="felt"></div>
    ${print}
    <div class="dlr"><div class="rack" data-k="dealer">${denoms().slice().reverse().map(d => `<i class="tube" style="${chipStyle(d)}"></i>`).join('')}</div><div class="dn">${esc(r.hostName || 'הדילר')} · דילר</div></div>
    <div class="plac num"><span>מינ׳ ${fmt(r.minBet)}</span><span>מקס׳ ${r.maxBet ? fmt(r.maxBet) : '∞'}</span></div>
    <div class="rnd num"><span>סיבוב ${r.roundId}</span><span>הבית <span dir="ltr">${house >= 0 ? '+' : '−'}${fmt(Math.abs(house))}</span></span></div>
    <div class="cst"><span class="pill ${r.phase === 'betting' ? 'ok' : ''}">${r.phase === 'betting' ? 'הימורים פתוחים' : 'הקלפים חולקו'}</span><span class="meta num">${r.phase === 'betting' ? `${bettors.length} מתוך ${n} הימרו` : `על השולחן ${fmt(inTable)}`}</span></div>
    ${seats || `<div class="empty">עוד אין מהמרים.<br>שתפו את הקוד.</div>`}
  </section>`;
}

function bjDock(){
  const r = S.room, m = me(), c = cur(m);
  const head = `<div class="dock-head"><div class="mystack"><span class="big num" data-k="mystack">${fmt(shownStack(m))}</span><span class="muted">הצ'יפים שלך</span></div>${r.phase === 'betting' ? pendingBox() : ''}</div>`;
  if (r.phase === 'betting'){
    const curBet = c ? m.hands[0].bet : 0;
    return `${head}
      <div class="tray">${denoms().map(d => `<button class="chip" style="${chipStyle(d)}" data-a="add" data-v="${d}" aria-label="הוספת ${d}"><span>${chipLabel(d)}</span></button>`).join('')}</div>
      <div class="acts">${c ? `<button class="btn ghost" data-a="bjclear">ביטול ${fmt(curBet)}</button>` : `<button class="btn ghost" data-a="setp" data-v="${r.minBet}">מינימום ${fmt(r.minBet)}</button>`}
      <button class="btn primary" data-a="bjbet" ${S.pending ? '' : 'disabled'}>${c ? `הוספה להימור (${fmt(curBet + S.pending)})` : `הימור ${fmt(S.pending)}`}</button></div>`;
  }
  if (!c) return `${head}<div class="status">לא הימרת בסיבוב הזה. אפשר להמר בסיבוב הבא.</div>`;
  const handsHtml = m.hands.map((x, i) => {
    if (x.result) return `<div class="status">יד ${i+1}: ${fmt(x.bet)} · ${RES_HE[x.result]}</div>`;
    return `<div class="handrow hr1"><div class="hl"><b>${m.hands.length > 1 ? `יד ${i+1}` : 'ההימור שלך'}</b><span class="amt num"><span class="mini"></span>${fmt(x.bet)}${x.doubled ? ' · דאבל' : ''}</span></div>
      <button class="btn small" data-a="bj" data-v="double:${i}" ${x.doubled || m.stack < x.bet ? 'disabled' : ''}>דאבל דאון</button><button class="btn small" data-a="bj" data-v="split:${i}" ${x.doubled || m.hands.length >= 4 || m.stack < x.bet ? 'disabled' : ''}>ספליט</button></div>`;
  }).join('');
  const one = m.hands.length === 1 && !m.hands[0].doubled && !m.hands[0].result;
  return `${head}${handsHtml}
    <div class="acts3"><button class="btn small ghost" data-a="bj" data-v="ins:0" ${m.insurance || m.hands.length > 1 || m.hands[0].result || m.stack < Math.floor(m.hands[0].bet/2) ? 'disabled' : ''}>${m.insurance ? `ביטוח ${fmt(m.insurance)}` : `ביטוח (${fmt(Math.floor(m.hands[0].bet/2))})`}</button><button class="btn small ghost" data-a="bj" data-v="surrender:0" ${one ? '' : 'disabled'}>כניעה (מקבלים חצי)</button></div>`;
}

function bjHost(){
  const r = S.room, n = players().filter(cur).length;
  return `<section class="host"><h3>בקרת דילר</h3><div class="btns">
    ${r.phase === 'betting' ? `<button class="btn primary" data-a="deal" ${n ? '' : 'disabled'}>חלוקת קלפים (נועל הימורים)</button>` : `<button class="btn primary" data-a="sheet" data-v="settle">סימון זוכים ותשלום</button>${players().some(bjEligible) ? `<button class="btn" data-a="sheet" data-v="bjnow">בלאק ג'ק לשחקן</button>` : ''}<button class="btn ghost" data-a="sheet" data-v="cancel">ביטול הסיבוב</button>`}
    <button class="btn ghost" data-a="sheet" data-v="end">סיום המשחק</button>
  </div>${r.phase === 'betting' && !n ? '<span class="muted">מחכים שמישהו יהמר.</span>' : ''}</section>`;
}

/* ---------- sheets ---------- */
function sheetView(){
  const head = t => `<div class="sheet-head"><h2>${t}</h2><button class="btn small ghost" data-a="close">סגירה</button></div>`;
  const r = S.room || {};
  if (S.sheet === 'award'){
    const h = H(); const cands = h.list.filter(p => h.inHand(p) && h.com(p) > h.lvl);
    const prev = computeAward(S.sel);
    return `${head('חלוקת הקופה')}
      <span class="muted">בחרו את הזוכה. בתיקו בחרו כמה זוכים והקופה תתחלק ביניהם. קופות צדדיות מחושבות לבד לפי מה שכל אחד הכניס.</span>
      <div class="stack" style="gap:8px">${cands.map(p => `<button class="opt" data-a="pick" data-v="${esc(p.pid)}" aria-pressed="${S.sel.includes(p.pid)}"><span class="box"></span><span><b>${esc(p.name)}</b> <span class="muted">${p.folded ? '· קיפל' : p.allIn ? '· אול-אין' : ''}</span></span><span class="num muted">הכניס ${fmt(h.com(p))}</span></button>`).join('')}</div>
      ${S.sel.length ? `<div class="card" style="padding:12px;gap:4px">${Object.entries(prev.pay).filter(([,a]) => a > 0).map(([id,a]) => `<div class="payline"><span>${esc(nameOf(id))}</span><b class="num">+${fmt(a)}</b></div>`).join('')}${prev.left ? `<div class="payline muted"><span>נשאר בקופה צדדית</span><span class="num">${fmt(prev.left)}</span></div>` : ''}</div>` : ''}
      <button class="btn primary wide" data-a="award" ${S.sel.length ? '' : 'disabled'}>תשלום לזוכים</button>`;
  }
  if (S.sheet === 'settle'){
    const list = players().filter(cur); const anyIns = list.some(p => p.insurance);
    let missing = 0;
    const rows = list.map(p => p.hands.map((x,i) => {
      if (x.result) return `<div class="handrow"><div class="row" style="justify-content:space-between"><b>${esc(p.name)}${p.hands.length > 1 ? ` · יד ${i+1}` : ''}</b><span class="num muted">${fmt(x.bet)} · ${RES_HE[x.result]}</span></div></div>`;
      const k = p.pid + ':' + i, v = S.settle[k]; if (!v) missing++;
      return `<div class="handrow"><div class="row" style="justify-content:space-between"><b>${esc(p.name)}${p.hands.length > 1 ? ` · יד ${i+1}` : ''}</b><span class="amt num"><span class="mini"></span>${fmt(x.bet)}${x.doubled ? ' · דאבל' : ''}</span></div>
        <div class="res4">${[['win','ניצח','w'],['bj','בלאק ג\'ק','b'],['push','תיקו','p'],['lose','הפסיד','l']].map(([rv,t,cl]) => `<button class="${cl}" data-a="res" data-v="${esc(k)}|${rv}" aria-pressed="${v === rv}">${t}</button>`).join('')}</div></div>`;
    }).join('')).join('');
    return `${head('סיום סיבוב')}
      <button class="btn ghost" data-a="allwin">הדילר נשרף: כל מי שלא סומן ניצח</button>
      ${anyIns ? `<button class="opt" data-a="dbj" aria-pressed="${S.dealerBJ}"><span class="box"></span><span>לדילר יש בלאק ג'ק (ביטוח משלם 2:1)</span><span></span></button>` : ''}
      <div class="stack" style="gap:8px">${rows}</div>
      <button class="btn primary wide" data-a="payout" ${missing ? 'disabled' : ''}>${missing ? `נשארו ${missing} ידיים לסמן` : 'תשלום וסיבוב חדש'}</button>`;
  }
  if (S.sheet === 'avatar'){
    return `${head('התמונה שלך')}
      <div class="avp"><div class="av big" style="${avBg(myAv())}">${avInner(myAv())}</div><span class="muted">כולם בשולחן רואים אותה ליד השם שלך.</span></div>
      <div class="grid2"><button class="btn" data-a="avcam">צילום עכשיו</button><button class="btn" data-a="avfile">תמונה מהגלריה</button></div>
      <span class="label">או בחרו דמות</span>
      <div class="avgrid">${Object.keys(AV_SET).map(id => `<button class="avopt" data-a="avset" data-v="${id}" aria-pressed="${!!(S.avatar && S.avatar.k === 'set' && S.avatar.v === id)}" aria-label="דמות ${id}">${avSVG(id)}</button>`).join('')}</div>
      ${S.avatar ? '<button class="btn ghost" data-a="avclear">בלי תמונה (האות הראשונה של השם)</button>' : ''}`;
  }
  if (S.sheet === 'bjnow'){
    const list = players().filter(bjEligible);
    return `${head('בלאק ג\'ק')}
      <span class="muted">למי יש בלאק ג'ק (אס ותמונה בשני הקלפים הראשונים)? הוא מקבל עכשיו 3:2 על ההימור, בלי לחכות לסוף הסיבוב.</span>
      <div class="stack" style="gap:8px">${list.map(p => { const bet = p.hands[0].bet, win = Math.floor(bet * 1.5), sure = S.confirm === 'bj:' + p.pid;
        return `<div class="handrow hr1"><div class="hl"><b>${esc(p.name)}</b><span class="amt num"><span class="mini"></span>${fmt(bet)}</span></div>
          <button class="btn small ${sure ? 'primary' : ''}" data-a="bjnow" data-v="${esc(p.pid)}" style="grid-column:span 2">${sure ? `בטוח? לשלם +${fmt(win)}` : `בלאק ג'ק · +${fmt(win)}`}</button></div>`; }).join('') || '<span class="muted">אין ידיים שאפשר לסמן כרגע.</span>'}</div>`;
  }
  if (S.sheet === 'end'){
    const hold = r.game === 'holdem', busy = hold ? H().pot > 0 : players().some(cur), list = standings();
    return `${head('סיום המשחק')}
      <span class="muted">מכריזים על המנצח, כולם רואים את הטקס, והשולחן נסגר. אפשר לפתוח אותו מחדש אחר כך.</span>
      ${busy ? `<div class="banner">יש עדיין צ'יפים על השולחן. ${hold ? 'חלקו את הקופה או בטלו את היד' : 'שלמו או בטלו את הסיבוב'} לפני ההכרזה.</div>` : ''}
      ${rankHTML(list)}
      <button class="btn primary wide" data-a="endgame" ${busy || !list.length ? 'disabled' : ''}>הכרזה על המנצח וסגירת השולחן</button>`;
  }
  if (S.sheet === 'cancel'){
    const hold = r.game === 'holdem';
    return `${head(hold ? 'ביטול היד' : 'ביטול הסיבוב')}
      <span class="muted">כל הצ'יפים שהוכנסו ${hold ? 'ביד הזו וטרם חולקו' : 'בסיבוב הזה'} יחזרו לשחקנים.</span>
      <button class="btn danger wide" data-a="${hold ? 'cancelhand' : 'cancelround'}">כן, לבטל ולהחזיר</button>`;
  }
  if (S.sheet === 'players'){
    const host = isHost(); const list = players();
    return `${head('שחקנים')}
      ${me() ? '<button class="btn ghost" data-a="sheet" data-v="avatar">החלפת התמונה שלי</button>' : ''}
      ${host ? '<span class="muted">כאן מוסיפים צ\'יפים (ריביי), מורידים, ומעבירים את תפקיד הדילר. אפשר גם להוסיף שחקן בלי טלפון, ואז מנהלים אותו מכאן.</span><div class="row"><input id="newp" data-bind="newName" value="' + esc(S.newName) + '" maxlength="20" placeholder="שם שחקן חדש"><button class="btn small" data-a="addp">הוספה</button></div>' : ''}
      <div class="stack" style="gap:8px">${list.map(p => `<div class="mgr">
        <div class="row" style="justify-content:space-between"><b>${esc(p.name)}${r.hostId === p.pid ? ' · דילר' : ''}</b><span class="num">${fmt(p.stack)}</span></div>
        ${host ? `<div class="row"><input id="adj-${esc(p.pid)}" data-bind="adj.${esc(p.pid)}" inputmode="numeric" value="${esc(S.adj[p.pid] ?? r.startStack)}"><button class="btn small" data-a="adj" data-v="${esc(p.pid)}|1">הוספה</button><button class="btn small ghost" data-a="adj" data-v="${esc(p.pid)}|-1">הורדה</button></div>
        <div class="row" style="flex-wrap:wrap">${r.game === 'holdem' ? `<button class="btn small ghost" data-a="sitout" data-v="${esc(p.pid)}">${p.sittingOut ? 'חזרה למשחק' : 'הפסקה'}</button>` : ''}${r.hostId !== p.pid ? `<button class="btn small ghost" data-a="mkhost" data-v="${esc(p.pid)}">העברת דילר</button>` : ''}<button class="btn small danger" data-a="remove" data-v="${esc(p.pid)}">${S.confirm === p.pid ? 'בטוח? להסיר' : 'הסרה'}</button></div>` :
        (p.pid === S.myId && r.game === 'holdem' ? `<button class="btn small ghost" data-a="sitout" data-v="${esc(p.pid)}">${p.sittingOut ? 'חזרה למשחק' : 'הפסקה'}</button>` : '')}
      </div>`).join('') || '<span class="muted">אין שחקנים עדיין.</span>'}</div>`;
  }
  if (S.sheet === 'settings'){
    const host = isHost(), hold = r.game === 'holdem'; const e = S.edit;
    const busy = hold ? H().pot > 0 : players().some(cur);
    return `${head('הגדרות')}
      <div class="card" style="padding:12px"><span class="muted">שתפו את הקישור לעמוד הזה ואת הקוד</span><div class="row" style="justify-content:space-between"><span class="code">${esc(r.code)}</span><button class="btn small" data-a="copy">שיתוף הזמנה</button></div>
      <span class="muted">להתקנה: באנדרואיד, תפריט הדפדפן ← "התקנת אפליקציה". באייפון, ספארי ← שיתוף ← "הוספה למסך הבית".</span></div>
      <button class="opt" data-a="ambi" aria-pressed="${AMBI_ON}"><span class="box"></span><span><b>אווירת קזינו ברקע</b><br><span class="muted">מכונות מזל ואנשים מדברים בשקט, מדי פעם${SND.on ? '' : ' · הצלילים כבויים כרגע'}</span></span><span></span></button>
      <button class="opt" data-a="voice" aria-pressed="${VOICE_ON}"><span class="box"></span><span><b>קריינות הדילרית</b><br><span class="muted">הדילרית אומרת בקול מה קורה: הימורים, קלפים, תשלום${SND.on ? '' : ' · הצלילים כבויים כרגע'}</span></span><span></span></button>
      ${host ? `
        <span class="label">סוג משחק</span>
        <div class="seg"><button data-a="setgame" data-v="holdem" aria-pressed="${hold}" ${busy ? 'disabled' : ''}>טקסס הולדם</button><button data-a="setgame" data-v="blackjack" aria-pressed="${!hold}" ${busy ? 'disabled' : ''}>בלאק ג'ק</button></div>
        ${busy ? '<span class="muted">אפשר להחליף משחק כשאין צ\'יפים על השולחן.</span>' : ''}
        ${hold ? `<div class="grid2"><label class="field"><span class="label">ביג בליינד</span><input id="ebb" data-bind="edit.bb" inputmode="numeric" value="${esc(e.bb)}" style="direction:ltr"></label><label class="field"><span class="label">סמול בליינד</span><input id="esb" data-bind="edit.sb" inputmode="numeric" value="${esc(e.sb)}" style="direction:ltr"></label></div>`
               : `<div class="grid2"><label class="field"><span class="label">הימור מינימלי</span><input id="emin" data-bind="edit.minBet" inputmode="numeric" value="${esc(e.minBet)}" style="direction:ltr"></label><label class="field"><span class="label">מקסימלי (0 = ללא)</span><input id="emax" data-bind="edit.maxBet" inputmode="numeric" value="${esc(e.maxBet)}" style="direction:ltr"></label></div>`}
        <label class="field"><span class="label">צ'יפים למצטרפים חדשים</span><input id="estack" data-bind="edit.startStack" inputmode="numeric" value="${esc(e.startStack)}" style="direction:ltr"></label>
        <button class="btn primary" data-a="saveset">שמירה</button>` :
        `<span class="muted">${esc(nameOf(r.hostId))} הוא הדילר. אם הוא עזב, אפשר לקחת את התפקיד.</span><button class="btn ghost" data-a="mkhost" data-v="${esc(S.myId)}">אני הדילר עכשיו</button>`}
      <button class="btn ghost" data-a="home">יציאה למסך הראשי</button>
      <span class="muted num" style="text-align:center">גרסה ${esc(BUILD ? BUILD.slice(0, 7) : 'מקומית')}</span>`;
  }
  return '';
}

/* ---------- events ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (!S.code) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('האפליקציה הותקנה'); if (!S.code) render(); });
const A = {
  install: async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch(e){} installEvt = null; render(); },
  local: () => useLocal(),
  addp: async () => { const n = S.newName.trim(); if (!n){ toast('כתבו שם'); return; } const pid = 'p_' + rid(10); const d = newPlayer(S.room.startStack || 0); d.name = n.slice(0,20); d.avatar = null; if (await w(pPath(pid), 'set', d)) { S.newName = ''; toast(n + ' נוסף לשולחן'); render(); } },
  retry: () => { try { location.reload(); } catch(e){} },
  cgame: v => { S.create.game = v; S.create.play = v === 'holdem'; render(); },
  create: () => createRoom(),
  join: async () => { const c = S.joinCode.trim().toUpperCase(); if (c.length !== 4){ toast('קוד החדר הוא 4 אותיות'); return; } if (S.name.trim()) ls.set('chips.name', S.name.trim()); await dbReady; enterRoom(c); },
  open: async v => { await dbReady; enterRoom(v); },
  home: () => goHome(),
  sit: () => joinTable(),
  claim: v => claimSeat(v),
  copy: () => { const t = S.room.code; const link = location.origin + location.pathname + '#' + t; try { navigator.share ? navigator.share({ title: 'שולחן צ\'יפים', text: 'בואו לשולחן ' + t, url: link }).catch(() => {}) : navigator.clipboard.writeText(link).then(() => toast('קישור ההזמנה הועתק'), () => toast('קוד החדר: ' + t)); } catch(e){ toast('קוד החדר: ' + t); } },
  sheet: v => { S.sheet = v; S.confirm = null; if (v === 'award'){ const h = H(); S.sel = h.live.length === 1 ? [h.live[0].pid] : []; } if (v === 'settle'){ S.settle = {}; S.dealerBJ = false; } if (v === 'settings'){ const r = S.room; S.edit = { sb: String(r.sb), bb: String(r.bb), minBet: String(r.minBet), maxBet: String(r.maxBet || 0), startStack: String(r.startStack) }; } render(); },
  close: () => { S.sheet = null; render(); },
  add: (v, t) => {
    const m = me(), before = S.pending, held = pendChips().slice(); S.pending = Math.min((m?.stack || 0), S.pending + Number(v)); const added = S.pending - before;
    const got = added === Number(v) ? [added] : chipsOf(added); S.pendChips = held.concat(added ? got : []);
    buzz(); SND.tap();
    const from = t && pageRect(t);
    if (!added || !from || RM){ render(); return; }
    FX.pendFly += got.length; render();                       // the chip flies from the tray onto your betting spot
    const spot = S.room.game === 'blackjack' && rectOf('spot:' + S.myId + ':0');
    fly({ from, to: onScreen(spot) ? spot : rectOf('pend'), amt: got, dur: 380, lift: 34, land: () => { FX.pendFly = Math.max(0, FX.pendFly - got.length); paintGhost(); SND.chips(1, .8); } });
  },
  setp: v => { S.pending = Math.max(0, Math.min(me()?.stack || 0, Number(v))); FX.pendFly = 0; SND.chips(3); render(); },
  clearp: () => { if (S.pending) SND.slide(); S.pending = 0; FX.pendFly = 0; render(); },
  ambi: () => { AMBI_ON = !AMBI_ON; ls.set('chips.ambi', AMBI_ON ? '1' : '0'); ambiSync(); render(); },
  voice: () => { VOICE_ON = !VOICE_ON; ls.set('chips.voice', VOICE_ON ? '1' : '0'); if (!VOICE_ON) SND.voiceStop(); ambiSync(); render(); },
  reload: () => { reloading = true; location.reload(); },
  upd: async () => { await checkUpdate(); if (newBuild){ reloading = true; location.reload(); } else toast('זו כבר הגרסה האחרונה. אם השולחן עדיין לא נפתח, נסו שוב עוד רגע.'); },
  endgame: () => endGame(),
  avcam: () => document.getElementById('avcam').click(),
  avfile: () => document.getElementById('avfile').click(),
  avset: v => { setAvatar({ k: 'set', v }); },
  avclear: () => setAvatar(null),
  bjnow: v => { if (S.confirm !== 'bj:' + v){ S.confirm = 'bj:' + v; render(); return; } bjNow(v); },
  reopen: async () => { if (await w(roomPath(), 'update', { closed: false, ...setEvent('השולחן נפתח מחדש') })) toast('השולחן פתוח שוב'); },
  replay: () => ceremony(),
  finclose: () => { finHide(); FX.signDrop = now(); render(); if (S.room && S.room.closed) SND.say('closed'); },
  rotoff: () => { S.rotOff = true; render(); },
  rotlock: async () => {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); await screen.orientation.lock('landscape'); }
    catch(e){ toast('הטלפון לא מאפשר לסובב מכאן. סובבו אותו ביד.'); }
    render();
  },
  snd: () => { const on = SND.toggle(); toast(on ? 'הצלילים פועלים' : 'הצלילים כבויים'); render(); },
  hgo: v => hAct(Number(v)),
  fold: () => hFold(),
  newhand: () => newHand(),
  next: () => nextStreet(),
  solo: v => award([v]),
  pick: v => { S.sel = S.sel.includes(v) ? S.sel.filter(x => x !== v) : [...S.sel, v]; render(); },
  award: () => award(S.sel),
  cancelhand: () => cancelHand(),
  bjbet: () => bjBet(),
  bjclear: () => bjClear(),
  bj: v => { const [k, i] = v.split(':'); bjDo(k, Number(i)); },
  deal: async () => { buzz(); await w(roomPath(), 'update', { phase:'playing', dealerBJ:false, ...setEvent(`סיבוב ${S.room.roundId}: הקלפים חולקו`) }); },
  res: v => { const [k, rv] = v.split('|'); S.settle[k] = rv; render(); },
  allwin: () => { players().filter(cur).forEach(p => p.hands.forEach((x,i) => { const k = p.pid + ':' + i; if (!x.result && !S.settle[k]) S.settle[k] = 'win'; })); render(); },
  dbj: () => { S.dealerBJ = !S.dealerBJ; render(); },
  payout: () => bjPayout(),
  cancelround: () => bjCancelRound(),
  adj: async v => { const [id, sign] = v.split('|'); const amt = Math.floor(Number(S.adj[id] ?? S.room.startStack) || 0); const p = S.players[id]; if (!p || !amt) return; const ns = Math.max(0, (p.stack || 0) + amt * Number(sign)); if (await w(pPath(id), 'update', { stack: ns, lastAction: { k:'refund', amt: ns - (p.stack||0) }, ts: now() })) { await w(roomPath(), 'update', setEvent(`${p.name}: ${Number(sign) > 0 ? '+' : '−'}${fmt(amt)} צ'יפים`)); toast('עודכן'); } },
  sitout: v => { const p = S.players[v]; if (p) w(pPath(v), 'update', { sittingOut: !p.sittingOut }); },
  mkhost: async v => { if (await w(roomPath(), 'update', { hostId: v, hostName: v === S.myId ? (S.name.trim() || nameOf(v)) : nameOf(v), ...setEvent(`${nameOf(v)} הוא הדילר עכשיו`) })) { S.sheet = null; render(); } },
  remove: async v => { if (S.confirm !== v){ S.confirm = v; render(); return; } S.confirm = null; await w(pPath(v), 'delete'); if (v === S.myId) render(); },
  setgame: async v => { await w(roomPath(), 'update', { game: v, stage:'idle', phase:'betting', roundId: (S.room.roundId || 1) + 1, ...setEvent(v === 'holdem' ? 'עוברים לטקסס הולדם' : 'עוברים לבלאק ג\'ק') }); S.pending = 0; },
  saveset: async () => { const e = S.edit, n = v => Math.max(0, Math.floor(Number(v) || 0)); if (await w(roomPath(), 'update', { sb: Math.max(1, n(e.sb)), bb: Math.max(1, n(e.bb)), minBet: Math.max(1, n(e.minBet)), maxBet: n(e.maxBet), startStack: n(e.startStack), updatedAt: now() })) { toast('נשמר'); S.sheet = null; render(); } }
};
document.addEventListener('click', e => {
  if (e.target === sheetEl){ S.sheet = null; render(); return; }
  const t = e.target.closest('[data-a]'); if (!t || t.disabled) return;
  if (t.classList.contains('btn') || t.closest('.seg,.res4,.presets')) SND.tick();
  if (S.code && tableUnsupported(S.room) && !['home', 'upd', 'reload', 'snd', 'retry'].includes(t.dataset.a)) return;   // update screen: nothing else acts
  const f = A[t.dataset.a]; if (f) f(t.dataset.v, t);
});
function bind(e){
  const b = e.target.dataset && e.target.dataset.bind; if (!b) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  const [a, k] = b.split('.');
  if (k === undefined){ S[a] = a === 'joinCode' ? String(v).toUpperCase() : v; if (a === 'name'){ ls.set('chips.name', String(v).trim()); if (!S.avatar) document.querySelectorAll('.avbtn .av').forEach(el => el.textContent = String(v).trim().charAt(0) || '?'); } }
  else if (S[a]) S[a][k] = v;
  if (a === 'joinCode' && e.target.value !== S.joinCode) e.target.value = S.joinCode;
}
document.addEventListener('input', bind);
document.addEventListener('change', bind);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'jcode') A.join(); if (e.key === 'Escape' && S.sheet){ S.sheet = null; render(); } else if (e.key === 'Escape' && !rotEl.hidden){ S.rotOff = true; render(); } });

render();
})();
