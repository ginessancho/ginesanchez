// A drawing experiment: a settlement that grows out of what its creatures
// need, notice, tell one another, and build together. Pure state in, state
// out; nothing here touches the DOM. No leader, no shared destination, no
// ranking of body shapes. The one rule that matters: what they build
// together changes what they can do next.
//
//   needs      energy drains; food patches feed, and run out; seasons turn
//   knowledge  a creature only knows what it has seen or been told; news
//              travels by encounter and can go stale
//   building   a site is proposed by a felt need, built from carried material
//              by at least two contributors, and then changes what is possible
//   structures crossing (opens the far bank), store (surplus outlives plenty),
//              lookout (pooled memory), garden (tended food)
//   paths      well-used routes are drawn in; unused ones fade
//   turnover   an exhausted creature is replaced by a newcomer who knows
//              nothing; only paths, places and other creatures remember

import { moduleGeometry } from "./pose.js";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const KINDS = {
  crossing: { need: 6, max: 1 },
  store: { need: 4, max: 1, cap: 8 },
  lookout: { need: 5, max: 1 },
  garden: { need: 3, max: 2, cap: 4 },
};
export const HUNGRY = 0.5;     // energy below which food is the priority
export const SEASON = 160;     // seconds per cycle of plenty and scarcity
export const TIRED_FOR = 8;    // seconds an exhausted creature lies still
export const MAX_PATHS = 24;

function hash(a, b, c) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ c, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function placeScale(world) {
  return Math.min(1.3, world.width / 450, world.height / 600);
}

// The creek runs across the foot of the page. The far bank is richer.
// Wide screens keep the settlement in the margins and along the foot;
// narrow screens keep everything in the strip below the text.
export function terrain(width, height) {
  const wide = width > 1000;
  const at = (u, v) => ({ x: u * width, y: v * height });
  const creekY = (wide ? 0.84 : 0.88) * height;
  const patches = (wide ? [
    ["food", 0.30, 0.93, 8], ["food", 0.62, 0.93, 8], ["food", 0.90, 0.93, 7],
    ["food", 0.06, 0.32, 4], ["food", 0.94, 0.40, 4], ["food", 0.94, 0.70, 3],
    ["material", 0.06, 0.55, 10], ["material", 0.93, 0.20, 10],
  ] : [
    ["food", 0.45, 0.95, 8], ["food", 0.80, 0.95, 8],
    ["food", 0.85, 0.80, 4], ["food", 0.10, 0.60, 3],
    ["material", 0.55, 0.80, 10], ["material", 0.15, 0.40, 10],
  ]).map(([kind, u, v, cap], id) => ({ id, kind, ...at(u, v), cap, stock: kind === "food" ? cap * 0.6 : cap }));
  const slots = (wide
    ? [[0.13, 0.72], [0.87, 0.77], [0.05, 0.18], [0.95, 0.56], [0.50, 0.93]]
    : [[0.35, 0.79], [0.10, 0.76], [0.62, 0.77], [0.88, 0.75], [0.50, 0.70]]
  ).map(([u, v]) => at(u, v));
  return { wide, creekY, crossing: at(wide ? 0.10 : 0.18, wide ? 0.84 : 0.88), slots, patches };
}

export function createSettlement(world, seed = 1) {
  const t = terrain(world.width, world.height);
  return {
    seed, time: 0, season: 1, width: world.width, height: world.height,
    creekY: t.creekY, crossingSlot: t.crossing, slots: t.slots, patches: t.patches,
    sites: [], paths: [], events: [], exchangeClock: 0,
    people: world.bodies.map((b) => ({
      id: b.id, energy: 0.55 + hash(seed, b.id, 1) * 0.4, carrying: null, carriedSince: 0,
      memory: {}, known: [], task: null, wait: hash(seed, b.id, 2) * 4,
      failures: 0, trips: 0, lastNode: null, generation: 1, born: 0, tired: 0, lastLookout: -99,
    })),
    stats: { births: 0, stale: 0, deckCrossings: 0, deposits: 0, withdrawals: 0, exchanges: 0, proposals: 0, eaten: 0 },
  };
}

