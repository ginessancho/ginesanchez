// Regenerate the no-JavaScript landing illustration from the same drawing grammar.
import { writeFileSync } from "node:fs";
import { makePlan, SPECIES_NAMES } from "./grammar.js";
import { createCreature, step, pose } from "./pose.js";
import { handStrokes, makeJitter } from "./strokes.js";
import { pathData } from "./render-svg.js";
const positions = [[.08,.32],[.23,.1],[.38,.46],[.27,.93],[.09,.85],[.61,.48],[.74,.09],[.92,.27],[.91,.91],[.72,.94]];
const creatures = positions.map(([u, v], i) => {
  const creature = createCreature(makePlan(58321 + i * 173, SPECIES_NAMES[i % SPECIES_NAMES.length]), {
    x: 24 + u * 652, y: 65 + v * 146, scale: 37, seed: 58321 + i,
  });
  creature.speed = 0;
  for (let k = 0; k < 30; k++) step(creature, 1 / 60, 1, { x: 0, y: 0, w: 700, h: 246 });
  return creature;
});
const strokes = handStrokes(creatures.flatMap((c) => pose(c, 1)), makeJitter(58321, 8, .65));
const ink = strokes.filter((s) => !s.solid).map((s) => pathData(s.points)).join("");
const solid = strokes.filter((s) => s.solid).map((s) => pathData(s.points) + "Z").join("");
writeFileSync(new URL("./landing-still.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 246"><title>Ten organisms from Ginés’s sketchbook</title><path d="${ink}" fill="none" stroke="#161616" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${solid}" fill="#161616"/></svg>\n`);
