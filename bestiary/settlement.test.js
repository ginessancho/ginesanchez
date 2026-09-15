import test from "node:test";
import assert from "node:assert/strict";
import { createRoam, advanceRoam, resizeRoam } from "./roaming.js";
import {
  createSettlement, advanceSettlement, resizeSettlement, settlementMarks, settlementTrailMarks,
  KINDS, TIRED_FOR,
} from "./settlement.js";

function run(world, state, seconds, dt = 0.1, each) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    ({ world, state } = advanceSettlement(state, world, advanceRoam(world, dt), dt));
    if (each) each(world, state);
  }
  return { world, state };
}
const bank = (y, state) => (y < state.creekY ? 0 : 1);
const finite = (marks) => marks.every((m) => m.points.every((p) => Number.isFinite(p.x + p.y)));

for (const [width, height] of [[1440, 900], [700, 900], [390, 844], [320, 640]]) {
  test(`a settlement grows from needs, is built together and changes what is possible at ${width}px`, () => {
    let world = createRoam(width, height), state = createSettlement(world, 58321);
    let crossedEarly = 0;
    ({ world, state } = run(world, state, 600, 0.1, (w, s) => {
      const crossing = s.sites.find((x) => x.kind === "crossing");
      if (!crossing?.done && s.stats.deckCrossings > 0) crossedEarly++;
    }));
    const kinds = (kind) => state.sites.filter((s) => s.kind === kind && s.done);
    assert.equal(kinds("crossing").length, 1, "the crossing gets built");
    assert.equal(kinds("store").length, 1, "the store gets built");
    assert.equal(kinds("lookout").length, 1, "the lookout gets built");
    assert.ok(kinds("garden").length >= 1, "at least one garden gets built");
    assert.ok(state.sites.every((s) => s.by !== undefined && s.contributors.length >= 2), "every site was proposed by someone and built by at least two");
    assert.equal(crossedEarly, 0, "nobody walks across the water before the crossing exists");
    assert.ok(state.stats.deckCrossings > 0, "the crossing is used once it exists");
    assert.ok(state.stats.deposits > 0 && state.stats.withdrawals > 0, "the store is filled and drawn on");
    assert.ok(kinds("lookout")[0].uses > 0, "the lookout is visited");
    assert.ok(state.stats.stale > 0, "news goes stale sometimes");
    assert.ok(state.stats.exchanges > 0, "news travels by meeting");
    assert.ok(state.stats.births < world.bodies.length, "turnover never becomes a collapse");
    if (width >= 700) assert.ok(state.stats.births > 0, "on a page with room to starve, some creatures do");
    assert.ok(state.paths.length > 3 && state.paths.some((p) => p.uses > 3), "well-used routes exist");
    assert.ok(state.people.some((p) => p.task === null), "some creatures are still just wandering");
    assert.equal(world.bodies.length, 24);
    assert.ok(world.bodies.every((b) => Number.isFinite(b.x + b.y) && b.x >= 0 && b.x <= width && b.y >= 0 && b.y <= height));
    assert.ok(finite(settlementMarks(state, world)) && finite(settlementTrailMarks(state, world)));
  });
}

test("time alone feeds nobody and builds nothing", () => {
  let world = createRoam(700, 900);
  world.bodies = world.bodies.map((b) => ({ ...b, pace: 0, x: 350, y: 100 }));
  let state = createSettlement(world, 1);
  ({ world, state } = run(world, state, 200));
  assert.equal(state.stats.eaten, 0);
  assert.ok(state.sites.every((s) => !s.done && s.delivered === 0));
});

test("one creature cannot finish a shared site alone", () => {
  let world = createRoam(1440, 900);
  world.bodies = world.bodies.slice(0, 1).map((b) => ({ ...b, x: 100, y: 500, pace: 60 }));
  let state = createSettlement(world, 1);
  state.people[0].energy = 1;
  ({ world, state } = run(world, state, 1));
  // The sole creature eats at will and knows where material is.
  state.patches.forEach((p) => { if (p.kind === "food") p.cap = 40; });
  state.people[0].memory = Object.fromEntries(state.patches.map((p) => [p.id, { stock: p.cap, at: 1 }]));
  state.sites.push({ id: 0, kind: "store", slot: 0, x: state.slots[0].x, y: state.slots[0].y, need: 4, delivered: 0, contributors: [], done: false, doneAt: null, condition: 1, stock: 0, board: {}, uses: 0, proposedAt: 1, by: 0 });
  state.people[0].known.push(0);
  ({ world, state } = run(world, state, 300, 0.1, (w, s) => { s.patches.forEach((p) => { p.stock = p.cap; }); s.people[0].energy = Math.max(s.people[0].energy, 0.9); }));
  assert.ok(state.sites[0].delivered >= 1, "they do bring material");
  assert.equal(state.sites[0].done, false, "but the last unit needs a second pair of hands");
});