// Sizes change; work, memory and paths survive. A site keeps its slot.
export function resizeSettlement(state, world) {
  const t = terrain(world.width, world.height);
  const patches = t.patches.map((p, i) => ({ ...p, stock: state.patches[i] ? Math.min(p.cap, state.patches[i].stock) : p.stock }));
  const sites = state.sites.map((site) => {
    const pt = site.slot < 0 ? t.crossing : t.slots[site.slot];
    return { ...site, x: pt.x, y: pt.y };
  });
  const valid = (key) => key[0] === "s" || Number(key.slice(1)) < patches.length;
  return {
    ...state, width: world.width, height: world.height, creekY: t.creekY, crossingSlot: t.crossing, slots: t.slots,
    patches, sites,
    people: state.people.map((p) => ({
      ...p, task: null,
      memory: Object.fromEntries(Object.entries(p.memory).filter(([id]) => Number(id) < patches.length)),
      lastNode: p.lastNode && valid(p.lastNode) ? p.lastNode : null,
    })),
    paths: state.paths.filter((path) => valid(path.a) && valid(path.b)),
  };
}

function clone(state) {
  return {
    ...state,
    patches: state.patches.map((p) => ({ ...p })),
    sites: state.sites.map((s) => ({ ...s, contributors: [...s.contributors], board: { ...s.board } })),
    people: state.people.map((p) => ({ ...p, memory: { ...p.memory }, known: [...p.known], task: p.task && { ...p.task, via: p.task.via && [...p.task.via] } })),
    paths: state.paths.map((p) => ({ ...p })),
    events: [...state.events],
    stats: { ...state.stats },
  };
}

const bankOf = (y, creekY) => (y < creekY ? 0 : 1);
const nodeKey = (node) => `${node.type[0]}${node.id}`;
const nodeOf = (state, node) => (node.type === "patch" ? state.patches[node.id] : state.sites[node.id]);
const crossingOf = (state) => state.sites.find((s) => s.kind === "crossing");

function record(state, time, kind, extra = {}) {
  state.events.push({ time, kind, ...extra });
  if (state.events.length > 40) state.events.shift();
}

function trail(state, from, to) {
  if (!from || from === to) return;
  const [a, b] = from < to ? [from, to] : [to, from];
  const path = state.paths.find((p) => p.a === a && p.b === b);
  if (path) path.uses = Math.min(24, path.uses + 1);
  else if (state.paths.length < MAX_PATHS) state.paths.push({ a, b, uses: 1 });
}

function observe(person, body, state, sight, time) {
  for (const p of state.patches) if (dist(body, p) < sight) person.memory[p.id] = { stock: p.stock, at: time };
  for (const site of state.sites) if (dist(body, site) < sight && !person.known.includes(site.id)) person.known.push(site.id);
}

function mergeMemory(into, from) {
  for (const [id, m] of Object.entries(from)) {
    if (!into[id] || into[id].at < m.at) into[id] = { ...m };
  }
}

// A felt need proposes a site. Only the proposer knows about it at first.
function propose(state, kind, near, time, person) {
  const rule = KINDS[kind];
  if (state.sites.filter((s) => s.kind === kind).length >= rule.max) return null;
  if (state.sites.some((s) => s.kind === kind && !s.done)) return null;
  let slot = -1, pt = state.crossingSlot;
  if (kind !== "crossing") {
    const free = state.slots.map((p, i) => ({ ...p, i })).filter((p) => !state.sites.some((s) => s.slot === p.i));
    if (!free.length) return null;
    free.sort((a, b) => dist(a, near) - dist(b, near));
    slot = free[0].i; pt = free[0];
  }
  const site = {
    id: state.sites.length, kind, slot, x: pt.x, y: pt.y, need: rule.need, delivered: 0, contributors: [],
    done: false, doneAt: null, condition: 1, stock: 0, board: {}, uses: 0, proposedAt: time, by: person.id,
  };
  state.sites.push(site);
  state.stats.proposals++;
  person.known.push(site.id);
  record(state, time, "proposed", { what: kind, by: person.id });
  return site;
}

function finish(state, person, key) {
  trail(state, person.lastNode, key);
  person.lastNode = key;
  person.trips++;
  person.task = null;
  person.wait = 1 + hash(state.seed, person.id, person.trips) * 3;
}

// A crossing is worked from whichever bank the creature stands on.
function approach(state, node, body, scale) {
  const pt = nodeOf(state, node);
  if (node.type === "site" && pt.kind === "crossing") {
    return { x: pt.x, y: state.creekY + (bankOf(body.y, state.creekY) === 0 ? -16 : 16) * scale };
  }
  return pt;
}

