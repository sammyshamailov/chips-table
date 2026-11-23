/**
 * The Blackjack table's geometry, in % of the table box. Seats, betting circles, the insurance spots and the printed
 * text sit on ellipses that share one centre near the dealer (`GEO.cy`). The table is 100 wide and 98 high.
 */

/** An ellipse's radii: [horizontal, vertical]. */
export type Radii = readonly [number, number];

export const GEO = {
  cy: 8,
  seat: [47, 75],
  spot: [34, 56],
  ins: [19.5, 32],
  bj: [25, 43],
  insText: [19.5, 33.6],
  in1: [17, 27.5],
  in2: [22, 37],
  /** The widest angle a seat sits at, either side of the middle (degrees). */
  max: 64,
} as const satisfies Record<string, number | Radii>;

/** The table box is this much less high than wide (the arcs printed on the felt are squashed by it). */
const ASPECT = 0.98;

/** The point at angle `phi` (radians, 0 = straight down from the centre, positive to the left) on ellipse `e`. */
export const ept = (phi: number, e: Radii): [number, number] => [
  50 + e[0] * Math.sin(phi),
  GEO.cy + e[1] * Math.cos(phi),
];

interface Arc {
  /** [angle in degrees, length of the arc up to it] every half degree. */
  pts: [number, number][];
  L: number;
}
let arcTable: Arc | null = null;

/** The arc of betting circles, measured once (the first time a table is drawn). */
function arc(): Arc {
  if (arcTable) return arcTable;
  const pts: [number, number][] = [];
  let L = 0,
    prev = ept((-GEO.max * Math.PI) / 180, GEO.spot);
  for (let d = -GEO.max; d <= GEO.max + 0.001; d += 0.5) {
    const q = ept((d * Math.PI) / 180, GEO.spot);
    L += Math.hypot(q[0] - prev[0], (q[1] - prev[1]) * ASPECT);
    pts.push([d, L]);
    prev = q;
  }
  return (arcTable = { pts, L });
}

/** Where `n` seats sit (angles in radians) and how big their circles are (% of the table width). */
export interface SeatLayout {
  angles: number[];
  size: number;
}

/** Seats are spaced evenly along the arc of betting circles, so circles never overlap however many players sit down. */
export function seatLayout(n: number): SeatLayout {
  if (n <= 1) return { angles: [0], size: 13.5 };
  const { pts, L } = arc(),
    gap = Math.min(17, L / (n - 1)),
    mid = L / 2;
  const angles = Array.from({ length: n }, (_, k) => {
    const target = mid + gap * ((n - 1) / 2 - k); // k = 0 sits on the right, the first seat when reading Hebrew
    const hit = pts.find(q => q[1] >= target) || pts[pts.length - 1];
    return (hit[0] * Math.PI) / 180;
  });
  return { angles, size: Math.min(13.5, gap * 0.86) };
}

/** The SVG path of a printed arc on ellipse `e`, `deg` degrees either side of the middle (drawn right to left). */
export function arcPath(e: Radii, deg: number): string {
  const a = (deg * Math.PI) / 180,
    k = ASPECT,
    [x1, y1] = ept(-a, e),
    [x2, y2] = ept(a, e);
  return `M${x1.toFixed(2)} ${(y1 * k).toFixed(2)} A${e[0]} ${(e[1] * k).toFixed(2)} 0 0 0 ${x2.toFixed(2)} ${(y2 * k).toFixed(2)}`;
}

/** Where one seat's betting circles go: `m` circles side by side (a split), each `size` wide, kept inside the table. */
export function spotsAt(phi: number, base: number, m: number): { x: number[]; y: number; size: number } {
  const [bx, by] = ept(phi, GEO.spot),
    size = m === 1 ? base : Math.min(base * (m === 2 ? 0.8 : 0.66), 15 / m + 3);
  const x = Array.from({ length: m }, (_, j) =>
    Math.max(size / 2 + 0.5, Math.min(99.5 - size / 2, bx + (j - (m - 1) / 2) * size * 1.04)),
  );
  return { x, y: by, size };
}
