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

function paramsFor(kind, rand) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  switch (kind) {
    case "burst": return { rays: int(7, 12) };
    case "spiral": return { turns: 2 + rand() * 1.5 };
    case "pinwheel": return { blades: int(4, 6) };
    case "lattice": return { shape: rand() < 0.5 ? "cube" : "octa", spinX: 0.3 + rand() * 0.5, spinY: 0.5 + rand() * 0.6 };
    case "beads": return { count: int(3, 7) };
    case "comb": return { teeth: int(5, 10) };
    case "boxes": return { count: int(3, 5) };
    case "limb": return { segments: int(4, 6), side: rand() < 0.5 ? -1 : 1 };
    case "eye": return { cilia: int(6, 11) };
    case "knot": return { length: int(40, 80) };
    case "drip": return { count: int(3, 7) };
    default: return {};
  }
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