function target(state, task, body) {
  if (task.via && task.via.length) return task.via[0];
  return approach(state, task.node, body, task.scale);
}

// Legs of a journey: straight, or by way of the crossing when the far bank
// is only reachable on foot across the deck.
function plan(state, body, node, glide, scale) {
  const pt = approach(state, node, body, scale);
  const here = bankOf(body.y, state.creekY), there = bankOf(pt.y, state.creekY);
  if (here === there || glide) return { via: null, reachable: true };
  const crossing = crossingOf(state);
  if (!crossing?.done) return { via: null, reachable: false };
  const side = here === 0 ? -1 : 1;
  return { via: [{ x: crossing.x, y: state.creekY + side * 16 * scale }, { x: crossing.x, y: state.creekY - side * 16 * scale }], reachable: true };
}

function errand(state, body, node, glide, scale) {
  const legs = plan(state, body, node, glide, scale);
  if (!legs.reachable) return null;
  return { kind: "deliver", node, via: legs.via, glide, scale, dwell: 0, arrived: false };
}

function decide(state, person, body, glide, world, time, scale) {
  const span = Math.max(world.width, world.height);
  const near = (pt) => dist(body, pt) / span;
  const options = [];
  const add = (kind, node, score, extra = {}) => {
    const legs = plan(state, body, node, glide, scale);
    options.push({ kind, node, score, reachable: legs.reachable, via: legs.via, ...extra });
  };
  const known = (site) => person.known.includes(site.id);
  const store = state.sites.find((s) => s.kind === "store" && s.done && known(s));
  const foods = [];
  for (const [id, m] of Object.entries(person.memory)) {
    const p = state.patches[id];
    if (p.kind === "food" && m.stock >= 1) foods.push({ node: { type: "patch", id: p.id }, stock: m.stock, pt: p });
  }
  for (const site of state.sites) {
    if (known(site) && site.done && (site.kind === "garden" || site.kind === "store") && site.stock >= 1) {
      foods.push({ node: { type: "site", id: site.id }, stock: site.stock, pt: site });
    }
  }
  if (person.energy < HUNGRY) {
    for (const f of foods) add("eat", f.node, 1 + (Math.min(f.stock, 3) / 3) * 0.5 + (1 - person.energy) - near(f.pt) * 1.4);
  }
  if (person.carrying === "material") {
    for (const site of state.sites) if (known(site) && !site.done) add("deliver", { type: "site", id: site.id }, 1.6 - near(site));
  } else if (person.carrying === "food") {
    if (store && store.stock < KINDS.store.cap) add("deliver", { type: "site", id: store.id }, 1.5 - near(store));
  } else if (person.energy >= HUNGRY) {
    // Work: gather material for a known site that is not finished.
    const sites = state.sites.filter((s) => known(s) && !s.done);
    const materials = Object.entries(person.memory).filter(([id, m]) => state.patches[id].kind === "material" && m.stock >= 1);
    for (const site of sites) for (const [id] of materials) {
      const p = state.patches[id];
      const mine = site.contributors.includes(person.id) ? -0.15 : 0.15;
      add("gather", { type: "patch", id: p.id }, 0.9 + mine - near(p) - near(site) * 0.5 + (person.energy - 0.5) * 0.3, { resource: "material", then: site.id });
    }
    for (const site of state.sites) {
      if (!known(site) || !site.done) continue;
      if (site.kind === "garden" && site.condition < 0.6) add("tend", { type: "site", id: site.id }, 0.55 + (1 - site.condition) - near(site));
      if (site.kind === "lookout" && time - person.lastLookout > 25) add("visit", { type: "site", id: site.id }, 0.4 + Math.min(0.3, (time - person.lastLookout) / 200) - near(site));
    }
    if (store && store.stock < KINDS.store.cap - 1 && person.energy > 0.6) {
      for (const f of foods) if (f.node.type === "patch" && f.stock >= 3) add("gather", f.node, 0.5 + f.stock / 8 - near(f.pt) - near(store) * 0.5, { resource: "food", then: store.id });
    }
  }
  options.sort((a, b) => b.score - a.score);
  const best = options[0];
  if (best && !best.reachable && person.carrying !== "material") {
    // Wanting what lies across the water is how a crossing begins.
    propose(state, "crossing", body, time, person);
  }
  const choice = options.find((o) => o.reachable && o.score > 0.15);
  if (!choice) {
    person.wait = 1.5 + hash(state.seed, person.id, person.trips + 7) * 2;
    return;
  }
  person.task = { kind: choice.kind, node: choice.node, via: choice.via, resource: choice.resource, then: choice.then, glide, scale, dwell: 0, arrived: false };
}

