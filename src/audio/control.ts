/**
 * When sound plays: the AudioContext is unlocked on the first touch, and the casino background (and the loading of
 * the narration) runs only inside an open table, with the screen on, sound on, and its setting on.
 */
import type { Sound } from './synth';

/** True while this phone is inside an open (not closed) table. */
export type InTable = () => boolean;

/** Starts or stops the background to match the table, the screen and the settings. The app calls it on every render. */
export function createAmbiSync(snd: Sound, inTable: InTable): () => void {
  return () => {
    const on = snd.on && inTable() && document.visibilityState === 'visible';
    if (on && snd.ambiOn) snd.ambiStart();
    else snd.ambiStop();
    if (on && snd.voiceOn) snd.voiceLoad();
  };
}

/**
 * Listens for the first touch (browsers start audio only after one), for the screen going off and on, and now and
 * then (every 45-120 s) plays someone at the table playing with their chips, inside a table with the screen on.
 */
export function startAudioControl(snd: Sound, ambiSync: () => void, inTable: InTable): void {
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev =>
    document.addEventListener(ev, () => snd.init(), { passive: true, capture: true }),
  );
  document.addEventListener('visibilitychange', () => ambiSync());
  const loop = () =>
    setTimeout(
      () => {
        if (inTable() && document.visibilityState === 'visible') snd.ambient();
        loop();
      },
      45000 + Math.random() * 75000,
    );
  loop();
}
