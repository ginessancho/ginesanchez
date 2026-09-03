// Pose engine. Turns a plan into clean primitives every frame.
// Module space: origin at the module's anchor on the spine, up is -y,
// sizes in local units (creature height about 1). Hand rules come later,
// in strokes.js; nothing here jitters.

import { SPECIES, rng } from "./grammar.js";

const TAU = Math.PI * 2;

export function rot2(p, c, s) {
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

// Rotate around x, then y. Orthographic projection is just dropping z.
export function rot3(v, rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  const y1 = v.y * cx - v.z * sx;
  const z1 = v.y * sx + v.z * cx;
  return { x: v.x * cy + z1 * sy, y: y1, z: -v.x * sy + z1 * cy };
}

export function circle(cx, cy, r, n = 12) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export const CUBE = {
  v: Array.from({ length: 8 }, (_, i) => ({ x: i & 1 ? 1 : -1, y: i & 2 ? 1 : -1, z: i & 4 ? 1 : -1 })),
  e: [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]],
};

export const OCTA = {
  v: [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }],
  e: [[0, 2], [0, 3], [1, 2], [1, 3], [0, 4], [0, 5], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]],
};

export function moduleGeometry(mod, t, state = {}) {
  const { kind, size: s, phase, angle, params: p } = mod;
  const prims = [];
  const line = (pts) => prims.push({ points: pts, closed: false, solid: false });
  const loop = (pts, solid = false) => prims.push({ points: pts, closed: true, solid });

  switch (kind) {
    case "burst": {
      const pulse = 0.75 + 0.25 * Math.sin(t * 3 + phase);
      for (let i = 0; i < p.rays; i++) {
        const a = phase + (i / p.rays) * TAU;
        line([{ x: 0, y: 0 }, { x: Math.cos(a) * s * pulse, y: Math.sin(a) * s * pulse }]);
      }
      break;
    }
    case "spiral": {
      const turns = p.turns + 0.5 * Math.sin(t * 0.8 + phase);
      const steps = Math.max(8, Math.round(turns * 16));
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const th = (k / steps) * turns * TAU + angle;
        const r = (s * k) / steps;
        pts.push({ x: Math.cos(th) * r, y: Math.sin(th) * r });
      }
      line(pts);
      break;
    }
    case "pinwheel": {
      const rot = t * 1.2 + phase + angle;
      for (let b = 0; b < p.blades; b++) {
        const a0 = rot + (b / p.blades) * TAU;
        const a1 = a0 + (TAU / p.blades) * 0.55;
        loop([{ x: 0, y: 0 }, { x: Math.cos(a0) * s, y: Math.sin(a0) * s }, { x: Math.cos(a1) * s, y: Math.sin(a1) * s }]);
      }
      break;
    }
    case "lattice": {
      const shape = p.shape === "cube" ? CUBE : OCTA;
      const v = shape.v.map((q) => rot3(q, t * p.spinX + phase, t * p.spinY));
      const k = s * 0.6;
      for (const [a, b] of shape.e) line([{ x: v[a].x * k, y: v[a].y * k }, { x: v[b].x * k, y: v[b].y * k }]);
      break;
    }
    case "beads": {
      const n = 8;
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        pts.push({ x: Math.sin(t * 1.5 + phase + k * 0.6) * f * f * s * 0.5, y: -f * s * 1.4 });
      }
      line(pts);
      for (let i = 1; i <= p.count; i++) {
        const q = pts[Math.round((i / (p.count + 1)) * n)];
        loop(circle(q.x, q.y, s * 0.06, 8), true);
      }
      break;
    }
    case "comb": {
      const spacing = (s / p.teeth) * (1 + 0.15 * Math.sin(t * 2 + phase));
      const c = Math.cos(angle), sn = Math.sin(angle);
      for (let i = 0; i < p.teeth; i++) {
        const x = (i - (p.teeth - 1) / 2) * spacing;
        line([rot2({ x, y: 0 }, c, sn), rot2({ x, y: -s * 0.6 }, c, sn)]);
      }
      break;
    }
    case "boxes": {
      const h = s / p.count, w = s * 0.7;
      for (let i = 0; i < p.count; i++) {
        const shift = 0.05 * s * Math.sin(t * 2 + phase + i);
        const y0 = -i * h, y1 = -(i + 1) * h;
        loop([{ x: shift - w / 2, y: y0 }, { x: shift + w / 2, y: y0 }, { x: shift + w / 2, y: y1 }, { x: shift - w / 2, y: y1 }]);
      }
      break;
    }
    case "limb": {
      const swing = 0.45 * Math.sin(t * 4 + phase);
      const c = Math.cos(swing), sn = Math.sin(swing);
      const len = s * 1.3;
      const pts = [{ x: 0, y: 0 }];
      for (let k = 1; k <= p.segments; k++) {
        const y = (k / p.segments) * len;
        const x = p.side * (k % 2 ? 0.18 : 0.06) * s;
        pts.push(rot2({ x, y }, c, sn));
      }
      line(pts);
      break;
    }
    case "eye": {
      const r = s * 0.4;
      const blink = 1 - 0.9 * Math.pow(Math.max(0, Math.sin(t * 0.9 + phase)), 40);
      loop(circle(0, 0, r, 14).map((q) => ({ x: q.x, y: q.y * blink })));
      loop(circle(0, 0, r * 0.3, 8), true);
      for (let i = 0; i < p.cilia; i++) {
        const a = (i / p.cilia) * TAU;
        const out = r * (1.35 + 0.12 * Math.sin(t * 7 + phase + i));
        line([
          { x: Math.cos(a) * r, y: Math.sin(a) * r * blink },
          { x: Math.cos(a) * out, y: Math.sin(a) * out * blink },
        ]);
      }
      break;
    }
    case "cone": {
      const c = Math.cos(angle), sn = Math.sin(angle);
      loop([rot2({ x: s, y: 0 }, c, sn), rot2({ x: 0, y: -s * 0.28 }, c, sn), rot2({ x: 0, y: s * 0.28 }, c, sn)], true);
      break;
    }
    case "knot": {
      if (state.trail && state.trail.length > 1) line(state.trail.map((q) => ({ ...q })));
      break;
    }
    case "drip": {
      const lens = state.lens || [];
      for (let i = 0; i < p.count; i++) {
        const x = (i - (p.count - 1) / 2) * s * 0.25;
        line([{ x, y: 0 }, { x, y: lens[i] ?? 0.05 * s }]);
      }
      break;
    }
    default:
      break;
  }
  return prims;
}