function move(body, pt, dt, world) {
  const d = dist(body, pt);
  if (d < 0.001) return { ...body };
  const amount = Math.min(d, body.pace * 1.5 * dt);
  return {
    ...body,
    x: clamp(body.x + ((pt.x - body.x) / d) * amount, 8, world.width - 8),
    y: clamp(body.y + ((pt.y - body.y) / d) * amount, 8, world.height - 8),
    heading: Math.atan2(pt.y - body.y, pt.x - body.x),
  };
}

// The water is a hard rule for everyone who cannot glide: the only way
// across is the deck of a finished crossing. Turned back otherwise.
function ford(prev, next, state, glide, scale) {
  if (glide || bankOf(prev.y, state.creekY) === bankOf(next.y, state.creekY)) return { body: next, blocked: false };
  const crossing = crossingOf(state);
  if (crossing?.done && Math.abs(next.x - crossing.x) < 14 * scale) return { body: next, blocked: false };
  return { body: { ...next, y: prev.y, heading: -next.heading }, blocked: true };
}

function arrive(state, person, body, task, time, dt) {
  const node = nodeOf(state, task.node), key = nodeKey(task.node), id = person.id;
  task.dwell += dt;
  const site = task.node.type === "site" ? node : null;
  switch (task.kind) {
    case "eat": {
      if (!task.arrived) {
        task.arrived = true;
        if (node.stock < 1) {
          // Stale news: the food was gone before they got there.
          person.failures++; state.stats.stale++;
          record(state, time, "stale", { by: id });
          if (person.failures >= 2) { propose(state, "lookout", body, time, person); person.failures = 0; }
          return finish(state, person, key);
        }
      }
      if (task.dwell < 1.2) return;
      task.dwell = 0;
      if (node.stock >= 1 && person.energy < 0.85) {
        node.stock -= 1; person.energy = Math.min(1, person.energy + 0.4); state.stats.eaten++;
        if (site?.kind === "store") { state.stats.withdrawals++; site.uses++; }
        if (task.node.type === "patch" && node.stock < 1) propose(state, "garden", body, time, person);
        return;
      }
      if (task.node.type === "patch") {
        const store = state.sites.find((s) => s.kind === "store" && s.done && person.known.includes(s.id));
        if (node.stock >= 3 && person.energy >= 0.85 && !state.sites.some((s) => s.kind === "store")) propose(state, "store", body, time, person);
        if (store && store.stock < KINDS.store.cap - 1 && node.stock >= 2) {
          // Surplus can travel: one unit goes to the store.
          node.stock -= 1; person.carrying = "food"; person.carriedSince = time;
          trail(state, person.lastNode, key); person.lastNode = key; person.trips++;
          person.task = errand(state, body, { type: "site", id: store.id }, task.glide, task.scale);
          return;
        }
      }
      return finish(state, person, key);
    }
    case "gather": {
      if (task.dwell < 0.8) return;
      if (node.stock < 1) {
        person.failures++; state.stats.stale++;
        record(state, time, "stale", { by: id });
        return finish(state, person, key);
      }
      node.stock -= 1; person.carrying = task.resource; person.carriedSince = time;
      trail(state, person.lastNode, key); person.lastNode = key; person.trips++;
      person.task = errand(state, body, { type: "site", id: task.then }, task.glide, task.scale);
      return;
    }
    case "deliver": {
      if (task.dwell < 0.6) return;
      if (person.carrying === "material") {
        if (!site.done) {
          site.delivered = Math.min(site.need, site.delivered + 1);
          if (!site.contributors.includes(id)) site.contributors.push(id);
          // Shared work: the last unit only counts once two have contributed.
          if (site.delivered >= site.need && site.contributors.length >= 2) {
            site.done = true; site.doneAt = time;
            record(state, time, "built", { what: site.kind });
          }
        }
        person.carrying = null;
      } else if (person.carrying === "food") {
        if (site.kind === "store" && site.stock < KINDS.store.cap) { site.stock += 1; site.uses++; state.stats.deposits++; }
        else person.energy = Math.min(1, person.energy + 0.4);
        person.carrying = null;
      }
      return finish(state, person, key);
    }
    case "tend": {
      if (task.dwell < 2) return;
      site.condition = Math.min(1, site.condition + 0.45); site.uses++;
      return finish(state, person, key);
    }
    case "visit": {
      if (task.dwell < 1) return;
      // Pooled memory: what each visitor knows, the lookout keeps.
      mergeMemory(site.board, person.memory);
      mergeMemory(person.memory, site.board);
      for (const p of state.patches) if (dist(site, p) < 420 * placeScale({ width: state.width, height: state.height })) person.memory[p.id] = { stock: p.stock, at: time };
      site.uses++; person.lastLookout = time;
      return finish(state, person, key);
    }
    default:
      return finish(state, person, key);
  }
}

