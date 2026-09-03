import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, makePlan, KINDS, MAX_MODULES, SPECIES_NAMES } from "./grammar.js";

// ---------- grammar ----------

test("rng is deterministic and stays in [0, 1)", () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test("same seed gives the same plan", () => {
  assert.deepEqual(makePlan(7), makePlan(7));
});

test("different seeds give different plans", () => {
  assert.notDeepEqual(makePlan(7), makePlan(8));
});

test("every plan has exactly one head, at the end of the spine", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const heads = makePlan(seed).modules.filter((m) => m.role === "head");
    assert.equal(heads.length, 1, `seed ${seed}`);
    assert.equal(heads[0].at, 1);
  }
});

test("module count stays between 2 and MAX_MODULES", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const n = makePlan(seed).modules.length;
    assert.ok(n >= 2 && n <= MAX_MODULES, `seed ${seed} has ${n}`);
  }
});

test("every module kind is in the catalogue", () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const m of makePlan(seed).modules) assert.ok(KINDS.includes(m.kind), m.kind);
  }
});

test("the head's angle is the heading", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const plan = makePlan(seed);
    assert.equal(plan.modules[0].angle, plan.heading);
  }
});

test("species can be forced", () => {
  for (const name of SPECIES_NAMES) assert.equal(makePlan(3, name).species, name);
});

test("a walker's first two limbs are half a cycle apart", () => {
  const limbs = makePlan(11, "walker").modules.filter((m) => m.role === "limb");
  assert.ok(limbs.length >= 2);
  assert.ok(Math.abs(limbs[1].phase - limbs[0].phase - Math.PI) < 1e-9);
});

import { moduleGeometry, rot3 } from "./pose.js";

// ---------- module geometry ----------

const mod = (kind, params, extra = {}) => ({
  role: "body", kind, at: 0.5, size: 0.4, angle: 0, phase: 0, params, ...extra,
});

test("a burst is one two-point ray per params.rays", () => {
  const prims = moduleGeometry(mod("burst", { rays: 9 }), 0);
  assert.equal(prims.length, 9);
  for (const p of prims) {
    assert.equal(p.points.length, 2);
    assert.equal(p.closed, false);
  }
});

test("a burst pulses with time", () => {
  const a = moduleGeometry(mod("burst", { rays: 8 }), 0)[0].points[1];
  const b = moduleGeometry(mod("burst", { rays: 8 }), 0.5)[0].points[1];
  assert.notDeepEqual(a, b);
});

test("rot3 keeps vector length", () => {
  const v = rot3({ x: 1, y: 2, z: 3 }, 0.7, 1.9);
  assert.ok(Math.abs(Math.hypot(v.x, v.y, v.z) - Math.hypot(1, 2, 3)) < 1e-9);
});

test("a lattice's projected vertices move under rotation", () => {
  const m = mod("lattice", { shape: "cube", spinX: 0.5, spinY: 0.8 });
  const a = moduleGeometry(m, 0);
  const b = moduleGeometry(m, 1);
  assert.equal(a.length, 12);
  assert.notDeepEqual(a[0].points, b[0].points);
});

test("an octahedron has twelve edges", () => {
  assert.equal(moduleGeometry(mod("lattice", { shape: "octa", spinX: 0.5, spinY: 0.8 }), 0).length, 12);
});

test("limbs half a cycle apart swing opposite ways", () => {
  const a = moduleGeometry(mod("limb", { segments: 5, side: 1 }, { phase: 0 }), 0.4)[0].points.at(-1);
  const b = moduleGeometry(mod("limb", { segments: 5, side: 1 }, { phase: Math.PI }), 0.4)[0].points.at(-1);
  assert.ok(Math.abs(a.x - b.x) > 0.01);
});

