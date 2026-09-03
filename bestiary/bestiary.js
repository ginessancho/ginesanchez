// Bestiary page: seed → colony → loop → strokes → svg.

import { makePlan } from "./grammar.js";
import { createCreature, step, pose } from "./pose.js";
import { makeJitter, handStrokes, BOIL_FPS } from "./strokes.js";
import { createSvgRenderer } from "./render-svg.js";

const svg = document.querySelector("[data-field]");
const reseedButton = document.querySelector("[data-reseed]");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const render = createSvgRenderer(svg);

let seed = seedFromHash();
let field = measure();
let creatures = populate(seed, field);
let t = 0;
let last = null;

function seedFromHash() {
  const n = parseInt(location.hash.slice(1), 10);
  return Number.isFinite(n) ? n : Math.floor(Math.random() * 1e9);
}

function measure() {
  const w = Math.max(1, Math.round(svg.clientWidth));
  const h = Math.max(1, Math.round(svg.clientHeight));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  return { x: 0, y: 0, w, h };
}

// One creature per roughly 60 000 px², between six and eighteen.
// Anchored species stand along the bottom; walkers keep to the lower
// half; flyers keep to the upper part; the rest go anywhere.
function populate(seed, field) {
  const count = Math.min(18, Math.max(6, Math.round((field.w * field.h) / 60000)));
  const out = [];
  for (let i = 0; i < count; i++) {
    const plan = makePlan(seed * 31 + i);
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
  }
  return out;
}

function draw() {
  const prims = creatures.flatMap((c) => pose(c, t));
  const jitter = makeJitter(seed, Math.floor(t * BOIL_FPS));
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

function reseed() {
  seed = Math.floor(Math.random() * 1e9);
  history.replaceState(null, "", `#${seed}`);
  t = 0;
  creatures = populate(seed, field);
  settle();
}

reseedButton.addEventListener("click", reseed);

addEventListener("resize", () => {
  field = measure();
  creatures = populate(seed, field);
  settle();
});

settle();
if (!reduced) requestAnimationFrame(frame);