export function advanceSettlement(input, previous, moved, dt) {
  const state = clone(input);
  const world = { ...moved, bodies: moved.bodies.map((b) => ({ ...b })) };
  const time = moved.time;
  state.time = time;
  state.season = 0.6 + 0.4 * Math.sin((Math.PI * 2 * time) / SEASON);
  const scale = placeScale(world);
  const sight = 130 * scale;

  for (const p of state.patches) p.stock = Math.min(p.cap, p.stock + (p.kind === "food" ? 0.05 * state.season : 0.02) * dt);
  for (const site of state.sites) {
    if (site.done && site.kind === "garden") {
      site.condition = Math.max(0.1, site.condition - 0.003 * dt);
      site.stock = Math.min(KINDS.garden.cap, site.stock + 0.08 * site.condition * dt);
    }
  }
  for (const path of state.paths) path.uses -= 0.004 * dt;
  state.paths = state.paths.filter((p) => p.uses > 0.2);

  for (const person of state.people) {
    const id = person.id, prev = previous.bodies[id];
    const glide = !!prev.skills?.glide;
    if (person.tired) {
      world.bodies[id] = { ...prev };
      if (time - person.tired >= TIRED_FOR) {
        // A newcomer takes the place, knowing nothing yet.
        Object.assign(person, { energy: 0.6, carrying: null, memory: {}, known: [], task: null, wait: 1, failures: 0, tired: 0, generation: person.generation + 1, born: time, lastNode: null, lastLookout: -99 });
        state.stats.births++;
        record(state, time, "born", { id });
      }
      continue;
    }
    observe(person, prev, state, sight, time);
    person.energy -= dt * (0.0035 + (person.carrying ? 0.002 : 0));
    if (person.energy <= 0) {
      person.energy = 0; person.tired = time; person.task = null; person.carrying = null;
      world.bodies[id] = { ...prev };
      record(state, time, "exhausted", { id });
      continue;
    }
    if (person.carrying && !person.task && time - person.carriedSince > 40) person.carrying = null;
    person.wait = Math.max(0, person.wait - dt);
    if (!person.task && person.wait === 0) decide(state, person, prev, glide, world, time, scale);
    const task = person.task;
    if (!task) { world.bodies[id] = ford(prev, moved.bodies[id], state, glide, scale).body; continue; }
    const pt = target(state, task, prev);
    const { body, blocked } = ford(prev, move(prev, pt, dt, world), state, glide, scale);
    world.bodies[id] = body;
    if (blocked) {
      // An errand that ends at the water's edge is how a crossing begins.
      propose(state, "crossing", body, time, person);
      person.task = null; person.wait = 1;
      continue;
    }
    if (dist(body, pt) > 3) continue;
    if (task.via && task.via.length) { task.via.shift(); continue; }
    arrive(state, person, body, task, time, dt);
  }

  // News travels by meeting. Recent observations replace older ones.
  state.exchangeClock += dt;
  if (state.exchangeClock >= 0.5) {
    state.exchangeClock = 0;
    const people = state.people;
    for (let a = 0; a < people.length; a++) {
      if (people[a].tired) continue;
      for (let b = a + 1; b < people.length; b++) {
        if (people[b].tired) continue;
        const p = world.bodies[a], q = world.bodies[b];
        if (dist(p, q) > (p.radius + q.radius) * 0.9) continue;
        mergeMemory(people[a].memory, people[b].memory);
        mergeMemory(people[b].memory, people[a].memory);
        for (const id of people[b].known) if (!people[a].known.includes(id)) people[a].known.push(id);
        for (const id of people[a].known) if (!people[b].known.includes(id)) people[b].known.push(id);
        state.stats.exchanges++;
      }
    }
  }
  const crossing = crossingOf(state);
  for (let i = 0; i < world.bodies.length; i++) {
    if (previous.bodies[i].skills?.glide || bankOf(previous.bodies[i].y, state.creekY) === bankOf(world.bodies[i].y, state.creekY)) continue;
    state.stats.deckCrossings++;
    if (crossing?.done) crossing.uses++;
  }
  return { state, world };
}

