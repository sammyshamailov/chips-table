/**
 * The effects layer: chips flying over the table on `#fx` (outside `#app`, so a render doesn't cut them short),
 * floating text, pulses, and the overrides that keep showing the old picture until the chips land.
 *
 * Positions are page coordinates of `[data-k]` elements. `render()` (the app's) calls `measure()` first and keeps the
 * result in `FX.rects`, the positions before the render: an effect reads "from" there (`oldRect`) and "to" from the
 * fresh DOM (`rectOf`). While chips are in the air, `FX.ov[pid]` holds what that player's spots and stack looked like
 * before; the views draw it until `clearOv` removes it and renders again.
 */
import type { BjHand } from '../domain/types';
import { stackHTML } from '../ui/chips-html';
import type { Chips } from '../sync/domain-events';

/** A point on the page with the size of the element it came from. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A spot drawn by an override; `_hide` leaves it empty while its chips are in the air. */
export type ShownHand = BjHand & { _hide?: boolean };

/** What a player's seat should still show while chips fly. Only the fields given replace the real ones. */
export interface Override {
  hands?: ShownHand[];
  ins?: number;
  stack?: number;
  /** Hide the result badge (the payout shows it when the chips land). */
  hideRes?: boolean;
}

interface StoredOverride extends Override {
  tok: number;
  until: number;
}

/** The effects' shared state. `pendFly`: how many of your chips in hand are still in the air. */
export interface FxState {
  rects: Record<string, Rect>;
  ov: Record<string, StoredOverride>;
  pendFly: number;
  n: number;
  signDrop: number;
  cer: boolean;
}

export interface FlyOptions {
  from: Rect | null;
  to: Rect | null;
  /** What to draw (ignored when `html` is given). */
  amt?: Chips;
  html?: string;
  dur?: number;
  delay?: number;
  /** How high the chips rise mid-flight (px); by default it grows with the distance. */
  lift?: number;
  fadeOut?: boolean;
  fadeIn?: boolean;
  /** Played when the chips take off. */
  sound?: () => void;
  /** Runs when they land (also when nothing could be animated). */
  land?: () => void;
}

export interface FxLayerDeps {
  /** The `#fx` element. */
  el: HTMLElement;
  /** The app's render (an override that ends redraws the table). */
  render: () => void;
  /** Who is using this phone: your own chips fly to your chip count when your seat is off screen. */
  myId: () => string | null;
}

export type FxLayer = ReturnType<typeof createFxLayer>;

