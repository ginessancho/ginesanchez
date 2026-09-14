import { simplePlans, exchangeEncounters, abilities } from "./encounters.js";
import { createCreature, step, pose } from "./pose.js";
import { handStrokes, makeJitter, BOIL_FPS } from "./strokes.js";
import { createSvgRenderer } from "./render-svg.js";
import { POPULATION, createRoam, advanceRoam, resizeRoam } from "./roaming.js";
import { createSettlement, advanceSettlement, resizeSettlement, settlementMarks, settlementTrailMarks } from "./settlement.js";

const svg = document.querySelector("[data-world]");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const seed = 58321;
const SCENERY_FPS = 5;
let plans = simplePlans(POPULATION, seed);
let generations = Array(POPULATION).fill(1);
let cooldowns = Array(POPULATION).fill(3);
const trails = document.createElementNS("http://www.w3.org/2000/svg", "g");
trails.setAttribute("class", "village-trails");
const scenery = document.createElementNS("http://www.w3.org/2000/svg", "g");
scenery.setAttribute("class", "shared-world");
const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
layer.setAttribute("class", "village-creatures");
svg.append(trails, scenery, layer);
const drawTrails = createSvgRenderer(trails);
const drawScenery = createSvgRenderer(scenery);
const renderers = plans.map(() => {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.append(group);
  const highlight = document.createElementNS("http://www.w3.org/2000/svg", "g");
  highlight.setAttribute("class", "creature-gift");
  layer.append(highlight);
  return { group, draw: createSvgRenderer(group), gift: createSvgRenderer(highlight) };
});
let world;
let settlement;
let creatures = [];
let running = !motion.matches;
let frameId = null;
let last = null;
let accumulator = 0;
let sceneryDrawnAt = -1;

