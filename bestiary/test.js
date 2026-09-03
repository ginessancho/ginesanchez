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
