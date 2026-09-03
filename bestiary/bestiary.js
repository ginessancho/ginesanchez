// Bestiary page: seed → colony → loop → strokes → svg.

import { makePlan, breed } from "./grammar.js";
import { createCreature, step, pose } from "./pose.js";
import { makeJitter, handStrokes, BOIL_FPS } from "./strokes.js";
import { createSvgRenderer } from "./render-svg.js";

const svg = document.querySelector("[data-field]");
const reseedButton = document.querySelector("[data-reseed]");
const lineageLabel = document.querySelector("[data-lineage]");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const render = createSvgRenderer(svg);

// The hash is "#origin" or "#origin.generation". A lineage is replayed
// from its origin, so the same hash always shows the same family.
let { origin, gen } = parseHash();
let field = measure();
let plans = lineage(origin, gen, countFor(field));
let creatures = place(plans, origin + gen * 104729, field);
let t = 0;
let last = null;

function parseHash() {
  const m = /^#(\d+)(?:\.(\d+))?$/.exec(location.hash);
  if (m) return { origin: Number(m[1]), gen: Number(m[2] || 0) };
  return { origin: Math.floor(Math.random() * 1e9), gen: 0 };
}

function writeHash() {
  history.replaceState(null, "", gen ? `#${origin}.${gen}` : `#${origin}`);
  lineageLabel.textContent = `Generation ${gen + 1}`;
}

function countFor(field) {
  return Math.min(18, Math.max(6, Math.round((field.w * field.h) / 60000)));
}

function lineage(origin, gen, count) {
  let out = Array.from({ length: count }, (_, i) => makePlan(origin * 31 + i));
  for (let g = 1; g <= gen; g++) out = breed(out, origin + g * 7919);
  return out;
}

function measure() {
  const w = Math.max(1, Math.round(svg.clientWidth));
  const h = Math.max(1, Math.round(svg.clientHeight));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  return { x: 0, y: 0, w, h };
}

// Anchored species stand along the bottom; walkers keep to the lower
// half; flyers keep to the upper part; the rest go anywhere.
function place(plans, seed, field) {
  const out = [];
  plans.forEach((plan, i) => {
    const scale = 36 + ((seed * 7 + i * 13) % 37);
    const u = ((seed * 17 + i * 101) % 1000) / 1000;
    const v = ((seed * 23 + i * 211) % 1000) / 1000;
    let x = field.x + scale + u * (field.w - 2 * scale);
    let y;
    switch (plan.species) {
      case "kelp":
      case "tower":
        y = field.y + field.h - scale * 0.15;
        break;
      case "walker":
        y = field.y + field.h * (0.5 + 0.45 * v);
        break;
      case "flyer":
        y = field.y + scale + v * (field.h * 0.7 - scale);
        break;
      default:
        y = field.y + scale + v * (field.h - 2 * scale);
    }
    out.push(createCreature(plan, { x, y, scale, seed: seed + i }));
  });
  return out;
}

function draw() {
  const prims = creatures.flatMap((c) => pose(c, t));
  const jitter = makeJitter(origin + gen, Math.floor(t * BOIL_FPS));
  render(handStrokes(prims, jitter));
}

function advance(dt) {
  t += dt;
  for (const c of creatures) step(c, dt, t, field, creatures);
}

function frame(now) {
  const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
  last = now;
  advance(dt);
  draw();
  requestAnimationFrame(frame);
}

function settle() {
  // A second of quiet stepping so knots have a trail and spines have settled.
  for (let k = 0; k < 60; k++) advance(1 / 60);
  draw();
}

function nextGeneration() {
  gen += 1;
  plans = breed(plans, origin + gen * 7919);
  t = 0;
  creatures = place(plans, origin + gen * 104729, field);
  writeHash();
  settle();
}

reseedButton.addEventListener("click", nextGeneration);

addEventListener("resize", () => {
  field = measure();
  plans = lineage(origin, gen, countFor(field));
  creatures = place(plans, origin + gen * 104729, field);
  settle();
});

writeHash();
settle();
if (!reduced) requestAnimationFrame(frame);
