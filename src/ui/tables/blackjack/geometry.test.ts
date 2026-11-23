import { describe, expect, it } from 'vitest';
import { GEO, arcPath, ept, seatLayout, spotsAt } from './geometry';

// The string view's code before R-005 phase 5 part B, kept here as the reference the component must match.
const OLD = (() => {
  const ARC = (() => {
    const pts: [number, number][] = [];
    let L = 0,
      prev = ept((-GEO.max * Math.PI) / 180, GEO.spot);
    for (let d = -GEO.max; d <= GEO.max + 0.001; d += 0.5) {
      const q = ept((d * Math.PI) / 180, GEO.spot);
      L += Math.hypot(q[0] - prev[0], (q[1] - prev[1]) * 0.98);
      pts.push([d, L]);
      prev = q;
    }
    return { pts, L };
  })();
  function seatLayout(n: number) {
    if (n <= 1) return { angles: [0], size: 13.5 };
    const gap = Math.min(17, ARC.L / (n - 1)),
      mid = ARC.L / 2;
    const angles = Array.from({ length: n }, (_, k) => {
      const target = mid + gap * ((n - 1) / 2 - k);
      const hit = ARC.pts.find(q => q[1] >= target) || ARC.pts[ARC.pts.length - 1];
      return (hit[0] * Math.PI) / 180;
    });
    return { angles, size: Math.min(13.5, gap * 0.86) };
  }
  function arc(id: string, e: readonly [number, number], deg: number) {
    const a = (deg * Math.PI) / 180,
      k = 0.98,
      [x1, y1] = ept(-a, e),
      [x2, y2] = ept(a, e);
    return `<path id="${id}" d="M${x1.toFixed(2)} ${(y1 * k).toFixed(2)} A${e[0]} ${(e[1] * k).toFixed(2)} 0 0 0 ${x2.toFixed(2)} ${(y2 * k).toFixed(2)}"/>`;
  }
  return { seatLayout, arc };
})();

describe('Blackjack table geometry', () => {
  it('places 0 to 12 seats exactly where the string view did', () => {
    for (let n = 0; n <= 12; n++) expect(seatLayout(n)).toEqual(OLD.seatLayout(n));
  });
  it('prints the same arcs', () => {
    expect(`<path id="pa-bj" d="${arcPath(GEO.bj, 48)}"/>`).toBe(OLD.arc('pa-bj', GEO.bj, 48));
    expect(`<path id="pa-it" d="${arcPath(GEO.insText, 40)}"/>`).toBe(OLD.arc('pa-it', GEO.insText, 40));
    expect(arcPath(GEO.in1, 42)).toBe('M38.62 27.87 A17 26.95 0 0 0 61.38 27.87');
  });
  it('seats the first player on the right and the rest leftwards, symmetric about the middle', () => {
    const { angles } = seatLayout(5);
    expect(ept(angles[0], GEO.seat)[0]).toBeGreaterThan(50);
    expect(angles[2]).toBeCloseTo(0, 5);
    expect(angles[0]).toBeCloseTo(-angles[4], 1); // the arc is measured every half degree
    for (let k = 1; k < 5; k++) expect(angles[k]).toBeLessThan(angles[k - 1]);
  });
  it('shrinks the circles for a crowded table and never lets them overlap along the arc', () => {
    expect(seatLayout(2).size).toBe(13.5);
    const big = seatLayout(10);
    expect(big.size).toBeLessThan(13.5);
    const pts = big.angles.map(a => ept(a, GEO.spot));
    for (let k = 1; k < pts.length; k++)
      expect(Math.hypot(pts[k][0] - pts[k - 1][0], (pts[k][1] - pts[k - 1][1]) * 0.98)).toBeGreaterThan(
        big.size * 0.98,
      );
  });
  it('puts split hands side by side, smaller, inside the table', () => {
    const one = spotsAt(0, 13.5, 1),
      two = spotsAt(0, 13.5, 2),
      four = spotsAt(-1.1, 13.5, 4);
    expect(one).toEqual({ x: [50], y: ept(0, GEO.spot)[1], size: 13.5 });
    expect(two.size).toBe(10.5);
    expect(two.x[0]).toBeLessThan(two.x[1]);
    expect(Math.min(...four.x) - four.size / 2).toBeGreaterThanOrEqual(0.5);
  });
});