// ---------- drawing ----------
// Everything below turns state into clean primitives for the hand rules.
// Structures are assembled from the same module vocabulary as the bodies.


function placed(marks, prims, cx, cy, unit) {
  for (const prim of prims) marks.push({ ...prim, points: prim.points.map((q) => ({ x: cx + q.x * unit, y: cy + q.y * unit })) });
}
function module(kind, params, size, extra = {}) {
  return { kind, params, size, phase: 0, angle: 0, at: 0, role: "body", ...extra };
}
function tuft(marks, x, y, h, lean) {
  marks.push({ points: [{ x, y }, { x: x + lean * h * 0.15, y: y - h }], closed: false, solid: false });
  marks.push({ points: [{ x: x + lean * h * 0.06, y: y - h * 0.45 }, { x: x - h * 0.28, y: y - h * 0.7 }], closed: false, solid: false });
  marks.push({ points: [{ x: x + lean * h * 0.1, y: y - h * 0.7 }, { x: x + h * 0.3, y: y - h * 0.92 }], closed: false, solid: false });
}

export function settlementMarks(state, world) {
  const marks = [], s = placeScale(world), unit = 34 * s;
  const line = (points) => marks.push({ points, closed: false, solid: false });
  const loop = (points, solid = false) => marks.push({ points, closed: true, solid });

  // The creek, present before anything is built.
  for (const offset of [-4, 4]) {
    const pts = [];
    for (let x = -10; x <= world.width + 10; x += 22) pts.push({ x, y: state.creekY + offset * s + Math.sin(x / 37 + offset) * 2.5 * s });
    line(pts);
  }

  for (const p of state.patches) {
    const fill = p.stock / p.cap;
    if (p.kind === "food") {
      line([{ x: p.x - 16 * s, y: p.y + 3 * s }, { x: p.x + 14 * s, y: p.y + 4 * s }]);
      const n = Math.ceil(fill * 5);
      for (let i = 0; i < n; i++) {
        const a = (i / 5) * Math.PI * 2 + p.id;
        tuft(marks, p.x + Math.cos(a) * 11 * s, p.y + Math.sin(a) * 5 * s, (7 + 7 * fill) * s, i % 2 ? 1 : -1);
      }
    } else {
      const n = Math.max(1, Math.ceil(p.stock / 3));
      for (let i = 0; i < n; i++) {
        const prims = moduleGeometry(module("lattice", { shape: "octa", spinX: 0.4 + i * 0.3, spinY: 0.9 + i * 0.5 }, 0.5), 1.2 + i, {});
        placed(marks, prims, p.x + (i - (n - 1) / 2) * 20 * s, p.y - 4 * s, unit * 0.8);
      }
      line([{ x: p.x - 18 * s, y: p.y + 6 * s }, { x: p.x + 18 * s, y: p.y + 6 * s }]);
    }
  }

  for (const site of state.sites) {
    const { x, y } = site, p = site.done ? 1 : site.delivered / site.need;
    const local = (pts) => line(pts.map(([dx, dy]) => ({ x: x + dx * s, y: y + dy * s })));
    if (!site.done) {
      // A site: corner ticks, and the pile of what has been brought so far.
      local([[-22, 8], [-18, 8], [-18, 4]]); local([[22, 8], [18, 8], [18, 4]]);
      for (let i = 0; i < site.delivered; i++) loop([[-30, 14], [-24, 14], [-24, 8], [-30, 8]].map(([dx, dy]) => ({ x: x + (dx + (i % 3) * 7) * s, y: y + (dy - Math.floor(i / 3) * 7) * s })));
    }
    if (site.kind === "crossing") {
      const half = 16 * p;
      for (const dx of [-9, 9]) local([[dx, -half], [dx, half]]);
      const planks = Math.floor(p * 7);
      for (let k = 0; k < planks; k++) local([[-9, -14 + k * 4.7], [9, -14 + k * 4.7]]);
    } else if (site.kind === "store") {
      const boxes = Math.max(1, Math.ceil(p * 4));
      if (p > 0) placed(marks, moduleGeometry(module("boxes", { count: boxes }, 1.0 * (boxes / 4)), 0, {}), x, y + 10 * s, unit);
      if (site.done) { local([[-16, -24], [0, -38], [16, -24]]); local([[-18, -24], [18, -24]]); }
      for (let i = 0; i < Math.floor(site.stock); i++) {
        const cx = x + (-14 + (i % 4) * 9) * s, cy = y + (16 - Math.floor(i / 4) * 6) * s;
        loop([0, 1, 2, 3, 4, 5].map((k) => ({ x: cx + Math.cos((k / 6) * Math.PI * 2) * 2.2 * s, y: cy + Math.sin((k / 6) * Math.PI * 2) * 2.2 * s })), true);
      }
    } else if (site.kind === "lookout") {
      const h = 52 * p;
      local([[-12, 10], [-4, 10 - h]]); local([[12, 10], [4, 10 - h]]);
      if (p > 0.3) local([[-10, 10 - h * 0.45], [10, 10 - h * 0.45]]);
      if (p > 0.6) local([[-6, 10 - h], [6, 10 - h]]);
      if (p > 0.7) placed(marks, moduleGeometry(module("lattice", { shape: "octa", spinX: 0.5, spinY: 0.7 }, 0.42 * ((p - 0.7) / 0.3)), 0.9, {}), x, y + 10 * s - h * s - 9 * s, unit);
      if (site.done) placed(marks, moduleGeometry(module("eye", { cilia: 8 }, 0.34), 0, {}), x, y - 62 * s, unit);
    } else if (site.kind === "garden") {
      const posts = Math.floor(p * 9);
      for (let k = 0; k < posts; k++) local([[-28 + k * 7, 6], [-28 + k * 7, -6]]);
      if (site.done) local([[-30, 0], [30, 0]]);
      const plants = Math.floor(site.stock);
      for (let i = 0; i < plants; i++) tuft(marks, x + (-20 + i * 13) * s, y + 4 * s, (6 + 12 * site.condition) * s, i % 2 ? 1 : -1);
    }
    if (site.done && site.uses > 0) {
      for (let i = 0; i < Math.min(5, Math.floor(site.uses / 2)); i++) local([[-24 + i * 12, 21], [-20 + i * 12, 22]]);
    }
  }

  // What a creature carries, and who is lying down.
  for (const person of state.people) {
    const b = world.bodies[person.id];
    if (!b) continue;
    const y = b.y - b.radius * 0.55;
    if (person.carrying === "material") loop([{ x: b.x - 4 * s, y: y - 4 * s }, { x: b.x + 4 * s, y: y - 4 * s }, { x: b.x + 4 * s, y: y + 3 * s }, { x: b.x - 4 * s, y: y + 3 * s }]);
    else if (person.carrying === "food") loop([0, 1, 2, 3, 4, 5].map((k) => ({ x: b.x + Math.cos((k / 6) * Math.PI * 2) * 2.4 * s, y: y + Math.sin((k / 6) * Math.PI * 2) * 2.4 * s })), true);
    if (person.tired) for (let k = 0; k < 3; k++) line([{ x: b.x - 6 * s + k * 5 * s, y: y - 8 * s - k * 3 * s }, { x: b.x - 2 * s + k * 5 * s, y: y - 8 * s - k * 3 * s }]);
  }
  return marks;
}

// Short footsteps accumulate into routes without outlining a network.
export function settlementTrailMarks(state, world) {
  const marks = [], s = placeScale(world);
  const point = (key) => (key[0] === "p" ? state.patches[Number(key.slice(1))] : state.sites[Number(key.slice(1))]);
  for (const path of state.paths) {
    const a = point(path.a), b = point(path.b);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
    const pieces = Math.ceil(d / 9), strength = Math.min(1, path.uses / 5);
    for (let i = 0; i < pieces; i++) {
      if (((i * 7) % 11) / 11 > strength) continue;
      const at = (t) => {
        const bend = Math.sin(t * Math.PI) * 16 * s;
        return { x: a.x + dx * t - (dy / d) * bend, y: a.y + dy * t + (dx / d) * bend };
      };
      marks.push({ points: [at(i / pieces), at((i + 0.35) / pieces)], closed: false, solid: false });
    }
  }
  return marks;
}
