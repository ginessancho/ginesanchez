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

// ---------- creatures ----------

// Speed as a fraction of the creature's own height per second.
const SPEED = { walker: 0.45, flyer: 0.7, crystal: 0.1, knot: 0.25, kelp: 0, tower: 0 };

function initModuleState(mod, rand) {
  if (mod.kind === "knot") return { x: 0, y: 0, trail: [{ x: 0, y: 0 }] };
  if (mod.kind === "drip") {
    const n = mod.params.count;
    return {
      lens: Array.from({ length: n }, () => rand() * mod.size),
      speeds: Array.from({ length: n }, () => (0.2 + rand() * 0.4) * mod.size),
    };
  }
  return {};
}

function advanceModuleState(mod, state, dt, rand) {
  const s = mod.size;
  if (mod.kind === "knot") {
    state.x += (rand() - 0.5) * 0.14 * s;
    state.y += (rand() - 0.5) * 0.14 * s;
    const d = Math.hypot(state.x, state.y);
    if (d > s) { state.x *= s / d; state.y *= s / d; }
    state.trail.push({ x: state.x, y: state.y });
    while (state.trail.length > mod.params.length) state.trail.shift();
  } else if (mod.kind === "drip") {
    for (let i = 0; i < state.lens.length; i++) {
      state.lens[i] += state.speeds[i] * dt;
      if (state.lens[i] > s * 1.6) state.lens[i] = 0;
    }
  }
}

export function createCreature(plan, { x, y, scale, seed }) {
  const rand = rng(seed);
  const species = plan.species;
  let heading = plan.heading;
  if (species === "crystal" || species === "knot") heading = rand() * TAU;
  return {
    plan,
    species,
    x, y, scale,
    vx: 0, vy: 0,
    heading,
    speed: SPEED[species],
    rand,
    rest: plan.spine,
    nodes: plan.spine.map((p) => ({ x: p.x, y: p.y, px: p.x, py: p.y })),
    moduleState: plan.modules.map((m) => initModuleState(m, rand)),
  };
}

