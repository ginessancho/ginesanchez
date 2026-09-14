import { simplePlans, exchangeEncounters, abilities } from "./encounters.js";
import { createCreature, step, pose } from "./pose.js";
import { handStrokes, makeJitter, BOIL_FPS } from "./strokes.js";
import { createSvgRenderer } from "./render-svg.js";
import { POPULATION, createRoam, advanceRoam, resizeRoam } from "./roaming.js";

import { createVillage, advanceVillage, villageMarks, villageTrailMarks } from "./village.js";

let village;
const svg = document.querySelector("[data-world]");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const seed = 58321;
let plans = simplePlans(POPULATION, seed);
let cooldowns = Array(POPULATION).fill(3);
const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
const scenery = document.createElementNS("http://www.w3.org/2000/svg", "g");
scenery.setAttribute("class", "shared-world");
layer.setAttribute('class', 'village-creatures');
const trails = document.createElementNS("http://www.w3.org/2000/svg", "g");
trails.setAttribute('class', 'village-trails');
svg.append(trails,scenery,layer);
const drawTrails = createSvgRenderer(trails);
const drawScenery=createSvgRenderer(scenery);
const renderers = plans.map(() => {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.append(group);
  const highlight = document.createElementNS("http://www.w3.org/2000/svg", "g");
  highlight.setAttribute("class", "creature-gift");
  layer.append(highlight);
  return {group,draw:createSvgRenderer(group),gift:createSvgRenderer(highlight)};
});
let world;
let creatures = [];
let running = !motion.matches;
let frameId = null;
let last = null;
let accumulator = 0;

function measure() {
  const width = svg.clientWidth, height = svg.clientHeight;
  if (!width || !height) return;
  if (world && world.width === width && world.height === height) return;
  world = world ? resizeRoam(world, width, height) : createRoam(width, height);
  if (!village) village = createVillage(world);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  if (!creatures.length) creatures = world.bodies.map((body, i) => {
    const creature = createCreature(plans[i], { x: body.x, y: body.y, scale: body.radius, seed: seed + i });
    creature.speed = 0; // Translation comes from independent roaming paths.
    return creature;
  });
  draw();
  svg.querySelector("[data-fallback]")?.remove();
}
function draw() {
  if (!world) return;
  scenery.setAttribute('data-time', world.time.toFixed(2));
  scenery.setAttribute('data-places', village.places.length);
  scenery.setAttribute('data-complete', village.places.filter(p => p.progress === 1).length);
  scenery.setAttribute('data-uses', village.places.reduce((n,p) => n + p.uses, 0));
  scenery.setAttribute('data-builders', village.people.filter(p => p.task?.kind === 'build').length);
  drawTrails(handStrokes(villageTrailMarks(village,world),makeJitter(seed,0,.25)));
  drawScenery(handStrokes(villageMarks(village, world),makeJitter(seed,0,.35)));
  creatures.forEach((creature, i) => {
    const body = world.bodies[i];
    creature.x = body.x;
    creature.scale = body.radius;
    const spring = body.skills?.spring ? Math.pow(Math.max(0, Math.sin(world.time * 2 + body.phase)), 2) * 9 : 0;
    creature.y = body.y + creature.scale * .35 - spring;
    creature.heading = body.heading;
    const grown = plans[i].modules.map(m => m.learnedAt === undefined ? m : {...m,
      size:m.size*Math.min(1, Math.max(.02,(world.time-m.learnedAt)/1.8))});
    creature.plan = {...plans[i],modules:grown};
    const jitter = makeJitter(seed+i, Math.floor(world.time * BOIL_FPS), .65);
    renderers[i].draw(handStrokes(pose(creature, world.time + body.phase),jitter));
    renderers[i].group.setAttribute('data-parts', grown.length);
    const fresh=grown.findIndex(m=>m.learnedAt!==undefined && world.time-m.learnedAt<2.5);
    if(fresh>=0) {
      const partial={...creature,plan:{...creature.plan,modules:[grown[fresh]]},moduleState:[creature.moduleState[fresh]]};
      renderers[i].gift(handStrokes(pose(partial,world.time+body.phase).slice(1),jitter));
    } else renderers[i].gift([]);
  });
}
function advance(dt) {
  if (!world) return;
  const previous=world;
  const society=advanceVillage(village,previous,advanceRoam(world,dt),dt);
  village=society.state;
  world=society.world;
  const exchange = exchangeEncounters(plans, world.bodies, cooldowns, world.time);
  cooldowns = exchange.cooldowns;
  exchange.plans.forEach((plan,i) => {
    if(plan===plans[i]) return;
    const previous=creatures[i];
    const replacement=createCreature(plan,{x:previous.x,y:previous.y,scale:previous.scale,seed:seed+i});
    replacement.speed=0;
    replacement.nodes=previous.nodes;
    replacement.moduleState=plan.modules.map((m,k)=>{
      const old=plans[i].modules.indexOf(m);
      return old>=0 ? previous.moduleState[old] : replacement.moduleState[k];
    });
    creatures[i]=replacement;
    world.bodies[i]={...world.bodies[i],skills:abilities(plan)};
  });
  plans=exchange.plans;
  creatures.forEach((creature, i) => {
    const body = world.bodies[i];
    // Keep the original anatomy and each creature's own animation phase.
    step(creature, dt, world.time + body.phase, { x: 0, y: 0, w: world.width, h: world.height });
  });
}
function frame(now) {
  frameId = null;
  if (!running || document.hidden) { last = null; return; }
  accumulator += last === null ? 0 : Math.min((now - last) / 1000, .05);
  last = now;
  while (accumulator >= 1 / 60) { advance(1 / 60); accumulator -= 1 / 60; }
  draw();
  frameId = requestAnimationFrame(frame);
}
function schedule() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  last = null;
  if (running && !document.hidden) frameId = requestAnimationFrame(frame);
}
document.querySelector('.village-controls').hidden = false;
const pauseButton = document.querySelector('[data-village-pause]');
function updateControls() {
  pauseButton.textContent = running ? 'Pause' : 'Play';
  pauseButton.setAttribute('aria-label', running ? 'Pause the village' : 'Play the village');
}
function toggle() { running = !running; updateControls(); schedule(); }
pauseButton.addEventListener('click', toggle);
document.querySelector('[data-village-restart]').addEventListener('click', () => {
  world = undefined;
  village = undefined;
  plans = simplePlans(POPULATION, seed);
  cooldowns = Array(POPULATION).fill(3);
  creatures = [];
  accumulator = 0;
  measure();
  schedule();
});
addEventListener('keydown', event => {
  if (event.key === 'Escape') toggle();
});
motion.addEventListener('change', () => { running = !motion.matches; updateControls(); schedule(); });
document.addEventListener('visibilitychange', schedule);
new ResizeObserver(measure).observe(svg);
measure();
if (motion.matches) {
  // A settled still scene, with motion available only by explicitly pressing Play.
  for (let i=0; i<900; i++) advance(.1);
  draw();
}
updateControls();
schedule();