/** The layer over `deps.el`. Creating it does nothing on screen. */
export function createFxLayer(deps: FxLayerDeps) {
  const reduced = (() => {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  })();
  const FX: FxState = { rects: {}, ov: {}, pendFly: 0, n: 0, signDrop: 0, cer: false };
  const now = () => Date.now();

  function pageRect(el: Element): Rect | null {
    const b = el.getBoundingClientRect();
    return b.width || b.height
      ? { x: b.left + scrollX + b.width / 2, y: b.top + scrollY + b.height / 2, w: b.width, h: b.height }
      : null;
  }
  function measure(): Record<string, Rect> {
    const m: Record<string, Rect> = {};
    document.querySelectorAll<HTMLElement>('[data-k]').forEach(el => {
      const r = pageRect(el);
      if (r) m[el.dataset.k as string] = r;
    });
    return m;
  }
  function rectOf(k: string): Rect | null {
    const el = document.querySelector('[data-k="' + k + '"]');
    return el ? pageRect(el) : null;
  }
  /** Where `k` was before the render. */
  const oldRect = (k: string) => FX.rects[k] || rectOf(k);
  const shift = (r: Rect | null, dx: number, dy = 0): Rect | null => r && { ...r, x: r.x + dx, y: r.y + dy };
  /** 1% of the table's width in px (`--u`). */
  const unitPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 3.4;
  /** Is this point visible, and not hidden behind the fixed bottom dock (portrait)? */
  function onScreen(r: Rect | null): boolean {
    if (!r) return false;
    let bottom = scrollY + innerHeight;
    const dock = document.querySelector('.dock');
    if (dock && getComputedStyle(dock).position === 'fixed') bottom = dock.getBoundingClientRect().top + scrollY;
    return r.y > scrollY && r.y < bottom - 8;
  }
  /** Where a player's chips go: the seat, or for you your chip count when your seat is off screen. */
  function seatTarget(pid: string): Rect | null {
    const s = rectOf('seat:' + pid);
    if (pid !== deps.myId()) return s;
    const d = rectOf('mystack');
    return onScreen(s) ? s : d || s;
  }

  /** Holds `o` for `pid` for about `ms`; returns the token that `clearOv` needs. */
  function setOv(pid: string, o: Override, ms: number): number {
    const tok = ++FX.n;
    FX.ov[pid] = { ...o, tok, until: now() + ms + 600 };
    setTimeout(() => clearOv(pid, tok), ms + 650);
    return tok;
  }
  /** Ends the override `tok` (if it is still the current one) and renders. */
  function clearOv(pid: string, tok: number): void {
    if (FX.ov[pid] && FX.ov[pid].tok === tok) {
      delete FX.ov[pid];
      deps.render();
    }
  }
  const ov = (pid: string): StoredOverride | null => {
    const o = FX.ov[pid];
    return o && o.until > now() ? o : null;
  };
  /** The stack a seat shows: the override's while chips fly to it. */
  const shownStack = (p: { pid: string; stack?: number }) => {
    const o = ov(p.pid);
    return o && o.stack != null ? o.stack : p.stack;
  };

  function fly(o: FlyOptions): void {
    let done = false,
      el: HTMLDivElement | null = null;
    const fin = () => {
      if (done) return;
      done = true;
      if (el) el.remove();
      if (o.land) o.land();
    };
    if (!o.from || !o.to || reduced) {
      setTimeout(fin, reduced ? Math.min(o.delay || 0, 300) : 0);
      return;
    }
    el = document.createElement('div');
    el.className = 'fly';
    el.style.left = o.from.x + 'px';
    el.style.top = o.from.y + 'px';
    el.innerHTML = `<div class="fly-y"><div class="fly-c">${o.html || stackHTML(o.amt)}</div></div>`;
    deps.el.appendChild(el);
    const dx = o.to.x - o.from.x,
      dy = o.to.y - o.from.y,
      dur = o.dur || 540,
      delay = o.delay || 0;
    const lift = o.lift ?? Math.min(70, 14 + Math.hypot(dx, dy) * 0.22);
    const opt: KeyframeAnimationOptions = { duration: dur, delay, fill: 'both' };
    try {
      const y = el.firstChild as HTMLElement,
        c = y.firstChild as HTMLElement;
      const a = el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }], {
        ...opt,
        easing: 'cubic-bezier(.5,0,.3,1)',
      });
      y.animate(
        [
          { transform: 'translateY(0) scale(1)', easing: 'ease-out' },
          { transform: `translateY(${-lift}px) scale(1.12)`, offset: 0.45, easing: 'ease-in' },
          { transform: `translateY(0) scale(${o.fadeOut ? 0.7 : 1})` },
        ],
        opt,
      );
      if (o.fadeOut || o.fadeIn)
        c.animate(
          [
            { opacity: o.fadeIn ? 0 : 1 },
            { opacity: 1, offset: o.fadeIn ? 0.25 : 0.72 },
            { opacity: o.fadeOut ? 0 : 1 },
          ],
          opt,
        );
      a.onfinish = fin;
    } catch {
      fin();
      return;
    }
    if (o.sound) setTimeout(o.sound, delay);
    setTimeout(fin, delay + dur + 500);
  }

  function floatText(at: Rect | null, text: string, cls = ''): void {
    if (!at) return;
    const el = document.createElement('div');
    el.className = 'ft ' + cls;
    el.textContent = text;
    el.style.left = at.x + 'px';
    el.style.top = at.y + 'px';
    deps.el.appendChild(el);
    const c = 'translate(-50%,-50%)';
    try {
      el.animate(
        [
          { transform: `${c} translateY(0) scale(.5)`, opacity: 0 },
          { transform: `${c} translateY(-8px) scale(1.15)`, opacity: 1, offset: 0.2 },
          { transform: `${c} translateY(-14px) scale(1)`, opacity: 1, offset: 0.65 },
          { transform: `${c} translateY(-40px) scale(1)`, opacity: 0 },
        ],
        { duration: 1600, easing: 'ease-out', fill: 'both' },
      );
    } catch {
      // no Web Animations: the text just shows and goes
    }
    setTimeout(() => el.remove(), 1700);
  }

  function pulse(k: string, s = 1.14): void {
    const el = document.querySelector('[data-k="' + k + '"]');
    if (!el || reduced) return;
    try {
      el.animate([{ scale: '1' }, { scale: String(s) }, { scale: '1' }], { duration: 300, easing: 'ease-out' });
    } catch {
      // no Web Animations
    }
  }

  return {
    FX,
    /** The phone asks for reduced motion: chips land at once. */
    reduced,
    redraw: () => deps.render(),
    pageRect,
    measure,
    rectOf,
    oldRect,
    shift,
    unitPx,
    onScreen,
    seatTarget,
    setOv,
    clearOv,
    ov,
    shownStack,
    fly,
    floatText,
    pulse,
  };
}
