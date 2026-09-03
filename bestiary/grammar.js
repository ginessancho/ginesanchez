// Bestiary grammar: body plans as data.
// A creature is a spine with modules hung on it. Everything is seeded, so a
// seed reproduces a creature exactly.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const KINDS = [
  "burst", "spiral", "pinwheel", "lattice", "beads", "comb",
  "boxes", "limb", "eye", "cone", "knot", "drip",
];

export const MAX_MODULES = 6;

// Local space: spine base at (0,0), up is -y, height about 1.
export const SPINES = {
  upright: [{ x: 0, y: 0 }, { x: 0, y: -0.5 }, { x: 0, y: -1 }],
  tall: [{ x: 0, y: 0 }, { x: 0, y: -0.6 }, { x: 0, y: -1.2 }, { x: 0, y: -1.7 }],
  prone: [{ x: -0.5, y: 0 }, { x: 0, y: 0 }, { x: 0.5, y: 0 }],
};

export const SPECIES = {
  walker: { heads: ["burst", "cone", "eye"], bodies: ["comb", "boxes", "beads", "pinwheel"], limbs: [2, 3], spine: "upright", mobile: true },
  flyer: { heads: ["cone"], bodies: ["burst", "pinwheel", "beads"], limbs: [0, 1], spine: "prone", mobile: true },
  crystal: { heads: ["lattice"], bodies: ["lattice", "comb"], limbs: [0, 0], spine: "upright", mobile: true },
  kelp: { heads: ["burst", "spiral"], bodies: ["beads", "beads", "spiral"], limbs: [0, 0], spine: "tall", mobile: false },
  tower: { heads: ["cone"], bodies: ["boxes", "boxes", "comb"], limbs: [0, 2], spine: "tall", mobile: false },
  knot: { heads: ["knot"], bodies: ["drip", "comb"], limbs: [0, 0], spine: "upright", mobile: true },
};

export const SPECIES_NAMES = Object.keys(SPECIES);

export const HEADS = ["burst", "eye", "cone", "spiral", "lattice", "knot"];
export const BODIES = ["comb", "boxes", "beads", "pinwheel", "burst", "lattice", "spiral", "drip"];

// Numeric parameter ranges per kind. Integers are listed in INTS.
const RANGES = {
  burst: { rays: [7, 12] },
  spiral: { turns: [2, 3.5] },
  pinwheel: { blades: [4, 6] },
  lattice: { spinX: [0.3, 0.8], spinY: [0.5, 1.1] },
  beads: { count: [3, 7] },
  comb: { teeth: [5, 10] },
  boxes: { count: [3, 5] },
  limb: { segments: [4, 6] },
  eye: { cilia: [6, 11] },
  knot: { length: [40, 80] },
  drip: { count: [3, 7] },
};
const INTS = new Set(["rays", "blades", "count", "teeth", "segments", "cilia", "length"]);

function paramsFor(kind, rand) {
  const params = {};
  for (const [key, [lo, hi]] of Object.entries(RANGES[kind] || {})) {
    params[key] = INTS.has(key) ? lo + Math.floor(rand() * (hi - lo + 1)) : lo + rand() * (hi - lo);
  }
  if (kind === "lattice") params.shape = rand() < 0.5 ? "cube" : "octa";
  if (kind === "limb") params.side = rand() < 0.5 ? -1 : 1;
  return params;
}

// Rules pulled from the pages: one head at the end of the spine, two or
// three body modules most of the time, zero to three limbs near the base,
// never more than MAX_MODULES in total. Cones and heads face the heading.
export function makePlan(seed, speciesName) {
  const rand = rng(seed);
  const species = speciesName || SPECIES_NAMES[Math.floor(rand() * SPECIES_NAMES.length)];
  const preset = SPECIES[species];
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

  let heading = -Math.PI / 2;
  if (species === "flyer") heading = rand() * Math.PI * 2;
  if (species === "walker") heading = rand() < 0.5 ? 0 : Math.PI;

  const roll = rand();
  const bodyCount = roll < 0.15 ? 1 : roll < 0.6 ? 2 : 3;
  const limbCount = Math.min(int(preset.limbs[0], preset.limbs[1]), MAX_MODULES - 1 - bodyCount);

  const module = (role, kind, at, angle, phase) => ({
    role,
    kind,
    at,
    size: 0.25 + rand() * 0.35,
    angle,
    phase,
    params: paramsFor(kind, rand),
  });

  const modules = [module("head", pick(preset.heads), 1, heading, rand() * Math.PI * 2)];
  for (let i = 0; i < bodyCount; i++) {
    const at = 0.2 + 0.6 * ((i + 0.5) / bodyCount);
    modules.push(module("body", pick(preset.bodies), at, rand() * Math.PI * 2, rand() * Math.PI * 2));
  }
  for (let i = 0; i < limbCount; i++) {
    modules.push(module("limb", "limb", 0.05 + rand() * 0.25, 0, i * Math.PI));
  }

  return {
    seed,
    species,
    heading,
    spine: SPINES[preset.spine].map((p) => ({ ...p })),
    modules,
  };
}