test("gliding lets a creature cross the water where the others cannot", () => {
  let world = createRoam(1440, 900);
  let state = createSettlement(world, 1);
  world.bodies = world.bodies.map((b, i) => ({ ...b, y: i === 0 ? state.creekY - 50 : 200, heading: Math.PI / 2, skills: i === 0 ? { glide: true } : undefined }));
  let gliderCrossedAt = null, crossingDoneAt = null, footCrossingsBefore = null;
  ({ world, state } = run(world, state, 120, 0.1, (w, s) => {
    if (gliderCrossedAt === null && bank(w.bodies[0].y, s) === 1) gliderCrossedAt = s.time;
    if (crossingDoneAt === null && s.sites.some((x) => x.kind === "crossing" && x.done)) { crossingDoneAt = s.time; footCrossingsBefore = s.stats.deckCrossings; }
  }));
  assert.ok(gliderCrossedAt !== null, "the glider reaches the far bank");
  assert.ok(crossingDoneAt === null || gliderCrossedAt < crossingDoneAt, "before anyone could walk across");
  assert.equal(footCrossingsBefore ?? state.stats.deckCrossings, 0, "nobody else crossed on foot until the crossing stood");
});

test("what one has seen, another learns by meeting, and the newer sighting wins", () => {
  let world = createRoam(1440, 900);
  world.bodies = world.bodies.map((b) => ({ ...b, pace: 0, x: 720, y: 300 }));
  let state = createSettlement(world, 1);
  state.people[0].memory = { 0: { stock: 5, at: 10 } };
  state.people[1].memory = { 0: { stock: 1, at: 20 } };
  ({ world, state } = run(world, state, 1));
  assert.deepEqual(state.people[0].memory[0], { stock: 1, at: 20 });
  assert.equal(state.people[5].memory[0].stock, 1, "the news reaches everyone who was there");
});

test("an exhausted creature is replaced by a newcomer who remembers nothing", () => {
  let world = createRoam(1440, 900);
  world.bodies = world.bodies.map((b) => ({ ...b, pace: 0, x: 720, y: 300 }));
  let state = createSettlement(world, 1);
  state.people[3].energy = 0.001;
  state.people[3].memory = { 0: { stock: 5, at: 0 } };
  state.people[3].known = [0];
  state.people.forEach((p, i) => { if (i !== 3) p.energy = 1; });
  ({ world, state } = run(world, state, 1));
  assert.ok(state.people[3].tired > 0, "lies down");
  ({ world, state } = run(world, state, TIRED_FOR + 1, 0.1, (w, s) => s.people.forEach((p, i) => { if (i !== 3) p.energy = 1; })));
  assert.equal(state.people[3].generation, 2);
  assert.equal(state.stats.births, 1);
  assert.ok(!state.people[3].memory[0] || state.people[3].memory[0].at > 0, "the old memory is gone");
  assert.equal(state.people[3].known.length, 0);
});

test("resizing keeps sites in their slots, work done and positions bounded", () => {
  let world = createRoam(1440, 900), state = createSettlement(world, 58321);
  ({ world, state } = run(world, state, 120));
  const before = state.sites.map((s) => [s.kind, s.delivered, s.done]);
  assert.ok(before.length > 0);
  world = resizeRoam(world, 320, 640);
  state = resizeSettlement(state, world);
  assert.deepEqual(state.sites.map((s) => [s.kind, s.delivered, s.done]), before);
  assert.ok(state.sites.every((s) => s.x >= 0 && s.x <= 320 && s.y >= 0 && s.y <= 640));
  ({ world, state } = run(world, state, 60));
  assert.ok(world.bodies.every((b) => b.x >= 0 && b.x <= 320 && b.y >= 0 && b.y <= 640));
  assert.ok(finite(settlementMarks(state, world)) && finite(settlementTrailMarks(state, world)));
});

test("the same seed produces the same settlement without mutating its input", () => {
  const world = createRoam(700, 900), state = createSettlement(world, 7), before = JSON.stringify({ world, state });
  const a = run(world, state, 90), b = run(world, state, 90);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify({ world, state }), before);
});

test("structure rules are what the drawing promises", () => {
  assert.equal(KINDS.crossing.max, 1);
  assert.ok(KINDS.garden.max >= 1 && KINDS.store.cap > KINDS.garden.cap);
});
