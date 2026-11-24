/**
 * The end of the game, on every phone: a spotlight on the winner's seat with a drumroll, then the reveal (fanfare,
 * applause, the dealer's "winner", the card counting up the chips, raining chips), then the standings. A timeline of
 * timers over everything, in `#fin`; the picture is the `Ceremony` component (src/ui/ceremony.tsx), rendered with
 * Preact at each step, outside the screens' render. `FX.cer` keeps the table looking open until it is dismissed.
 */
import { createRef, h, render as draw } from 'preact';
import type { Sound } from '../audio/synth';
import { DEN } from '../domain/chips';
import type { FxLayer } from '../fx/layer';
import { dealerNod } from '../fx/room';
import { Ceremony, type CeremonyCard } from '../ui/ceremony';
import { chipStyle } from '../ui/chips-html';
import { formatChips, joinNames } from '../i18n';
import type { State } from './state';

/** The chip colours that rain (the eleven smallest values). */
const RAIN_COLOURS = DEN.slice(0, 11);
const COUNT_UP_MS = 1400;

export interface CeremonyDeps {
  S: State;
  /** `#fin`. */
  el: HTMLElement;
  layer: FxLayer;
  snd: Sound;
  render(): void;
}

export type CeremonyPlayer = ReturnType<typeof createCeremony>;

export function createCeremony(d: CeremonyDeps) {
  const { S, el, layer: L, snd } = d,
    FX = L.FX,
    RM = L.reduced;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const rain = createRef<HTMLDivElement>();

  /** Ends the ceremony (if any) and empties `#fin`. */
  function hide(): void {
    timers.forEach(clearTimeout);
    timers = [];
    draw(null, el);
    el.hidden = true;
    el.innerHTML = '';
    FX.cer = false;
  }

  function chipRain(n: number): void {
    const box = rain.current;
    if (RM || !box) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i'),
        v = RAIN_COLOURS[Math.floor(Math.random() * RAIN_COLOURS.length)],
        sz = 16 + Math.random() * 20;
      c.className = 'cf';
      c.style.cssText = `${chipStyle(v)};left:${Math.random() * 100}%;width:${sz}px;height:${sz}px`;
      box.appendChild(c);
      const sway = (Math.random() - 0.5) * 160,
        spin = 360 + Math.random() * 900;
      try {
        c.animate(
          [
            { transform: 'translate(0,-12vh) rotateX(0) rotate(0)' },
            { transform: `translate(${sway}px,112vh) rotateX(${spin}deg) rotate(${spin / 2}deg)` },
          ],
          {
            duration: 2400 + Math.random() * 2400,
            delay: Math.random() * 1600,
            easing: 'cubic-bezier(.35,.05,.6,1)',
            fill: 'both',
          },
        ).onfinish = () => c.remove();
      } catch {
        c.remove();
      }
    }
  }

  function countUp(target: Element | null, to: number, ms: number): void {
    if (!target) return;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      target.textContent = formatChips(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Plays the ceremony for the closed room's final standings (from its first step). */
  function play(): void {
    const r = S.room,
      f = r && r.final;
    if (!f || !f.list || !f.list.length) return;
    hide();
    FX.cer = true;
    S.sheet = null;
    d.render();
    const list = f.list,
      top = list[0].stack,
      win = list.filter(x => x.stack === top),
      lead = win[0];
    const T = (ms: number, fn: () => void) => timers.push(setTimeout(fn, RM ? Math.min(ms, 200) : ms));
    // 1. spotlight on the winner's seat, drumroll
    const tbl = document.querySelector('.bjt, .stage .table');
    if (tbl) tbl.scrollIntoView({ block: 'center', behavior: 'instant' });
    const seat = L.rectOf('seat:' + lead.pid),
      x = seat ? seat.x - scrollX : innerWidth / 2,
      y = seat ? seat.y - scrollY : innerHeight / 2;
    let card: CeremonyCard | null = null;
    const show = () => draw(h(Ceremony, { x, y, card, rain }), el);
    show();
    el.hidden = false;
    snd.drumroll(1.9);
    dealerNod(RM);
    const throb = setInterval(() => L.pulse('seat:' + lead.pid, 1.25), 420);
    timers.push(throb);
    // 2. the reveal: fanfare, applause, the winner's card, raining chips
    T(1950, () => {
      clearInterval(throb);
      snd.fanfare();
      snd.applause();
      snd.say('winner');
      setTimeout(() => snd.chips(6), 300);
      setTimeout(() => snd.chips(5), 900);
      card = {
        // Each winner with their pid: the circle's colour behind the letter comes from it.
        winners: win.map(w => (S.players[w.pid] ? { ...S.players[w.pid], pid: w.pid } : w)),
        names: joinNames(win.map(w => w.name)),
        list,
        players: S.players,
        rest: false,
      };
      show();
      countUp(el.querySelector('[data-count]'), top, COUNT_UP_MS);
      chipRain(70);
      T(1500, () => chipRain(40));
    });
    // 3. the standings slide in
    T(3700, () => {
      if (card) {
        card = { ...card, rest: true };
        show();
      }
      snd.chips(3);
    });
  }

  return { play, hide };
}
