// An imagined continuation of the settlement. Work and word use, rather than
// elapsed time, unlock each era. Coordinates are in the 960 x 540 drawing.

export const ERAS = [
  { name: "The settlement", word: "know", action: "Build a lookout, then turn a word into a shared map.", need: 4 },
  { name: "Many settlements", word: "share", action: "Carry a discovery between separate groups.", need: 4 },
  { name: "Type I · a planet", word: "learn", action: "Build an energy network that replenishes what the planet uses.", need: 5 },
  { name: "Type II · a star", word: "create", action: "Build a swarm of collectors and keep it working.", need: 6 },
  { name: "Type III · a galaxy", word: "see", action: "Join star systems so discoveries can travel between them.", need: 5 },
];

export const SIZE = { width: 960, height: 540 };
const SOURCE = { x: 480, y: 70 };
const LOOKOUT = { x: 485, y: 254 };
const SETTLEMENTS = [{ x: 180, y: 310 }, { x: 480, y: 245 }, { x: 780, y: 320 }];
const LINKS = [[0, 1], [1, 2], [0, 1], [1, 2]];
const PLANET = { x: 480, y: 285 };
const STAR = { x: 500, y: 265 };
export const SYSTEMS = [
  { x: 154, y: 320 }, { x: 300, y: 188 }, { x: 438, y: 302 },
  { x: 580, y: 172 }, { x: 720, y: 308 }, { x: 836, y: 188 },
];
export const GALAXY_LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
const SPEED = 105;

const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const ring = (cx, cy, rx, ry, i, count, phase = -Math.PI / 2) => {
  const angle = phase + i / count * Math.PI * 2;
  return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
};

export function workSource(era) {
  return [
    { x: 238, y: 406 }, { x: 480, y: 245 }, { x: 480, y: 285 },
    { x: 216, y: 396 }, { x: 154, y: 320 },
  ][era];
}

export function workTarget(era, index) {
  if (era === 0) return LOOKOUT;
  if (era === 1) {
    const [a, b] = LINKS[index % LINKS.length];
    return midpoint(SETTLEMENTS[a], SETTLEMENTS[b]);
  }
  if (era === 2) return ring(PLANET.x, PLANET.y, 153, 112, index, 5);
  if (era === 3) return ring(STAR.x, STAR.y, 180, 146, index, 6);
  const [a, b] = GALAXY_LINKS[index % GALAXY_LINKS.length];
  return midpoint(SYSTEMS[a], SYSTEMS[b]);
}

export function wordTarget(era) {
  return [LOOKOUT, SETTLEMENTS[1], PLANET, STAR, SYSTEMS[2]][era];
}

function startPeople(era) {
  const source = workSource(era);
  return Array.from({ length: 6 }, (_, id) => ({
    id, x: source.x + (id % 3 - 1) * 26, y: source.y + Math.floor(id / 3) * 30,
    heading: -Math.PI / 2, job: "pickup", carrying: false, targetIndex: null,
  }));
}

export function createCivilization() {
  return {
    era: 0, phase: "build", time: 0, eraTime: 0, progress: 0,
    wordSource: SOURCE,
    contributors: [], word: "inText", wordUsedBy: [], ready: false,
    people: startPeople(0), knowledge: [true, false, false, false, false, false],
    energy: 4, stableFor: 0, propagationClock: 0,
  };
}

export function placeWordSource(input, point) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return input;
  return { ...input, wordSource: { x: point.x, y: point.y } };
}

export function continueCivilization(input) {
  if (!input.ready || input.era >= ERAS.length - 1) return input;
  const era = input.era + 1;
  return {
    ...input, era, phase: "word", eraTime: 0, progress: 0,
    contributors: [], word: "inText", wordUsedBy: [], ready: false,
    people: startPeople(era), knowledge: era === 4 ? [true, false, false, false, true, false] : [true, false, false, false, false, false],
    energy: era === 3 ? 2 : 4, stableFor: 0, propagationClock: 0,
  };
}

const move = (person, target, dt) => {
  const dx = target.x - person.x, dy = target.y - person.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= SPEED * dt) {
    person.x = target.x; person.y = target.y;
    return true;
  }
  person.heading = Math.atan2(dy, dx);
  person.x += dx / distance * SPEED * dt;
  person.y += dy / distance * SPEED * dt;
  return false;
};

function build(state, dt) {
  const source = workSource(state.era);
  const need = ERAS[state.era].need;
  for (const person of state.people) {
    if (state.progress >= need && state.contributors.length >= 2) break;
    if (person.job === "pickup") {
      if (move(person, source, dt)) {
        person.carrying = true;
        person.targetIndex = Math.min(need - 1, state.progress + person.id % 2);
        person.job = "deliver";
      }
    } else if (move(person, workTarget(state.era, person.targetIndex), dt)) {
      person.carrying = false;
      person.job = "pickup";
      state.progress = Math.min(need, state.progress + 1);
      if (!state.contributors.includes(person.id)) state.contributors.push(person.id);
    }
  }
  if (state.progress >= need && state.contributors.length >= 2) {
    state.people.forEach((person) => { person.carrying = false; person.job = "idle"; });
    state.phase = state.era === 0 ? "word" : "verify";
  }
}

function borrowWord(state, dt) {
  const carrier = state.people[0];
  if (state.word === "inText") {
    if (!move(carrier, state.wordSource, dt)) return;
    state.word = "carried";
  }
  if (move(carrier, wordTarget(state.era), dt)) {
    state.word = "installed";
    carrier.job = "idle";
    state.phase = state.era === 0 ? "verify" : "build";
  }
}

function spread(state, dt) {
  state.propagationClock += dt;
  if (state.propagationClock < 1.1) return;
  state.propagationClock = 0;
  const edges = state.era === 1 ? [[0, 1], [1, 2]] : GALAXY_LINKS;
  const next = [...state.knowledge];
  for (const [a, b] of edges) {
    if (state.knowledge[a]) next[b] = true;
    if (state.knowledge[b]) next[a] = true;
  }
  state.knowledge = next;
}

function verify(state, dt) {
  if (state.era === 0) {
    for (const id of [1, 2]) {
      if (state.wordUsedBy.includes(id)) continue;
      if (move(state.people[id], LOOKOUT, dt)) state.wordUsedBy.push(id);
    }
    state.ready = state.wordUsedBy.length === 2;
  } else if (state.era === 1) {
    spread(state, dt);
    state.ready = state.knowledge.slice(0, 3).every(Boolean);
  } else if (state.era === 2 || state.era === 3) {
    const production = state.era === 2 ? state.progress * 0.8 : state.progress * 1.0;
    const demand = state.era === 2 ? 2.4 : 4;
    state.energy = Math.max(0, Math.min(10, state.energy + (production - demand) * dt));
    state.stableFor = production >= demand && state.energy >= 4 ? state.stableFor + dt : 0;
    state.ready = state.stableFor >= 6;
  } else {
    spread(state, dt);
    state.ready = state.knowledge.every(Boolean) && state.contributors.length >= 3;
  }
  if (state.ready) state.phase = "ready";
}

export function advanceCivilization(input, dt) {
  if (input.ready || !Number.isFinite(dt) || dt <= 0) return input;
  const state = {
    ...input, time: input.time + dt, eraTime: input.eraTime + dt,
    people: input.people.map((person) => ({ ...person })),
    contributors: [...input.contributors], wordUsedBy: [...input.wordUsedBy],
    knowledge: [...input.knowledge],
  };
  if (state.phase === "build") build(state, dt);
  else if (state.phase === "word") borrowWord(state, dt);
  else if (state.phase === "verify") verify(state, dt);
  return state;
}
