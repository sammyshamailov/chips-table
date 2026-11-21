// Renders the casino background offline and measures each layer, so the mix is checked by numbers,
// not by guessing. Writes tests/out/ambience.wav (30 s) to listen to. Run: node tests/audio.js
const fs = require('fs');
const path = require('path');
const { OUT, requirePlaywright, serve } = require('./lib');

(async () => {
  const { chromium } = requirePlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), browser = await chromium.launch(), pg = await browser.newPage();
  await pg.route(/gstatic|googleapis/, r => r.abort());
  await pg.goto(srv.url); await pg.waitForTimeout(300);
  const LEVEL = .45;            // the level the app plays it at (see SND.ambiStart in index.html)
  const layers = { all: {}, crowd: { slots: 0 }, slots: { crowd: 0 } };
  console.log('layer     RMS dBFS   above 4 kHz');
  for (const [name, mix] of Object.entries(layers)){
    const r = await pg.evaluate(async ([mix, level]) => {
      const SEC = 20, sr = 44100, c = new OfflineAudioContext(2, SEC * sr, sr);
      window.ChipsAmbience(c, c.destination, level, mix).sched(SEC);
      const L = (await c.startRendering()).getChannelData(0);
      let s = 0, h = 0, prev = 0, hp = 0; const k = Math.exp(-2 * Math.PI * 4000 / sr);
      for (let i = sr * 3; i < L.length; i++){ const x = L[i]; s += x * x; hp = k * (hp + x - prev); prev = x; h += hp * hp; }
      const n = L.length - sr * 3, db = v => (10 * Math.log10(v / n)).toFixed(1);
      return [db(s), db(h)];
    }, [mix, LEVEL]);
    console.log(name.padEnd(9), r[0].padStart(8), r[1].padStart(12));
  }
  const b64 = await pg.evaluate(async level => {
    const SEC = 30, sr = 44100, c = new OfflineAudioContext(2, SEC * sr, sr);
    const out = c.createGain(); out.gain.value = .8; const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; out.connect(comp); comp.connect(c.destination);
    window.ChipsAmbience(c, out, level).sched(SEC);
    const buf = await c.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    const ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++){ v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    let bin = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }, LEVEL);
  fs.writeFileSync(path.join(OUT, 'ambience.wav'), Buffer.from(b64, 'base64'));
  console.log('wrote', path.join(OUT, 'ambience.wav'));
  await browser.close(); srv.close();
})();
