import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, discover, exchange, countWorld } from "./learning.js";
const run = (world, count = 12) => {
  for (let i = 0; i < count; i++) world = exchange(world);
  return world;
};
test("a discovery cannot cross a missing connection", () => {
  const world = run(discover(createWorld()));
  assert.deepEqual(countWorld(world), { heard: 5, acted: 5, outdated: 0 });
  assert.ok(world.nodes.slice(5).every((n) => n.heard === 0));
});
test("news travels only one hop per tick and action follows receipt", () => {
  const initial = discover(createWorld());
  const next = exchange(initial);
  assert.deepEqual(countWorld(next), { heard: 3, acted: 1, outdated: 0 });
  assert.equal(next.nodes[2].heard, 0);
  assert.equal(next.nodes[1].acted, 0);
  assert.equal(exchange(next).nodes[1].acted, 1);
  assert.equal(initial.nodes[1].heard, 0, "prior snapshots stay unchanged");
});
test("one bridge carries a discovery to both groups", () => {
  const isolated = run(discover(createWorld()));
  const connected = run({ ...isolated, connected: true });
  assert.deepEqual(countWorld(connected), { heard: 10, acted: 10, outdated: 0 });
});
test("a changed world leaves old decisions in place until news reaches them", () => {
  const old = run({ ...discover(createWorld()), connected: true });
  const changed = discover(old);
  assert.equal(changed.source, 7);
  assert.deepEqual(countWorld(changed), { heard: 1, acted: 0, outdated: 10 });
  assert.deepEqual(countWorld(run(changed)), { heard: 10, acted: 10, outdated: 0 });
});
test("disconnecting preserves knowledge but blocks subsequent discoveries", () => {
  const old = run({ ...discover(createWorld()), connected: true });
  const changed = discover({ ...old, connected: false });
  assert.deepEqual(countWorld(run(changed)), { heard: 5, acted: 5, outdated: 5 });
});