// ---------- lineage ----------

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function mutateParams(kind, params, rand, rate) {
  const out = { ...params };
  for (const [key, [lo, hi]] of Object.entries(RANGES[kind] || {})) {
    if (rand() >= rate) continue;
    if (INTS.has(key)) out[key] = clamp(out[key] + (rand() < 0.5 ? -1 : 1), lo, hi);
    else out[key] = clamp(out[key] + (rand() - 0.5) * 0.2 * (hi - lo), lo, hi);
  }
  if (kind === "lattice" && rand() < rate) out.shape = out.shape === "cube" ? "octa" : "cube";
  if (kind === "limb" && rand() < rate) out.side = -out.side;
  return out;
}

function mutateModule(mod, rand, rate) {
  const m = { ...mod, params: mutateParams(mod.kind, mod.params, rand, rate) };
  if (rand() < rate) m.size = clamp(m.size * (1 + (rand() - 0.5) * 0.4), 0.2, 0.7);
  if (rand() < rate) m.phase = (m.phase + (rand() - 0.5) * 0.6 + Math.PI * 2) % (Math.PI * 2);
  if (rand() < rate && m.role === "body") m.angle = (m.angle + (rand() - 0.5) * 0.6 + Math.PI * 2) % (Math.PI * 2);
  if (rand() < rate * 0.6 && m.role !== "limb") {
    const kinds = m.role === "head" ? HEADS : BODIES;
    m.kind = kinds[Math.floor(rand() * kinds.length)];
    m.params = paramsFor(m.kind, rand);
  }
  return m;
}

// The next generation of a field. Every child has two parents from the
// field: it moves like one of them (species, spine, heading) and is built
// from parts taken from both, then mutated a little. The hard rules hold:
// one head at the end of the spine, at least one body part, never more
// than MAX_MODULES. Deterministic for a seed, so a lineage replays.
export function breed(plans, seed, { mutation = 0.15 } = {}) {
  const rand = rng(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const clone = (m) => ({ ...m, params: { ...m.params } });
  const byRole = (plan, role) => plan.modules.filter((m) => m.role === role);

  return plans.map((_, i) => {
    const a = pick(plans);
    const b = pick(plans);
    const head = clone(rand() < 0.5 ? byRole(a, "head")[0] : byRole(b, "head")[0]);
    const bodiesA = byRole(a, "body"), bodiesB = byRole(b, "body");
    const bodies = bodiesA.map((m, k) => clone(rand() < 0.5 && bodiesB[k] ? bodiesB[k] : m));
    let limbs = (rand() < 0.5 ? byRole(a, "limb") : byRole(b, "limb")).map(clone);

    let modules = [head, ...bodies, ...limbs].map((m) => mutateModule(m, rand, mutation));
    let body = modules.filter((m) => m.role === "body");
    if (rand() < mutation * 0.5 && body.length > 1) {
      const drop = pick(body);
      modules = modules.filter((m) => m !== drop);
    }
    if (rand() < mutation * 0.5 && modules.length < MAX_MODULES) {
      const kind = pick(SPECIES[a.species].bodies);
      modules.push({
        role: "body", kind, at: 0.2 + rand() * 0.6, size: 0.25 + rand() * 0.35,
        angle: rand() * Math.PI * 2, phase: rand() * Math.PI * 2, params: paramsFor(kind, rand),
      });
    }
    while (modules.length > MAX_MODULES) {
      const last = modules.map((m) => m.role).lastIndexOf("limb");
      modules.splice(last >= 0 ? last : modules.length - 1, 1);
    }

    const h = modules.find((m) => m.role === "head");
    h.at = 1;
    h.angle = a.heading;

    return {
      seed: seed * 1000 + i,
      species: a.species,
      heading: a.heading,
      spine: a.spine.map((p) => ({ ...p })),
      modules,
    };
  });
}