test("a cone is a single solid closed triangle pointing along its angle", () => {
  const prims = moduleGeometry(mod("cone", {}, { angle: 0 }), 0);
  assert.equal(prims.length, 1);
  assert.equal(prims[0].solid, true);
  assert.equal(prims[0].closed, true);
  assert.equal(prims[0].points.length, 3);
  assert.ok(prims[0].points[0].x > 0.3);
  assert.ok(Math.abs(prims[0].points[0].y) < 1e-9);
});

test("beads draw a line plus one solid dot per bead", () => {
  const prims = moduleGeometry(mod("beads", { count: 4 }), 0);
  assert.equal(prims.length, 5);
  assert.equal(prims.filter((p) => p.solid).length, 4);
});

test("a knot draws its trail and nothing without one", () => {
  assert.equal(moduleGeometry(mod("knot", { length: 40 }), 0, {}).length, 0);
  const trail = [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0.1 }];
  const prims = moduleGeometry(mod("knot", { length: 40 }), 0, { trail });
  assert.equal(prims.length, 1);
  assert.equal(prims[0].points.length, 3);
});

test("drips fall by their state", () => {
  const prims = moduleGeometry(mod("drip", { count: 3 }), 0, { lens: [0.1, 0.2, 0.3] });
  assert.equal(prims.length, 3);
  assert.ok(Math.abs(prims[2].points[1].y - 0.3) < 1e-9);
});

import { createCreature, step, pose, spineAt } from "./pose.js";

// ---------- creatures ----------

const field = { x: 0, y: 0, w: 800, h: 600 };

test("spineAt walks the spine and reports the tangent", () => {
  const nodes = [{ x: 0, y: 0 }, { x: 0, y: -0.5 }, { x: 0, y: -1 }];
  const mid = spineAt(nodes, 0.5);
  assert.ok(Math.abs(mid.point.y + 0.5) < 1e-9);
  assert.ok(Math.abs(mid.tangent.y + 1) < 1e-9);
  const end = spineAt(nodes, 1);
  assert.ok(Math.abs(end.point.y + 1) < 1e-9);
});

test("a fresh creature's spine base sits at its position", () => {
  const c = createCreature(makePlan(5, "walker"), { x: 100, y: 200, scale: 50, seed: 1 });
  const prims = pose(c, 0);
  assert.deepEqual(prims[0].points[0], { x: 100, y: 200 });
});

test("pose emits primitives for the spine and every module", () => {
  const plan = makePlan(5, "walker");
  const c = createCreature(plan, { x: 100, y: 200, scale: 50, seed: 1 });
  assert.ok(pose(c, 0).length > plan.modules.length);
});

test("a walker walks along x only", () => {
  const c = createCreature(makePlan(5, "walker"), { x: 400, y: 300, scale: 50, seed: 1 });
  for (let k = 0; k < 120; k++) step(c, 1 / 60, k / 60, field);
  assert.notEqual(c.x, 400);
  assert.equal(c.y, 300);
});

test("a walker turns round at the edge", () => {
  const plan = makePlan(5, "walker");
  const c = createCreature(plan, { x: 60, y: 300, scale: 50, seed: 1 });
  c.heading = Math.PI; // face left, toward the edge
  for (let k = 0; k < 120; k++) step(c, 1 / 60, k / 60, field);
  assert.ok(Math.cos(c.heading) > 0);
});

test("anchored species do not move", () => {
  for (const name of ["kelp", "tower"]) {
    const c = createCreature(makePlan(9, name), { x: 300, y: 500, scale: 50, seed: 2 });
    for (let k = 0; k < 120; k++) step(c, 1 / 60, k / 60, field);
    assert.equal(c.x, 300);
    assert.equal(c.y, 500);
  }
});

test("a colony stays inside the field after ten seconds", () => {
  const cs = Array.from({ length: 20 }, (_, i) =>
    createCreature(makePlan(100 + i), { x: 100 + ((i * 37) % 600), y: 100 + ((i * 53) % 400), scale: 50, seed: i }),
  );
  for (let k = 0; k < 600; k++) for (const c of cs) step(c, 1 / 60, k / 60, field, cs);
  for (const c of cs) {
    assert.ok(c.x >= field.x && c.x <= field.x + field.w, `x ${c.x}`);
    assert.ok(c.y >= field.y && c.y <= field.y + field.h, `y ${c.y}`);
  }
});

