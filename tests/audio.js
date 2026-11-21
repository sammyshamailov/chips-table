// Renders the casino background (a steady quiet crowd murmur bed plus a slot-machine one-shot now and then) and the dealer narration offline,
// through the app's own master chain, measures them and writes tests/out/ambience.wav and tests/out/narration.wav
// to listen to. Run: node tests/audio.js
// Files that don't exist yet are reported as "missing: ..." instead of failing.
// AUDIO_PLACEHOLDERS=1 serves generated tones for sounds/amb and sounds/voice (for developing without the real files).
const fs = require('fs');
const path = require('path');
const { OUT, requirePlaywright, serve } = require('./lib');

// A short WAV of an amplitude-modulated tone at the given peak (dBFS), used only with AUDIO_PLACEHOLDERS=1.
function toneWav(sec, peakDb, f, mod){
  const sr = 22050, n = Math.floor(sec * sr), b = Buffer.alloc(44 + n * 2), pk = Math.pow(10, peakDb / 20) * 32767;
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++){ const t = i / sr, e = Math.min(1, t * 20, (sec - t) * 20) * (.55 + .45 * Math.sin(2 * Math.PI * mod * t)); b.writeInt16LE(Math.round(pk * e * Math.sin(2 * Math.PI * f * t)), 44 + i * 2); }
  return b;
}