function newCreature(i, body) {
  const creature = createCreature(plans[i], { x: body.x, y: body.y, scale: body.radius, seed: seed + i });
  creature.speed = 0; // Translation comes from roaming and from errands.
  return creature;
}
function measure() {
  const width = svg.clientWidth, height = svg.clientHeight;
  if (!width || !height) return;
  if (world && world.width === width && world.height === height) return;
  world = world ? resizeRoam(world, width, height) : createRoam(width, height);
  settlement = settlement ? resizeSettlement(settlement, world) : createSettlement(world, seed);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  if (!creatures.length) creatures = world.bodies.map((body, i) => newCreature(i, body));
  sceneryDrawnAt = -1;
  draw();
  svg.querySelector("[data-fallback]")?.remove();
}
function draw() {
  if (!world) return;
  if (sceneryDrawnAt < 0 || world.time - sceneryDrawnAt >= 1 / SCENERY_FPS) {
    sceneryDrawnAt = world.time;
    scenery.setAttribute("data-sites", settlement.sites.length);
    scenery.setAttribute("data-built", settlement.sites.filter((s) => s.done).length);
    scenery.setAttribute("data-births", settlement.stats.births);
    drawTrails(handStrokes(settlementTrailMarks(settlement, world), makeJitter(seed, 0, 0.25)));
    drawScenery(handStrokes(settlementMarks(settlement, world), makeJitter(seed, Math.floor(world.time * 2), 0.35)));
  }
  creatures.forEach((creature, i) => {
    const body = world.bodies[i], person = settlement.people[i];
    creature.x = body.x;
    creature.scale = body.radius;
    const spring = body.skills?.spring ? Math.pow(Math.max(0, Math.sin(world.time * 2 + body.phase)), 2) * 9 : 0;
    creature.y = body.y + creature.scale * 0.35 - spring;
    creature.heading = body.heading;
    const grown = plans[i].modules.map((m) => (m.learnedAt === undefined ? m : { ...m, size: m.size * Math.min(1, Math.max(0.02, (world.time - m.learnedAt) / 1.8)) }));
    creature.plan = { ...plans[i], modules: grown };
    const jitter = makeJitter(seed + i, Math.floor(world.time * BOIL_FPS), 0.65);
    renderers[i].draw(handStrokes(pose(creature, world.time + body.phase), jitter));
    renderers[i].group.setAttribute("opacity", person.tired ? "0.35" : "1");
    const fresh = grown.findIndex((m) => m.learnedAt !== undefined && world.time - m.learnedAt < 2.5);
    if (fresh >= 0) {
      const partial = { ...creature, plan: { ...creature.plan, modules: [grown[fresh]] }, moduleState: [creature.moduleState[fresh]] };
      renderers[i].gift(handStrokes(pose(partial, world.time + body.phase).slice(1), jitter));
    } else renderers[i].gift([]);
  });
}
function replace(i, plan) {
  const previous = creatures[i];
  const replacement = createCreature(plan, { x: previous.x, y: previous.y, scale: previous.scale, seed: seed + i });
  replacement.speed = 0;
  replacement.nodes = previous.nodes;
  replacement.moduleState = plan.modules.map((m, k) => {
    const old = plans[i].modules.indexOf(m);
    return old >= 0 ? previous.moduleState[old] : replacement.moduleState[k];
  });
  creatures[i] = replacement;
  world.bodies[i] = { ...world.bodies[i], skills: abilities(plan) };
}
function advance(dt) {
  if (!world) return;
  const previous = world;
  const next = advanceSettlement(settlement, previous, advanceRoam(world, dt), dt);
  settlement = next.state;
  world = next.world;
  // A newcomer is a different creature: new body plan, nothing learned yet.
  settlement.people.forEach((person, i) => {
    if (person.generation === generations[i]) return;
    generations[i] = person.generation;
    plans[i] = simplePlans(POPULATION, seed + person.generation * 9973)[i];
    cooldowns[i] = world.time + 3;
    replace(i, plans[i]);
    creatures[i].nodes = creatures[i].plan.spine.map((p) => ({ x: p.x, y: p.y, px: p.x, py: p.y }));
  });
  const exchange = exchangeEncounters(plans, world.bodies, cooldowns, world.time);
  cooldowns = exchange.cooldowns;
  exchange.plans.forEach((plan, i) => {
    if (plan !== plans[i]) replace(i, plan);
  });
  plans = exchange.plans;
  creatures.forEach((creature, i) => {
    const body = world.bodies[i];
    // Keep the original anatomy and each creature's own animation phase.
    step(creature, dt, world.time + body.phase, { x: 0, y: 0, w: world.width, h: world.height });
  });
}
function frame(now) {
  frameId = null;
  if (!running || document.hidden) { last = null; return; }
  accumulator += last === null ? 0 : Math.min((now - last) / 1000, 0.05);
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
document.querySelector(".village-controls").hidden = false;
const pauseButton = document.querySelector("[data-village-pause]");
function updateControls() {
  pauseButton.textContent = running ? "Pause" : "Play";
  pauseButton.setAttribute("aria-label", running ? "Pause the settlement" : "Play the settlement");
}
function toggle() { running = !running; updateControls(); schedule(); }
pauseButton.addEventListener("click", toggle);
document.querySelector("[data-village-restart]").addEventListener("click", () => {
  world = undefined;
  settlement = undefined;
  plans = simplePlans(POPULATION, seed);
  generations = Array(POPULATION).fill(1);
  cooldowns = Array(POPULATION).fill(3);
  creatures = [];
  accumulator = 0;
  measure();
  schedule();
});
addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggle();
});
motion.addEventListener("change", () => { running = !motion.matches; updateControls(); schedule(); });
document.addEventListener("visibilitychange", schedule);
new ResizeObserver(measure).observe(svg);
measure();
if (motion.matches) {
  // A settled still scene, with motion available only by explicitly pressing Play.
  for (let i = 0; i < 900; i++) advance(0.1);
  sceneryDrawnAt = -1;
  draw();
}
updateControls();
schedule();
