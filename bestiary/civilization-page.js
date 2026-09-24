import { ERAS, SIZE, createCivilization, advanceCivilization, continueCivilization, placeWordSource } from "./civilization.js";
import { sceneMarkup } from "./civilization-art.js";
import { simplePlans } from "./encounters.js";
import { createCreature, pose, step } from "./pose.js";
import { handStrokes, makeJitter, BOIL_FPS } from "./strokes.js";
import { createSvgRenderer } from "./render-svg.js";

const NS = "http://www.w3.org/2000/svg";
const svg = document.querySelector("[data-field]");
const scene = document.querySelector("[data-scene]");
const bodies = document.querySelector("[data-creatures]");
const token = document.querySelector("[data-travel-word]");
const status = document.querySelector("[data-status]");
const pause = document.querySelector("[data-pause]");
const next = document.querySelector("[data-continue]");
const controls = document.querySelector(".story-controls");
const words = new Map([...document.querySelectorAll("[data-word]")].map((node) => [node.dataset.word, node]));
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const plans = simplePlans(6, 58321);
const renderers = plans.map(() => {
  const group = document.createElementNS(NS, "g");
  bodies.append(group);
  return createSvgRenderer(group);
});

let state = createCivilization();
let creatures = plans.map((plan, id) => {
  const person = state.people[id];
  const creature = createCreature(plan, { x: person.x, y: person.y, scale: 42, seed: 58321 + id });
  creature.speed = 0;
  return creature;
});
let running = !motion.matches;
let frameId = null, last = null, renderedScene = "", renderedStatus = "";

function locateWord() {
  const span = words.get(ERAS[state.era].word);
  const rect = span.getBoundingClientRect(), field = svg.getBoundingClientRect();
  if (!field.width || !field.height) return;
  state = placeWordSource(state, {
    x: ((rect.left + rect.width / 2 - field.left) / field.width) * SIZE.width,
    y: ((rect.top + rect.height / 2 - field.top) / field.height) * SIZE.height,
  });
}

function explanation() {
  const era = ERAS[state.era];
  if (state.ready) {
    if (state.era === ERAS.length - 1) return "Their routes now connect every system. They have reached the imagined Type III scene.";
    return `They have put “${era.word}” to use. Continue their story when you are ready.`;
  }
  if (state.phase === "word") {
    return state.word === "carried"
      ? `A beast is carrying “${era.word}” into the world.`
      : `A beast is coming for “${era.word}”.`;
  }
  if (state.phase === "build") {
    const work = state.era === 0 ? "pieces of the lookout" : state.era === 1 ? "routes" : state.era === 2 ? "energy sites" : state.era === 3 ? "collectors" : "links between systems";
    return `${state.progress} of ${era.need} ${work} made by ${state.contributors.length} beasts.`;
  }
  if (state.era === 0) return `${state.wordUsedBy.length} of 2 other beasts have read the shared map.`;
  if (state.era === 1) return `${state.knowledge.slice(0, 3).filter(Boolean).length} of 3 settlements know the discovery.`;
  if (state.era === 2 || state.era === 3) return `The energy reserve has held for ${Math.floor(state.stableFor)} of 6 seconds.`;
  return `${state.knowledge.filter(Boolean).length} of 6 star systems have the discovery.`;
}

function draw() {
  const era = ERAS[state.era];
  const sceneKey = [state.era, state.progress, state.word, state.wordUsedBy.join(), state.knowledge.join(), Math.round(state.energy)].join("|");
  if (sceneKey !== renderedScene) {
    scene.innerHTML = sceneMarkup(state);
    renderedScene = sceneKey;
  }
  state.people.forEach((person, id) => {
    const creature = creatures[id];
    creature.x = person.x;
    creature.y = person.y;
    creature.heading = person.heading;
    renderers[id](handStrokes(pose(creature, state.time + id * 1.7), makeJitter(58321 + id, Math.floor(state.time * BOIL_FPS), 0.5)));
  });
  const carrying = state.word === "carried" && running && !document.hidden;
  for (const [name, span] of words) span.classList.toggle("word-lifted", carrying && name === era.word);
  token.toggleAttribute("hidden", !carrying);
  if (carrying) {
    token.textContent = era.word;
    token.style.left = `${state.people[0].x / SIZE.width * 100}%`;
    token.style.top = `${(state.people[0].y - 30) / SIZE.height * 100}%`;
  }
  document.querySelector("[data-era-number]").textContent = `Era ${state.era + 1} of ${ERAS.length}`;
  document.querySelector("[data-era-title]").textContent = era.name;
  document.querySelector("[data-era-action]").textContent = era.action;
  const message = explanation();
  if (message !== renderedStatus) {
    status.textContent = message;
    svg.setAttribute("aria-label", `${era.name}. ${era.action} ${message}`);
    renderedStatus = message;
  }
  next.hidden = !state.ready || state.era === ERAS.length - 1;
  pause.textContent = running ? "Pause" : "Play";
  pause.setAttribute("aria-label", running ? "Pause the beasts" : "Play the beasts");
}

function advance(dt) {
  state = advanceCivilization(state, dt);
  creatures.forEach((creature, id) => {
    const person = state.people[id];
    creature.x = person.x;
    creature.y = person.y;
    creature.heading = person.heading;
    step(creature, dt, state.time + id * 1.7, { x: 0, y: 0, w: SIZE.width, h: SIZE.height });
  });
}

function frame(now) {
  frameId = null;
  if (!running || document.hidden) { last = null; draw(); return; }
  const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
  last = now;
  if (dt) advance(dt);
  draw();
  frameId = requestAnimationFrame(frame);
}

function schedule() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  last = null;
  draw();
  if (running && !document.hidden) frameId = requestAnimationFrame(frame);
}

pause.addEventListener("click", () => { running = !running; schedule(); });
next.addEventListener("click", () => {
  state = continueCivilization(state);
  locateWord();
  renderedScene = "";
  schedule();
});
document.querySelector("[data-restart]").addEventListener("click", () => {
  state = createCivilization();
  creatures = plans.map((plan, id) => {
    const person = state.people[id];
    const creature = createCreature(plan, { x: person.x, y: person.y, scale: 42, seed: 58321 + id });
    creature.speed = 0;
    return creature;
  });
  locateWord();
  renderedScene = "";
  schedule();
});
addEventListener("keydown", (event) => { if (event.key === "Escape") { running = !running; schedule(); } });
document.addEventListener("visibilitychange", schedule);
motion.addEventListener("change", () => { running = !motion.matches; schedule(); });
new ResizeObserver(() => { locateWord(); draw(); }).observe(svg);
document.fonts?.ready.then(() => { locateWord(); draw(); });
controls.hidden = false;
locateWord();
svg.querySelector("[data-fallback]")?.remove();
draw();
schedule();
