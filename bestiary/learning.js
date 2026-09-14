// One tick is an exchange, not real time. Shape has no bearing on who learns.
export const POPULATION = 10;
export const LOCAL_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
  [5, 6], [6, 7], [7, 8], [8, 9], [9, 5],
];
export const BRIDGE = [4, 5];

export function createWorld() {
  return {
    tick: 0, revision: 0, connected: false, source: 0,
    nodes: Array.from({ length: POPULATION }, () => ({ heard: 0, acted: 0 })),
    transmissions: [],
  };
}

export function discover(world) {
  const revision = world.revision + 1;
  const source = world.revision % 2 === 0 ? 0 : 7;
  return {
    ...world, revision, source, transmissions: [],
    nodes: world.nodes.map((node, i) => i === source ? { ...node, heard: revision } : { ...node }),
  };
}

export function exchange(world) {
  if (!world.revision) return world;
  // Read the old snapshot throughout: no multi-hop transmission in one tick.
  // Action follows information already received, one exchange later.
  const nodes = world.nodes.map((node) => ({ ...node, acted: node.heard }));
  const transmissions = [];
  const links = world.connected ? [...LOCAL_LINKS, BRIDGE] : LOCAL_LINKS;
  for (const [a, b] of links) {
    for (const [from, to] of [[a, b], [b, a]]) {
      const revision = world.nodes[from].heard;
      if (revision > nodes[to].heard) {
        nodes[to].heard = revision;
        transmissions.push({ from, to, revision });
      }
    }
  }
  return { ...world, tick: world.tick + 1, nodes, transmissions };
}

export function countWorld(world) {
  if (!world.revision) return { heard: 0, acted: 0, outdated: 0 };
  return {
    heard: world.nodes.filter((node) => node.heard === world.revision).length,
    acted: world.nodes.filter((node) => node.acted === world.revision).length,
    outdated: world.nodes.filter((node) => node.acted > 0 && node.acted < world.revision).length,
  };
}
