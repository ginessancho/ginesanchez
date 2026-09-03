// Hand rules. Clean primitives in, inked strokes out. This is the only
// place the line is allowed to wobble.

export const WEIGHT = 1.4;      // one pen
export const OVERSHOOT = 3;     // px past each end of an open stroke
export const GAP = 0.15;        // fraction of the closing segment left open
export const DOUBLE_EVERY = 5;  // roughly one stroke in five is drawn twice
export const BOIL_FPS = 8;      // jitter resamples this often; positions run at 60
export const JITTER = 1.1;      // px

function hash(a, b, c, d) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ c, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15) ^ d, 0x165667b1);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function makeJitter(seed, tick, amount = JITTER) {
  return (i, j) => ({
    dx: (hash(seed, tick, i, j * 2) - 0.5) * 2 * amount,
    dy: (hash(seed, tick, i, j * 2 + 1) - 0.5) * 2 * amount,
  });
}

function extend(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return to;
  return { x: to.x + (dx / d) * OVERSHOOT, y: to.y + (dy / d) * OVERSHOOT };
}

function overshoot(pts) {
  if (pts.length < 2) return pts;
  return [extend(pts[1], pts[0]), ...pts.slice(1, -1), extend(pts[pts.length - 2], pts[pts.length - 1])];
}

function openLoop(pts) {
  const first = pts[0], last = pts[pts.length - 1];
  return [...pts, { x: last.x + (first.x - last.x) * (1 - GAP), y: last.y + (first.y - last.y) * (1 - GAP) }];
}

export function handStrokes(primitives, jitter) {
  const out = [];
  primitives.forEach((prim, i) => {
    if (prim.solid) {
      out.push({ points: prim.points, weight: WEIGHT, solid: true });
      return;
    }
    const pts = prim.points.map((p, j) => {
      const d = jitter(i, j);
      return { x: p.x + d.dx, y: p.y + d.dy };
    });
    const stroke = prim.closed ? openLoop(pts) : overshoot(pts);
    out.push({ points: stroke, weight: WEIGHT, solid: false });
    if (i % DOUBLE_EVERY === 2) {
      out.push({ points: stroke.map((p) => ({ x: p.x + 0.8, y: p.y - 0.6 })), weight: WEIGHT, solid: false });
    }
  });
  return out;
}
