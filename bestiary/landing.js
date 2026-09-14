import { makePlan, SPECIES_NAMES } from "./grammar.js";
import { createCreature, step, pose } from "./pose.js";
import { handStrokes, makeJitter, BOIL_FPS } from "./strokes.js";
import { createSvgRenderer } from "./render-svg.js";
import { createWorld, discover, exchange, countWorld, LOCAL_LINKS, BRIDGE } from "./learning.js";

const svg = document.querySelector("[data-world]");
const playButton = document.querySelector("[data-play]");
const controls = document.querySelector("[data-play-controls]");
const connectButton = document.querySelector("[data-connect]");
const stepButton = document.querySelector("[data-step]");
const description = document.getElementById("world-description");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const NS = "http://www.w3.org/2000/svg";
const SEED = 58321;
const INTERVAL = 1100;
const positions = [
  [.08, .32], [.23, .10], [.38, .46], [.27, .93], [.09, .85],
  [.61, .48], [.74, .09], [.92, .27], [.91, .91], [.72, .94],
];
const plans = positions.map((_, i) => makePlan(SEED + i * 173, SPECIES_NAMES[i % SPECIES_NAMES.length]));
let world = createWorld();
let creatures = [];
let geometry = [];
let width = 700;
let height = 246;
let running = false;
let visible = true;
let frameId = null;
let last = null;
let elapsed = 0;
let t = 1;
let pulse = 1;
const node = (name, attrs, parent) => {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  parent?.append(el);
  return el;
};
const linksLayer = node("g", { class: "world-links" }, svg);
const paths = [...LOCAL_LINKS, BRIDGE].map((_, i) => node("path", { class: i === LOCAL_LINKS.length ? "bridge" : "" }, linksLayer));
const markerLayer = node("g", {}, svg);
const water = node("g", {}, markerLayer);
node("path", { d: "M-9 0Q-4-4 0 0T9 0M-9 5Q-4 1 0 5T9 5", class: "world-water" }, water);
const waterLabel = node("text", { y: 22, class: "water-label" }, water);
waterLabel.textContent = "water";
const rings = positions.map(() => node("circle", { class: "world-ring" }, markerLayer));
const courses = positions.map(() => node("path", { class: "world-course" }, markerLayer));
const drawing = node("g", {}, svg);
const render = createSvgRenderer(drawing);
const signalsLayer = node("g", {}, svg);
const dots = positions.map(() => node("circle", { r: 3, class: "world-signal" }, signalsLayer));