function angleDiff(want, have) {
  let d = want - have;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function outside(c, field, m) {
  return c.x < field.x + m || c.x > field.x + field.w - m || c.y < field.y + m || c.y > field.y + field.h - m;
}

export function step(c, dt, t, field, others = []) {
  const preset = SPECIES[c.species];
  const sp = c.speed * c.scale;
  const m = c.scale;

  // Locomotion by species.
  switch (c.species) {
    case "walker":
      if (c.x < field.x + m && Math.cos(c.heading) < 0) c.heading = 0;
      if (c.x > field.x + field.w - m && Math.cos(c.heading) > 0) c.heading = Math.PI;
      c.vx = Math.cos(c.heading) * sp;
      c.vy = 0;
      break;
    case "flyer": {
      c.heading += (c.rand() - 0.5) * 1.5 * dt;
      if (outside(c, field, m)) {
        const want = Math.atan2(field.y + field.h / 2 - c.y, field.x + field.w / 2 - c.x);
        c.heading += angleDiff(want, c.heading) * 2 * dt;
      }
      c.vx = Math.cos(c.heading) * sp;
      c.vy = Math.sin(c.heading) * sp;
      break;
    }
    case "crystal":
      if (c.x < field.x + m || c.x > field.x + field.w - m) c.heading = Math.PI - c.heading;
      if (c.y < field.y + m || c.y > field.y + field.h - m) c.heading = -c.heading;
      c.vx = Math.cos(c.heading) * sp;
      c.vy = Math.sin(c.heading) * sp;
      break;
    case "knot":
      c.vx = c.vx * 0.9 + (c.rand() - 0.5) * sp * 2;
      c.vy = c.vy * 0.9 + (c.rand() - 0.5) * sp * 2;
      break;
    default:
      c.vx = 0;
      c.vy = 0;
  }

  // Separation, strong; alignment and cohesion are left to the bounds pull.
  if (preset.mobile) {
    for (const o of others) {
      if (o === c) continue;
      const dx = c.x - o.x, dy = c.y - o.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const r = (c.scale + o.scale) * 0.8;
      if (d < r) {
        const push = ((r - d) / r) * sp * 1.5;
        c.vx += (dx / d) * push;
        c.vy += (dy / d) * push;
      }
    }
    if (c.species === "walker") c.vy = 0;
  }

  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (preset.mobile) {
    c.x = Math.min(Math.max(c.x, field.x), field.x + field.w);
    c.y = Math.min(Math.max(c.y, field.y), field.y + field.h);
  }

  // Spine: a verlet chain in local units. The base is pinned; the rest lags
  // behind motion and drifts back to its rest shape.
  const fa = c.species === "flyer" ? c.heading : 0;
  const lagWorldX = (-c.vx / c.scale) * 0.25;
  const lagWorldY = (-c.vy / c.scale) * 0.25;
  const lagX = Math.cos(-fa) * lagWorldX - Math.sin(-fa) * lagWorldY;
  const lagY = Math.sin(-fa) * lagWorldX + Math.cos(-fa) * lagWorldY;
  const last = c.nodes.length - 1;
  for (let i = 1; i <= last; i++) {
    const n = c.nodes[i], r = c.rest[i];
    const vx = (n.x - n.px) * 0.9, vy = (n.y - n.py) * 0.9;
    n.px = n.x; n.py = n.y;
    const w = i / last;
    n.x += vx + (r.x + lagX * w - n.x) * 0.12 + Math.sin(t * 1.3 + i) * 0.002 * w;
    n.y += vy + (r.y + lagY * w - n.y) * 0.12;
  }
  for (let i = 1; i <= last; i++) {
    const a = c.nodes[i - 1], b = c.nodes[i];
    const rl = Math.hypot(c.rest[i].x - c.rest[i - 1].x, c.rest[i].y - c.rest[i - 1].y);
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
    const k = (d - rl) / d;
    b.x -= (b.x - a.x) * k;
    b.y -= (b.y - a.y) * k;
  }

  c.plan.modules.forEach((mod, i) => advanceModuleState(mod, c.moduleState[i], dt, c.rand));
}

export function spineAt(nodes, at) {
  const segs = nodes.length - 1;
  const f = Math.min(Math.max(at, 0), 1) * segs;
  const i = Math.min(Math.floor(f), segs - 1);
  const u = f - i;
  const a = nodes[i], b = nodes[i + 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  return {
    point: { x: a.x + dx * u, y: a.y + dy * u },
    tangent: { x: dx / d, y: dy / d },
  };
}

// World-space primitives for one creature at time t.
// Frame: flyers rotate with their heading; everyone else stands upright.
// Cones ignore the spine tangent and point along the heading directly.
export function pose(c, t) {
  const fa = c.species === "flyer" ? c.heading : 0;
  const fc = Math.cos(fa), fs = Math.sin(fa);
  const toWorld = (p) => ({
    x: c.x + c.scale * (fc * p.x - fs * p.y),
    y: c.y + c.scale * (fs * p.x + fc * p.y),
  });
  const prims = [{ points: c.nodes.map((n) => toWorld(n)), closed: false, solid: false }];
  c.plan.modules.forEach((mod, i) => {
    const { point, tangent } = spineAt(c.nodes, mod.at);
    const isCone = mod.kind === "cone";
    const m = isCone ? { ...mod, angle: c.species === "flyer" ? 0 : c.heading } : mod;
    const ra = isCone ? 0 : Math.atan2(tangent.y, tangent.x) + Math.PI / 2;
    const ca = Math.cos(ra), sa = Math.sin(ra);
    for (const prim of moduleGeometry(m, t, c.moduleState[i])) {
      prims.push({
        ...prim,
        points: prim.points.map((q) => toWorld({ x: point.x + q.x * ca - q.y * sa, y: point.y + q.x * sa + q.y * ca })),
      });
    }
  });
  return prims;
}
