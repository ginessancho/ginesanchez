import test from "node:test";
import assert from "node:assert/strict";
import {
  ERAS, createCivilization, advanceCivilization, continueCivilization, placeWordSource,
} from "./civilization.js";

function toReady(input) {
  let state = input, carried = false;
  for (let i = 0; i < 1000 && !state.ready; i++) {
    state = advanceCivilization(state, 0.05);
    carried ||= state.word === "carried";
    assert.ok(state.people.every((p) => Number.isFinite(p.x + p.y)));
  }
  assert.ok(state.ready, `${ERAS[input.era].name} should become ready through work`);
  assert.ok(carried, "the word is visibly carried before it is used");
  assert.equal(state.word, "installed");
  assert.ok(state.contributors.length >= 2, "work is shared");
  return state;
}

test("beasts use a different word in each era and can reach the Type III scene", () => {
  let state = createCivilization();
  for (let era = 0; era < ERAS.length; era++) {
    assert.equal(state.era, era);
    state = toReady(state);
    assert.equal(state.progress, ERAS[era].need);
    if (era === 0) assert.deepEqual(state.wordUsedBy.sort(), [1, 2]);
    if (era === 1) assert.ok(state.knowledge.slice(0, 3).every(Boolean));
    if (era === 2 || era === 3) assert.ok(state.energy >= 4 && state.stableFor >= 6);
    if (era === 4) assert.ok(state.knowledge.every(Boolean));
    state = continueCivilization(state);
  }
  assert.equal(state.era, 4);
  assert.ok(state.ready);
});

test("eras cannot be skipped and energy does not appear from time alone", () => {
  const initial = createCivilization();
  assert.equal(continueCivilization(initial), initial);
  assert.equal(advanceCivilization(initial, 0), initial);
  const stalled = { ...initial, era: 2, phase: "verify", progress: 0, energy: 4 };
  let state = stalled;
  for (let i = 0; i < 300; i++) state = advanceCivilization(state, 0.05);
  assert.equal(state.energy, 0);
  assert.equal(state.stableFor, 0);
  assert.equal(state.ready, false);
});

test("word position is data, and stepping does not mutate the previous state", () => {
  const initial = placeWordSource(createCivilization(), { x: 251, y: 43 });
  const before = JSON.stringify(initial);
  const next = advanceCivilization(initial, 0.05);
  assert.equal(JSON.stringify(initial), before);
  assert.deepEqual(next.wordSource, { x: 251, y: 43 });
  assert.equal(placeWordSource(initial, { x: NaN, y: 1 }), initial);
});
