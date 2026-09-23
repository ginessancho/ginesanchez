import { ERAS, GALAXY_LINKS, SYSTEMS, workTarget } from "./civilization.js";

const line = (a, b, kind = "ink") => `<path class="${kind}" d="M${a.x} ${a.y}L${b.x} ${b.y}"/>`;
const circle = (x, y, r, kind = "ink") => `<circle class="${kind}" cx="${x}" cy="${y}" r="${r}"/>`;
const path = (d, kind = "ink") => `<path class="${kind}" d="${d}"/>`;
const word = (state, x, y) => state.word === "installed"
  ? `<text class="scene-word" x="${x}" y="${y}">${ERAS[state.era].word}</text>` : "";

function settlement(state) {
  let out = path("M0 455Q100 446 200 456T400 455T600 454T800 455T960 454", "water");
  out += path("M0 465Q100 456 200 466T400 465T600 464T800 465T960 464", "water");
  out += path("M238 406Q338 350 485 254M485 254Q610 312 710 451", "trace");
  // The original crossing, store and gardens stay in view.
  for (let i = 0; i < 5; i++) out += line({ x: 685 + i * 13, y: 442 }, { x: 685 + i * 13, y: 475 });
  out += line({ x: 680, y: 441 }, { x: 744, y: 441 });
  out += path("M130 353L130 307L176 307L176 353M126 307L153 285L180 307");
  for (let i = 0; i < 5; i++) {
    out += path(`M${690 + i * 18} 351l0 -27m0 12l-8 -10m8 10l8 -10`);
    out += path(`M${100 + i * 16} 412l0 -20m0 8l-6 -8m6 8l6 -8`);
  }
  out += line({ x: 212, y: 415 }, { x: 265, y: 415 }, "trace");
  for (let i = 0; i < 3; i++) out += circle(227 + i * 14, 402 - i * 4, 7, "ink");
  // The lookout takes shape through distinct deliveries.
  const p = state.progress / ERAS[0].need;
  if (p > 0) {
    out += line({ x: 460, y: 270 }, { x: 473, y: 270 - p * 95 });
    out += line({ x: 510, y: 270 }, { x: 497, y: 270 - p * 95 });
  }
  if (p >= 0.5) out += line({ x: 465, y: 225 }, { x: 505, y: 225 });
  if (p >= 1) {
    out += line({ x: 467, y: 175 }, { x: 503, y: 175 });
    out += circle(485, 161, 9);
    out += circle(485, 161, 3, "dot");
  }
  out += word(state, 485, 143);
  for (const id of state.wordUsedBy) out += circle(466 + id * 13, 182, 2, "dot");
  return out;
}

function houses(x, y) {
  return path(`M${x - 25} ${y + 15}v-26l25 -17l25 17v26M${x - 34} ${y + 15}h68`)
    + circle(x - 13, y + 2, 3, "dot") + circle(x + 13, y + 2, 3, "dot");
}

function manySettlements(state) {
  const nodes = [{ x: 180, y: 310 }, { x: 480, y: 245 }, { x: 780, y: 320 }];
  let out = path("M0 420Q190 440 320 392T640 388T960 420", "trace");
  for (let i = 0; i < nodes.length; i++) {
    out += houses(nodes[i].x, nodes[i].y);
    if (state.knowledge[i]) out += circle(nodes[i].x, nodes[i].y - 62, 5, "dot");
  }
  for (let i = 0; i < state.progress; i++) {
    const a = nodes[i % 2], b = nodes[i % 2 + 1];
    const offset = i >= 2 ? 10 : 0;
    out += path(`M${a.x} ${a.y + offset}Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 45 + offset} ${b.x} ${b.y + offset}`, i < 2 ? "ink" : "trace");
  }
  out += word(state, 480, 170);
  return out;
}

function planet(state) {
  let out = circle(480, 285, 162);
  out += path("M318 285Q480 195 642 285M318 285Q480 375 642 285", "trace");
  out += path("M480 123Q390 285 480 447M480 123Q570 285 480 447", "trace");
  out += path("M371 169Q388 183 382 212T403 247M558 383Q530 390 524 417", "water");
  for (let i = 0; i < state.progress; i++) {
    const pt = workTarget(2, i);
    out += circle(pt.x, pt.y, 12) + circle(pt.x, pt.y, 4, "dot");
    out += line(pt, { x: 480, y: 285 }, "trace");
  }
  out += word(state, 480, 278);
  if (state.phase === "verify" || state.ready) {
    const count = Math.min(10, Math.round(state.energy));
    for (let i = 0; i < count; i++) out += line({ x: 385 + i * 20, y: 480 }, { x: 385 + i * 20, y: 487 }, "energy");
  }
  return out;
}

function star(state) {
  let out = circle(500, 265, 57, "star");
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    out += line({ x: 500 + Math.cos(a) * 68, y: 265 + Math.sin(a) * 68 }, { x: 500 + Math.cos(a) * 83, y: 265 + Math.sin(a) * 83 }, "star");
  }
  out += `<ellipse class="trace" cx="500" cy="265" rx="180" ry="146"/>`;
  out += circle(216, 396, 34) + path("M187 396Q216 383 245 396", "trace");
  out += path("M250 385Q310 366 343 340", "trace");
  for (let i = 0; i < state.progress; i++) {
    const pt = workTarget(3, i);
    out += path(`M${pt.x - 12} ${pt.y - 5}l12 -9l12 9l-12 9Z`);
    out += line(pt, { x: 500, y: 265 }, "energy");
  }
  out += word(state, 500, 260);
  return out;
}

function galaxy(state) {
  let out = path("M95 377Q260 80 480 279T877 142", "trace");
  out += path("M85 435Q305 171 492 345T914 239", "trace");
  // Aggregate stars suggest the much larger civilization beyond six drawn
  // systems. They are scenery, not individually simulated actors.
  for (let arm = 0; arm < 4; arm++) {
    for (let i = 0; i < 21; i++) {
      const radius = 25 + i * 17;
      const angle = arm * Math.PI / 2 + i * 0.17;
      const x = 480 + Math.cos(angle) * radius;
      const y = 275 + Math.sin(angle) * radius * 0.57;
      out += circle(x.toFixed(1), y.toFixed(1), i % 7 === 0 ? 2.3 : 1.3, "dust");
    }
  }
  for (let i = 0; i < state.progress; i++) {
    const [a, b] = GALAXY_LINKS[i];
    out += line(SYSTEMS[a], SYSTEMS[b], "energy");
  }
  for (let i = 0; i < SYSTEMS.length; i++) {
    const node = SYSTEMS[i];
    if (state.knowledge[i]) out += circle(node.x, node.y, 23, "trace");
    out += circle(node.x, node.y, 13, state.knowledge[i] ? "known" : "ink");
    out += circle(node.x, node.y, 3, "dot");
  }
  out += word(state, 438, 268);
  return out;
}

export function sceneMarkup(state) {
  return [settlement, manySettlements, planet, star, galaxy][state.era](state);
}
