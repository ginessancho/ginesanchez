import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoam,advanceRoam,resizeRoam} from './roaming.js';
import {createVillage,advanceVillage,placePoint,placeScale,villageMarks,MAX_PLACES} from './village.js';
function run(world,state,seconds,dt=.1) {
  for(let i=0;i<Math.round(seconds/dt);i++)({world,state}=advanceVillage(state,world,advanceRoam(world,dt),dt));
  return {world,state};
}
for(const [width,height] of [[1440,900],[700,900],[390,844],[320,640]]) {
 test(`a cooperative settlement grows, is used and maintained at ${width}px`,()=>{
  let world=createRoam(width,height),state=createVillage(world);
  ({world,state}=run(world,state,60));
  assert.ok(state.places.slice(0,3).every(p=>p.progress===1));
  assert.ok(state.places.some(p=>p.uses>0));
  assert.ok(state.places.slice(0,3).every(p=>p.contributors.length>=2&&p.work.every(w=>w===3)));
  ({world,state}=run(world,state,540));
  assert.equal(state.places.length,MAX_PLACES);
  assert.ok(state.places.every(p=>p.progress===1&&p.uses>5&&p.repairs>0));
  assert.ok(state.paths.some(p=>p.uses>3));
  assert.ok(state.people.some(p=>p.friends.length>0&&p.known.length>1));
  assert.ok(state.people.some(p=>p.practice.filter(n=>n>0).length>1));
  assert.ok(state.people.some(p=>p.task===null),'some creatures still wander');
  assert.equal(world.bodies.length,24);
  assert.ok(world.bodies.every(b=>Number.isFinite(b.x+b.y)&&b.x>=0&&b.x<=width&&b.y>=0&&b.y<=height));
  assert.ok(villageMarks(state,world).every(m=>m.points.every(p=>Number.isFinite(p.x+p.y))));
 });
}
test('time alone cannot deliver materials or build structures',()=>{
 let world=createRoam(700,900);
 world.bodies=world.bodies.map(b=>({...b,pace:0,x:350,y:100}));
 let state=createVillage(world);
 state.places.forEach(p=>p.founded=true);
 state.people.forEach(p=>p.known=[0,1,2]);
 ({world,state}=run(world,state,180));
 assert.ok(state.places.every(p=>p.progress===0&&p.work.every(w=>w===0)&&p.uses===0));
});
test('a single creature cannot complete shared construction',()=>{
 let world=createRoam(700,900);world.bodies=world.bodies.slice(0,1);
 let state=createVillage(world);state.places.forEach(p=>p.founded=true);state.people[0].known=[0,1,2];
 ({world,state}=run(world,state,180));
 assert.ok(state.places.every(p=>p.progress<1&&p.uses===0));
});
test('an unattended place weathers without inventing visits or repairs',()=>{
 let world=createRoam(700,900);world.bodies=[];
 let state=createVillage(world);
 state.places[1]={...state.places[1],founded:true,progress:1,work:[3,3,3],condition:1};
 ({world,state}=run(world,state,300));
 assert.ok(state.places[1].condition<.45);
 assert.equal(state.places[1].uses,0);assert.equal(state.places[1].repairs,0);
 assert.equal(state.places.length,3);
});
test('a bridge visit requires reaching both ends',()=>{
 let world=createRoam(700,900);world.bodies=world.bodies.slice(0,1);
 let state=createVillage(world),p=state.places[0];
 p.founded=true;p.progress=1;p.work=[3,3,3];
 const c=placePoint(p,world);
 world.bodies[0]={...world.bodies[0],x:c.x-30*placeScale(world),y:c.y};
 state.people[0].task={kind:'visit',place:0,phase:'approach',elapsed:0};
 ({world,state}=run(world,state,.1));
 assert.equal(state.people[0].task.phase,'cross');assert.equal(state.places[0].uses,0);
 ({world,state}=run(world,state,10));
 assert.equal(state.places[0].uses,1);assert.ok(world.bodies[0].x>c.x);
});
test('resizing an active village preserves work and remains bounded',()=>{
 let world=createRoam(1440,900),state=createVillage(world);
 ({world,state}=run(world,state,40));
 const work=state.places.map(p=>[...p.work]);
 world=resizeRoam(world,320,640);
 ({world,state}=run(world,state,100));
 assert.ok(state.places.slice(0,3).every((p,i)=>p.work.every((n,j)=>n>=work[i][j])));
 assert.ok(world.bodies.every(b=>b.x>=0&&b.x<=320&&b.y>=0&&b.y<=640));
});
test('same starting state produces the same outcome without mutating input',()=>{
 const world=createRoam(700,900),state=createVillage(world),before=JSON.stringify({world,state});
 const a=run(world,state,70),b=run(world,state,70);
 assert.deepEqual(a,b);assert.equal(JSON.stringify({world,state}),before);
});