test("separation pushes overlapping mobile creatures apart", () => {
  const a = createCreature(makePlan(21, "crystal"), { x: 400, y: 300, scale: 50, seed: 1 });
  const b = createCreature(makePlan(22, "crystal"), { x: 405, y: 300, scale: 50, seed: 2 });
  a.heading = 0; b.heading = 0; // both drifting right, same speed
  const before = Math.abs(a.x - b.x);
  for (let k = 0; k < 60; k++) { step(a, 1 / 60, k / 60, field, [a, b]); step(b, 1 / 60, k / 60, field, [a, b]); }
  assert.ok(Math.abs(a.x - b.x) > before);
});

test("a knot's trail grows and is capped at params.length", () => {
  const plan = makePlan(31, "knot");
  const c = createCreature(plan, { x: 400, y: 300, scale: 50, seed: 3 });
  const cap = plan.modules[0].params.length;
  for (let k = 0; k < 600; k++) step(c, 1 / 60, k / 60, field);
  assert.equal(c.moduleState[0].trail.length, cap);
});

import { makeJitter, handStrokes, WEIGHT, OVERSHOOT, GAP, DOUBLE_EVERY, BOIL_FPS } from "./strokes.js";

// ---------- strokes ----------

const still = () => ({ dx: 0, dy: 0 });
const lineP = (pts) => ({ points: pts, closed: false, solid: false });

test("open strokes overshoot both ends", () => {
  const [s] = handStrokes([lineP([{ x: 0, y: 0 }, { x: 10, y: 0 }])], still);
  assert.ok(Math.abs(s.points[0].x + OVERSHOOT) < 1e-9);
  assert.ok(Math.abs(s.points.at(-1).x - (10 + OVERSHOOT)) < 1e-9);
});

test("loops stop short of closing by GAP", () => {
  const square = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], closed: true, solid: false };
  const [s] = handStrokes([square], still);
  assert.equal(s.points.length, 5);
  assert.ok(Math.abs(s.points[4].x) < 1e-9);
  assert.ok(Math.abs(s.points[4].y - 10 * GAP) < 1e-9);
});

test("solid shapes stay closed and untouched", () => {
  const tri = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }], closed: true, solid: true };
  const [s] = handStrokes([tri], still);
  assert.equal(s.solid, true);
  assert.deepEqual(s.points, tri.points);
});

test("every stroke has the one weight", () => {
  const prims = Array.from({ length: 12 }, () => lineP([{ x: 0, y: 0 }, { x: 5, y: 5 }]));
  for (const s of handStrokes(prims, still)) assert.equal(s.weight, WEIGHT);
});

test("about one stroke in DOUBLE_EVERY is doubled", () => {
  const prims = Array.from({ length: DOUBLE_EVERY * 2 }, () => lineP([{ x: 0, y: 0 }, { x: 5, y: 5 }]));
  assert.equal(handStrokes(prims, still).length, DOUBLE_EVERY * 2 + 2);
});

test("jitter is stable within a tick and changes across ticks", () => {
  const a = makeJitter(1, 3), b = makeJitter(1, 3), c = makeJitter(1, 4);
  assert.deepEqual(a(2, 5), b(2, 5));
  assert.notDeepEqual(a(2, 5), c(2, 5));
});

test("jitter is bounded by its amount", () => {
  const j = makeJitter(9, 0, 2);
  for (let i = 0; i < 200; i++) {
    const d = j(i, i * 7);
    assert.ok(Math.abs(d.dx) <= 2 && Math.abs(d.dy) <= 2);
  }
});

test("the boil rate is eight frames per second", () => {
  assert.equal(BOIL_FPS, 8);
});
