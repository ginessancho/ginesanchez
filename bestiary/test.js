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
