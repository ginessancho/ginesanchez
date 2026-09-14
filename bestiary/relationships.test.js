import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelationships,advanceRelationships} from './relationships.js';
import {createRoam,advanceRoam,resizeRoam} from './roaming.js';
test('a remembered pair reunites, both build, and a third actually crosses',()=>{
 let world=createRoam(700,900),state=createRelationships();
 const seen=new Set();let built=false;
 for(let i=0;i<18000;i++){
  const next=advanceRelationships(state,world,advanceRoam(world,1/60),1/60);
  world=next.world;state=next.state;
  if(state.bond)seen.add(state.bond.phase);
  if(state.bridge?.progress===1){built=true;assert.ok(state.bridge.work.every(w=>w===4));}
  if(state.bridge?.uses===1)break;
 }
 assert.ok(seen.has('apart') && seen.has('return') && seen.has('build'));
 assert.ok(built);assert.equal(state.bridge.uses,1);assert.equal(state.bond.meetings,2);
 assert.ok(![state.bond.a,state.bond.b].includes(state.bridge.visitor));
 assert.equal(world.bodies.length,24);
});
test('an unfinished crossing cannot become complete without both contributions',()=>{
 let world=createRoam(700,900);world.time=20;
 const state={bond:{a:0,b:1,u:.5,v:.5,phase:'build',meetings:2},bridge:{u:.5,v:.5,work:[4,0],progress:0,visitor:null,uses:0}};
 world.bodies[1]={...world.bodies[1],x:100,y:100,pace:0};
 const next=advanceRelationships(state,world,advanceRoam(world,.1),.1);
 assert.equal(next.state.bridge.progress,0);
});
test('relationship state survives mobile resizing with finite positions',()=>{
 let world=createRoam(700,900),state=createRelationships();
 for(let i=0;i<6000;i++){
  if(i===900)world=resizeRoam(world,280,600);
  const next=advanceRelationships(state,world,advanceRoam(world,1/60),1/60);
  world=next.world;state=next.state;
  assert.ok(world.bodies.every(b=>Number.isFinite(b.x+b.y)&&b.x>=0&&b.x<=world.width&&b.y>=0&&b.y<=world.height));
 }
 assert.ok(state.bridge);
});
