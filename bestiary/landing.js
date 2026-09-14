import { makePlan, SPECIES_NAMES } from "./grammar.js";
import { createCreature, step, pose } from "./pose.js";
import { handStrokes, makeJitter, BOIL_FPS } from "./strokes.js";
import { createSvgRenderer } from "./render-svg.js";
import { createRoam, advanceRoam, resizeRoam } from "./roaming.js";

const svg = document.querySelector("[data-world]");
const chapter = svg.closest(".chapter");
const play = document.querySelector("[data-play]");
const together = document.querySelector("[data-together]");
const restart = document.querySelector("[data-reset]");
const description = document.getElementById("world-description");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const seed = 58321;
const plans = Array.from({ length: 10 }, (_, i) => makePlan(seed + i * 173, SPECIES_NAMES[i % SPECIES_NAMES.length]));
const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
svg.append(layer);
const render = createSvgRenderer(layer);
let world;
let creatures = [];
let running = false;
let visible = false;
let frameId = null;
let last = null;
let accumulator = 0;

function measure() {
  const width = svg.clientWidth, height = svg.clientHeight;
  if (!width || !height) return;
  if (world && world.width === width && world.height === height) return;
  world = world ? resizeRoam(world, width, height) : createRoam(width, height);
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
  const primitives = creatures.flatMap((creature, i) => {
    const body = world.bodies[i];
    creature.x = body.x;
    creature.scale = body.radius * (.72 + .28 * body.space);
    creature.y = body.y + creature.scale * .35;
    creature.heading = body.heading;
    return pose(creature, world.time + body.phase);
  });
  render(handStrokes(primitives, makeJitter(seed, Math.floor(world.time * BOIL_FPS), .65)));
}
function advance(dt) {
  if (!world) return;
  world = advanceRoam(world, dt);
  creatures.forEach((creature, i) => {
    const body = world.bodies[i];
    // Keep the original anatomy and each creature's own animation phase.
    step(creature, dt, world.time + body.phase, { x: 0, y: 0, w: world.width, h: world.height });
  });
}
function updateControls() {
  play.textContent = motion.matches ? "One step" : running ? "Pause" : "Play";
  play.setAttribute("aria-label", motion.matches ? "Advance the creatures one step" : running ? "Pause the creatures" : "Let the creatures roam");
  together.setAttribute("aria-pressed", String(!!world?.makingRoom));
  together.textContent = world?.makingRoom ? "Making room for each other" : "Make room for each other";
  description.textContent = world?.makingRoom
    ? "Ten different drawn creatures roam at their own pace, anticipating neighbours and giving one another room to unfold."
    : "Ten different drawn creatures roam independently, sometimes crossing paths and crowding one another.";
}
function frame(now) {
  frameId = null;
  if (!running || !visible || document.hidden || motion.matches || !chapter.open) { last = null; return; }
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
  if (running && visible && !document.hidden && !motion.matches && chapter.open) frameId = requestAnimationFrame(frame);
}
play.addEventListener("click", () => {
  if (motion.matches) {
    for (let i = 0; i < 30; i++) advance(1 / 60);
    draw();
  } else running = !running;
  updateControls(); schedule();
});
together.addEventListener("click", () => {
  if (!world) return;
  world = { ...world, makingRoom: !world.makingRoom };
  updateControls();
});
restart.addEventListener("click", () => {
  if (!world) return;
  world = createRoam(world.width, world.height);
  creatures = world.bodies.map((body, i) => {
    const creature = createCreature(plans[i], { x: body.x, y: body.y, scale: body.radius, seed: seed + i });
    creature.speed = 0;
    return creature;
  });
  accumulator = 0;
  updateControls(); draw();
});
chapter.addEventListener("toggle", () => {
  if (chapter.open) measure();
  running = chapter.open && !motion.matches;
  updateControls(); schedule();
});
motion.addEventListener("change", () => {
  if (motion.matches) running = false;
  updateControls(); schedule();
});
document.addEventListener("visibilitychange", schedule);
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }).observe(svg);
new ResizeObserver(measure).observe(svg);
measure();
running = chapter.open && !motion.matches;
document.querySelector("[data-world-controls]").hidden = false;
updateControls(); schedule();