(async () => {
  const { chromium } = requirePlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), browser = await chromium.launch(), pg = await browser.newPage();
  await pg.route(/gstatic|googleapis/, r => r.abort());
  if (process.env.AUDIO_PLACEHOLDERS){
    await pg.route(/\/sounds\/(amb|voice)\//, r => {
      const u = r.request().url(), nm = u.split('/').pop().replace('.mp3', ''), kind = nm.replace(/-\d+$/, '');
      const sec = { machine: 2.5, bed: 8 }[kind] || 1.4 + (nm.length % 3) * .3, pk = u.includes('/voice/') ? -2 : -3;
      r.fulfill({ contentType: 'audio/wav', body: toneWav(sec, pk, u.includes('/voice/') ? 220 : kind === 'machine' ? 1800 : 300, kind === 'machine' ? 7 : 4) });
    });
  }
  pg.on('pageerror', e => console.log('page error:', e.message));
  await pg.goto(srv.url); await pg.waitForTimeout(300);
  const r = await pg.evaluate(async () => {
    const sr = 44100, B = window.CHIPS_BG, missing = [];
    const dec = async (c, url) => { try { const r = await fetch(url); if (!r.ok) throw 0; return await c.decodeAudioData(await r.arrayBuffer()); } catch(e){ missing.push(url); return null; } };
    // the app's master chain: gain .8 into a compressor
    const chain = c => { const out = c.createGain(); out.gain.value = .8; const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; out.connect(comp); comp.connect(c.destination); return out; };
    const wav = res => { const L = res.getChannelData(0), R = res.getChannelData(1), n = L.length, ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++){ v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
      let bin = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(bin); };
    const db = x => 10 * Math.log10(x + 1e-12);
    const rmsDb = (d, a, b) => { let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]; return db(s / Math.max(1, b - a)); };
    const loudest = (d, win) => { let m = -200; for (let i = 0; i + win <= d.length; i += win >> 1) m = Math.max(m, rmsDb(d, i, i + win)); return m; };
    const peakDb = d => { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return 20 * Math.log10(m + 1e-9); };
    const out = { missing };
    // 1. the background: 60 s
    { const c0 = new OfflineAudioContext(2, 60 * sr, sr), clips = [];
      for (const m of B.manifest){ const buf = await dec(c0, m.url); if (buf) clips.push({ kind: m.kind, url: m.url, buf }); }
      out.clips = clips.length;
      if (clips.length){
        // the bed alone, 60 s: level = both channels' power summed (the way an event panned left or right keeps its loudness)
        const bedOnly = clips.filter(x => x.kind === 'bed');
        if (bedOnly.length){
          const cb = new OfflineAudioContext(2, 60 * sr, sr), ab = window.ChipsAmbience(cb, chain(cb), B.level, bedOnly.map(x => ({ ...x }))); ab.sched(60);
          const rb = await cb.startRendering(), bl = rb.getChannelData(0), br = rb.getChannelData(1), a0 = 5 * sr;
          out.bed = { sum: db(Math.pow(10, rmsDb(bl, a0, bl.length) / 10) + Math.pow(10, rmsDb(br, a0, br.length) / 10)), ch: rmsDb(bl, a0, bl.length) };
        }
        const c = new OfflineAudioContext(2, 60 * sr, sr), cl = clips.map(x => ({ ...x }));     // buffers decoded on c0 work on any context of the same rate
        const a = window.ChipsAmbience(c, chain(c), B.level, cl); a.sched(60);
        const res = await c.startRendering(), L = res.getChannelData(0);
        out.amb = { events: a.events, avg: rmsDb(L, 0, L.length), avgSum: db(Math.pow(10, rmsDb(L, 0, L.length) / 10) + Math.pow(10, rmsDb(res.getChannelData(1), 0, L.length) / 10)), loud: loudest(L, sr / 20), peak: peakDb(L), wav: wav(res) };
      } }
    // 2. narration: three lines over the running background, 10 s
    { const c0 = new OfflineAudioContext(2, sr, sr), lines = [], clips = [];
      for (const m of B.manifest){ const buf = await dec(c0, m.url); if (buf) clips.push({ kind: m.kind, url: m.url, buf }); }
      for (const k of B.voiceKeys){ const buf = await dec(c0, B.voiceUrl(k)); if (buf) lines.push({ k, buf }); }
      out.lines = lines.map(l => l.k);
      if (lines.length){
        const c = new OfflineAudioContext(2, 10 * sr, sr), o = chain(c), duckBus = c.createGain(); duckBus.connect(o);
        const a = window.ChipsAmbience(c, duckBus, B.level, clips); a.sched(10);
        const pick = lines.slice(0, 3), starts = [1, 4.2, 7.4], wins = [];
        pick.forEach((l, i) => {
          const t = starts[i], e = t + l.buf.duration;                       // the app ducks the background 6 dB while a line plays
          duckBus.gain.setValueAtTime(1, t); duckBus.gain.linearRampToValueAtTime(.5, t + .15); duckBus.gain.setValueAtTime(.5, e); duckBus.gain.linearRampToValueAtTime(1, e + .5);
          window.ChipsLine(c, o, l.buf, t, B.voiceLevel); wins.push([t, e]);
        });
        const res = await c.startRendering(), L = res.getChannelData(0);
        out.nar = { used: pick.map(l => l.k), speech: wins.map(([t, e]) => rmsDb(L, Math.floor(t * sr), Math.floor(e * sr))), peak: peakDb(L), wav: wav(res) };
      } }
    return out;
  });
  const miss = [...new Set(r.missing)];
  if (miss.length) console.log('missing: ' + miss.join(', '));
  if (r.amb){
    if (r.bed) console.log(`bed alone at the app's master (both channels summed, after the 3 s fade-in): ${r.bed.sum.toFixed(1)} dBFS (target about -41: 6 dB under the old talk event at -35.0) · per channel ${r.bed.ch.toFixed(1)} dBFS`);
    console.log(`background (${r.clips} clips) 60 s at the app's master: average ${r.amb.avg.toFixed(1)} dBFS left channel / ${r.amb.avgSum.toFixed(1)} both summed · slot-machine events ${r.amb.events} (one every 10-25 s) · loudest 50 ms ${r.amb.loud.toFixed(1)} dBFS (events should stay under about -20) · peak ${r.amb.peak.toFixed(1)} dBFS`);
    fs.writeFileSync(path.join(OUT, 'ambience.wav'), Buffer.from(r.amb.wav, 'base64')); console.log('wrote', path.join(OUT, 'ambience.wav'));
  } else console.log('background: no clips found, nothing rendered');
  if (r.nar){
    console.log(`narration (${r.nar.used.join(', ')}) over the background: speech RMS ${r.nar.speech.map(x => x.toFixed(1)).join(' / ')} dBFS (target about -20) · peak ${r.nar.peak.toFixed(1)} dBFS`);
    fs.writeFileSync(path.join(OUT, 'narration.wav'), Buffer.from(r.nar.wav, 'base64')); console.log('wrote', path.join(OUT, 'narration.wav'));
  } else console.log('narration: no voice files found, nothing rendered');
  await browser.close(); srv.close();
})();
