import test from 'node:test';
import assert from 'node:assert/strict';
import {simplePlans,receive,exchangeEncounters,abilities} from './encounters.js';
import {createRoam,advanceRoam} from './roaming.js';
test('encounters preserve original anatomy and population, with a strict three-part cap',()=>{
 let plans=simplePlans(24);const originals=plans;
 for(let t=0;t<100;t++) plans=plans.map((p,i)=>receive(p,originals[(i+t+1)%24],t));
 assert.equal(plans.length,24);
 for(let i=0;i<24;i++) {
  assert.ok(plans[i].modules.length<=3);
  assert.deepEqual(plans[i].modules.slice(0,2),originals[i].modules);
  assert.equal(plans[i].species,originals[i].species);
  assert.deepEqual(plans[i].spine,originals[i].spine);
 }
 assert.ok(plans.some(p=>p.modules.length===3));
 assert.ok(plans.some(p=>p.knowledge.length>1));
});
test('only nearby encounters exchange parts and each creature has a cooldown',()=>{
 const plans=simplePlans(2);const bodies=[{x:100,y:100,radius:38},{x:110,y:100,radius:38}];
 const far=exchangeEncounters(plans,[bodies[0],{...bodies[1],x:500}],[0,0],3);
 assert.equal(far.events.length,0);
 const near=exchangeEncounters(plans,bodies,[0,0],3);
 assert.equal(near.events.length,1);
 assert.ok(near.plans.some((p,i)=>p.modules.length>plans[i].modules.length));
 assert.equal(exchangeEncounters(near.plans,bodies,near.cooldowns,4).events.length,0);
});
test('a borrowed part unlocks a movement while an unchanged creature has no acquired skills',()=>{
 const plans=simplePlans(24);
 assert.deepEqual(abilities(plans[0]),{spring:false,glide:false,stride:false});
 const donor=plans.find(p=>['boxes','comb','lattice','drip','pinwheel'].includes(p.modules[1].kind) && p.modules[1].kind!==plans[0].modules[1].kind);
 const learned=receive(plans[0],donor,3);const skills=abilities(learned);
 assert.ok(skills.stride||skills.glide);
 const world=createRoam(700,700);world.bodies=world.bodies.slice(0,1);
 const moved=advanceRoam({...world,bodies:[{...world.bodies[0],skills}]},.1);
 assert.notDeepEqual(moved.bodies[0],advanceRoam(world,.1).bodies[0]);
});
