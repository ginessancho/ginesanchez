import { makePlan, SPECIES_NAMES } from './grammar.js';

export function simplePlans(count, seed = 58321) {
  return Array.from({length:count}, (_,i) => {
    const plan = makePlan(seed+i*173, SPECIES_NAMES[i%SPECIES_NAMES.length]);
    return {...plan, knowledge:[], modules:[
      {...plan.modules[0],size:plan.modules[0].size*.78},
      {...plan.modules.find(m=>m.role==='body'),size:plan.modules.find(m=>m.role==='body').size*.65},
    ]};
  });
}

// Keep a slim silhouette: two original parts and one visible acquired part.
// Earlier learning survives in knowledge even when its visible part is replaced.
export function receive(plan, donor, time) {
  const source = donor.modules[1];
  if (plan.modules.some(m=>m.kind===source.kind) || (plan.knowledge||[]).includes(source.kind)) return plan;
  const gift = {...source, params:{...source.params}, role:'body', at:.22,
    size:Math.min(source.size,.24), phase:source.phase + plan.heading,
    learnedAt:time, from:donor.seed};
  return {...plan, knowledge:[...(plan.knowledge||[]),source.kind],
    modules:[...plan.modules.slice(0,2), gift]};
}

export function exchangeEncounters(plans, bodies, cooldowns, time) {
  const next = [...plans], clocks = [...cooldowns], events=[];
  const used = new Set();
  for(let a=0;a<bodies.length;a++) {
    if(used.has(a) || time < clocks[a]) continue;
    for(let b=a+1;b<bodies.length;b++) {
      if(used.has(b) || time < clocks[b]) continue;
      const p=bodies[a],q=bodies[b];
      if(Math.hypot(p.x-q.x,p.y-q.y) > (p.radius+q.radius)*.72) continue;
      const first=receive(plans[a],plans[b],time),second=receive(plans[b],plans[a],time);
      if(first===plans[a] && second===plans[b]) continue;
      next[a]=first;next[b]=second;
      clocks[a]=clocks[b]=time+10;
      used.add(a);used.add(b);events.push([a,b]);break;
    }
  }
  return {plans:next,cooldowns:clocks,events};
}

export function abilities(plan) {
  const kinds=plan.knowledge || plan.modules.slice(2).map(m=>m.kind);
  return {spring:kinds.some(k=>['spiral','beads','burst'].includes(k)),
    glide:kinds.some(k=>['pinwheel','drip'].includes(k)),
    stride:kinds.some(k=>['boxes','comb','lattice','limb'].includes(k))};
}