function resource(revision) {
  return revision % 2 ? { x: 17, y: height * .48 } : { x: width - 17, y: height * .37 };
}
function measure() {
  width = svg.clientWidth;
  height = svg.clientHeight;
  if (!width || !height) return;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const scale = Math.min(37, Math.max(25, width / 18));
  geometry = positions.map(([u, v]) => ({ x: 24 + u * (width - 48), y: 65 + v * (height - 100), scale }));
  creatures = plans.map((plan, i) => {
    const creature = createCreature(plan, { ...geometry[i], seed: SEED + i });
    creature.speed = 0;
    for (let k = 0; k < 30; k++) step(creature, 1 / 60, 1, { x: 0, y: 0, w: width, h: height });
    return creature;
  });
  draw();
}
function centre(i) {
  const g = geometry[i];
  return { x: g.x, y: g.y - g.scale * .55 };
}
function draw() {
  if (!creatures.length) return;
  const active = world.revision > 0;
  linksLayer.style.display = active ? "" : "none";
  markerLayer.style.display = active ? "" : "none";
  [...LOCAL_LINKS, BRIDGE].forEach(([a, b], i) => {
    const p = centre(a), q = centre(b);
    paths[i].setAttribute("d", `M${p.x} ${p.y}Q${(p.x + q.x) / 2} ${(p.y + q.y) / 2 - 10} ${q.x} ${q.y}`);
    paths[i].style.display = i === LOCAL_LINKS.length && !world.connected ? "none" : "";
  });
  const target = resource(world.revision);
  water.setAttribute("transform", `translate(${target.x} ${target.y})`);
  waterLabel.setAttribute("text-anchor", world.revision % 2 ? "start" : "end");
  creatures.forEach((creature, i) => {
    const g = geometry[i], c = centre(i), state = world.nodes[i];
    const current = state.heard === world.revision;
    rings[i].style.display = state.heard ? "" : "none";
    rings[i].setAttribute("class", `world-ring${current ? "" : " old"}`);
    rings[i].setAttribute("cx", c.x);
    rings[i].setAttribute("cy", c.y);
    rings[i].setAttribute("r", g.scale * .86);
    let dx = 0, dy = 0;
    courses[i].style.display = state.acted ? "" : "none";
    if (state.acted) {
      const destination = resource(state.acted);
      const distance = Math.hypot(destination.x - c.x, destination.y - c.y) || 1;
      dx = (destination.x - c.x) / distance;
      dy = (destination.y - c.y) / distance;
      const x = c.x + dx * (g.scale + 13), y = c.y + dy * (g.scale + 13);
      courses[i].setAttribute("d", `M${c.x + dx * g.scale} ${c.y + dy * g.scale}L${x} ${y}m${-dx * 4 - dy * 3} ${-dy * 4 + dx * 3}L${x} ${y}l${-dx * 4 + dy * 3} ${-dy * 4 - dx * 3}`);
      courses[i].setAttribute("class", `world-course${state.acted === world.revision ? "" : " old"}`);
    }
    creature.x = g.x + dx * 7;
    creature.y = g.y + dy * 7;
  });
  render(handStrokes(creatures.flatMap((c) => pose(c, t)), makeJitter(SEED, Math.floor(t * BOIL_FPS), .65)));
  dots.forEach((dot, i) => {
    const signal = world.transmissions[i];
    dot.style.display = signal && pulse < 1 ? "" : "none";
    if (!signal) return;
    const a = centre(signal.from), b = centre(signal.to);
    dot.setAttribute("cx", a.x + (b.x - a.x) * pulse);
    dot.setAttribute("cy", a.y + (b.y - a.y) * pulse - 20 * pulse * (1 - pulse));
    dot.setAttribute("class", `world-signal${signal.revision === world.revision ? "" : " old"}`);
  });
}
function updateCopy() {
  controls.hidden = !world.revision;
  stepButton.hidden = motion.matches;
  playButton.innerHTML = !world.revision ? 'Play <span aria-hidden="true">↗</span>'
    : motion.matches ? "Next step" : running ? "Pause" : "Play";
  playButton.setAttribute("aria-label", !world.revision ? "Play the small world" : motion.matches ? "Advance one exchange" : running ? "Pause the small world" : "Resume the small world");
  connectButton.textContent = world.connected ? "Disconnect the groups" : "Connect the groups";
  connectButton.setAttribute("aria-pressed", String(world.connected));
  if (!world.revision) return;
  const counts = countWorld(world);
  let story;
  if (counts.outdated) story = "The water moved. Some are still following yesterday’s news.";
  else if (counts.acted === 10) story = "The discovery travelled. Both groups changed course.";
  else if (counts.acted === 5 && !world.connected) story = "One group knows. The other has no way to hear.";
  else if (counts.heard > counts.acted) story = "Hearing something is the first step. Acting on it takes another.";
  else story = "A discovery can travel along a connection.";
  const count = `${counts.heard} of 10 heard the latest · ${counts.acted} changed course${counts.outdated ? ` · ${counts.outdated} following old news` : ""}`;
  const storyEl = document.querySelector("[data-story]");
  const countEl = document.querySelector("[data-count]");
  if (storyEl.textContent !== story) storyEl.textContent = story;
  if (countEl.textContent !== count) countEl.textContent = count;
  description.textContent = `${story} ${count}. ${world.connected ? "The groups are connected." : "The groups are separate."}`;
}
function advance() {
  world = exchange(world);
  pulse = motion.matches ? 1 : 0;
  updateCopy();
  draw();
}
function frame(now) {
  frameId = null;
  if (!running || !visible || document.hidden || motion.matches) { last = null; return; }
  const dt = last === null ? 0 : Math.min((now - last) / 1000, .05);
  last = now;
  elapsed += dt * 1000;
  t += dt;
  pulse = Math.min(1, pulse + dt * 1.6);
  if (elapsed >= INTERVAL) { elapsed -= INTERVAL; advance(); }
  for (const creature of creatures) step(creature, dt, t, { x: 0, y: 0, w: width, h: height });
  draw();
  frameId = requestAnimationFrame(frame);
}
function schedule() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  last = null;
  if (running && visible && !document.hidden && !motion.matches) frameId = requestAnimationFrame(frame);
}
playButton.addEventListener("click", () => {
  if (!world.revision) {
    world = discover(world);
    running = !motion.matches;
  } else if (motion.matches) advance();
  else running = !running;
  updateCopy(); draw(); schedule();
});
connectButton.addEventListener("click", () => {
  world = { ...world, connected: !world.connected, transmissions: [] };
  updateCopy(); draw();
});
document.querySelector("[data-change]").addEventListener("click", () => {
  world = discover(world); elapsed = 0;
  updateCopy(); draw();
});
stepButton.addEventListener("click", () => {
  running = false; elapsed = 0; advance(); schedule();
});
document.querySelector("[data-reset]").addEventListener("click", () => {
  world = createWorld(); running = false; elapsed = 0; pulse = 1; t = 1;
  playButton.focus();
  description.textContent = "Ten different creatures in two groups. Play to follow a discovery as it travels between them.";
  updateCopy(); measure(); schedule();
});
motion.addEventListener("change", () => {
  if (motion.matches) running = false;
  updateCopy(); draw(); schedule();
});
svg.closest(".chapter")?.addEventListener("toggle", (event) => {
  if (!event.currentTarget.open) running = false;
  else measure();
  updateCopy();
  schedule();
});
document.addEventListener("visibilitychange", schedule);
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }).observe(svg);
new ResizeObserver(measure).observe(svg);
measure();
svg.querySelector("[data-fallback]").remove();
playButton.hidden = false;
updateCopy();
