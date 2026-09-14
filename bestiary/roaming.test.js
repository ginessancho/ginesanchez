import test from "node:test";
import assert from "node:assert/strict";
import { createRoam, advanceRoam, resizeRoam } from "./roaming.js";

test("creatures roam in both modes and keep their individual paces and phases", () => {
  for (const makingRoom of [false, true]) {
    const initial = { ...createRoam(700, 380), makingRoom };
    let world = initial;
    for (let i = 0; i < 600; i++) world = advanceRoam(world, 1 / 60);
    assert.ok(world.bodies.every((b, i) => Math.hypot(b.x - initial.bodies[i].x, b.y - initial.bodies[i].y) > 1));
    assert.deepEqual(world.bodies.map(b => [b.id,b.pace,b.phase]), initial.bodies.map(b => [b.id,b.pace,b.phase]));
    assert.ok(new Set(world.bodies.map(b => Math.round(b.heading * 10))).size > 5);
  }
});
test("making room separates an approaching pair without changing their identities", () => {
  const initial = createRoam(700, 380);
  initial.bodies = initial.bodies.slice(0,2).map((b,i) => ({...b, x:320+i*60,y:190, heading:i*Math.PI, pace:20}));
  const independent = advanceRoam(initial, .1);
  const considerate = advanceRoam({...initial, makingRoom:true}, .1);
  const gap = w => Math.hypot(w.bodies[0].x-w.bodies[1].x, w.bodies[0].y-w.bodies[1].y);
  assert.ok(gap(considerate) > gap(independent));
  assert.deepEqual(considerate.bodies.map(b=>b.pace),initial.bodies.map(b=>b.pace));
});
test("the switch gives no artificial reward or movement boost to a creature on its own", () => {
  const world = createRoam(700,380); world.bodies=world.bodies.slice(0,1);
  assert.deepEqual(advanceRoam(world,.1).bodies,advanceRoam({...world,makingRoom:true},.1).bodies);
});
test("long runs and viewport changes keep bodies finite and within their drawing margins", () => {
  let world = {...createRoam(700,380),makingRoom:true};
  for (let i=0;i<3600;i++) {
    if(i===1800) world=resizeRoam(world,280,380);
    world=advanceRoam(world,1/60);
    for(const b of world.bodies) {
      assert.ok(Number.isFinite(b.x+b.y+b.heading));
      assert.ok(b.x>=b.radius*1.65 && b.x<=world.width-b.radius*1.65);
      assert.ok(b.y>=b.radius*1.65 && b.y<=world.height-b.radius*1.65);
      assert.ok(b.space>=0 && b.space<=1);
    }
  }
});
