// Renders the casino background offline at the level the app plays it, measures it, and writes
// tests/out/ambience.wav (30 s, starting at a random point of the loop) to listen to. Run: node tests/audio.js
const fs = require('fs');
const path = require('path');
const { OUT, requirePlaywright, serve } = require('./lib');

(async () => {
  const { chromium } = requirePlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), browser = await chromium.launch(), pg = await browser.newPage();
  await pg.route(/gstatic|googleapis/, r => r.abort());
  await pg.goto(srv.url); await pg.waitForTimeout(300);
  const r = await pg.evaluate(async () => {
    const SEC = 30, sr = 44100, c = new OfflineAudioContext(2, SEC * sr, sr);
    const ab = await (await fetch(window.CHIPS_BG.url)).arrayBuffer();
    const buf = await c.decodeAudioData(ab);
    // the app's master chain: gain .8 into a compressor
    const out = c.createGain(); out.gain.value = .8; const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; out.connect(comp); comp.connect(c.destination);
    window.ChipsAmbience(c, out, window.CHIPS_BG.level, buf);
    const res = await c.startRendering(), L = res.getChannelData(0), R = res.getChannelData(1), n = L.length;
    // level after the 3 s fade-in, and the largest jump between 50 ms blocks (a loop gap would show as a deep dip)
    let s = 0; for (let i = sr * 3; i < n; i++) s += L[i] * L[i];
    const blk = sr / 20, lv = []; for (let i = sr * 3; i + blk <= n; i += blk){ let e = 0; for (let j = i; j < i + blk; j++) e += L[j] * L[j]; lv.push(10 * Math.log10(e / blk + 1e-12)); }
    lv.sort((a, b) => a - b);
    const ab2 = new ArrayBuffer(44 + n * 4), v = new DataView(ab2), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++){ v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    let bin = ''; const u8 = new Uint8Array(ab2); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { rms: 10 * Math.log10(s / (n - sr * 3)), quietest: lv[0], median: lv[lv.length >> 1], seconds: buf.duration, wav: btoa(bin) };
  });
  console.log(`recording ${r.seconds.toFixed(1)} s · in-app level ${r.rms.toFixed(1)} dBFS (target about -32) · quietest 50 ms ${r.quietest.toFixed(1)} vs median ${r.median.toFixed(1)} dB`);
  fs.writeFileSync(path.join(OUT, 'ambience.wav'), Buffer.from(r.wav, 'base64'));
  console.log('wrote', path.join(OUT, 'ambience.wav'));
  await browser.close(); srv.close();
})();
