// Drawing experiment: independent paths, with optional local anticipation.
// No shared destination, leader, heading alignment, or ranking of body shapes.
export const POPULATION = 10;
const TAU = Math.PI * 2;
const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
const start = [[.12,.20],[.34,.30],[.60,.18],[.85,.28],[.19,.65],[.44,.75],[.69,.60],[.88,.79],[.47,.48],[.10,.88]];

export function createRoam(width, height) {
  const radius = Math.min(38, width / 12);
  const margin = radius * 1.65;
  return {
    width, height, time: 0, makingRoom: false,
    bodies: start.map(([u, v], id) => ({
      id, x: margin + u * (width - margin * 2), y: margin + v * (height - margin * 2),
      heading: id * 2.399, pace: 12 + (id * 7 % 17), phase: id * 1.73,
      radius, space: 1,
    })),
  };
}

export function advanceRoam(world, dt) {
  const time = world.time + dt;
  const bodies = world.bodies.map((body) => {
    // Every body keeps its own changing direction and pace in both modes.
    let heading = body.heading + Math.sin(time * .55 + body.phase) * .32 * dt;
    let vx = Math.cos(heading) * body.pace;
    let vy = Math.sin(heading) * body.pace;
    let space = 1;
    for (const other of world.bodies) {
      if (body.id === other.id) continue;
      const dx = body.x - other.x, dy = body.y - other.y;
      const distance = Math.hypot(dx, dy);
      const reach = (body.radius + other.radius) * 1.45;
      space = Math.min(space, clamp(distance / reach, 0, 1));
      if (!world.makingRoom) continue;
      // Look a little ahead and yield locally, without copying a neighbour.
      const px = dx + (Math.cos(heading) * body.pace - Math.cos(other.heading) * other.pace) * .7;
      const py = dy + (Math.sin(heading) * body.pace - Math.sin(other.heading) * other.pace) * .7;
      const ahead = Math.hypot(px, py);
      if (Math.min(ahead, distance) < reach) {
        const force = (1 - Math.min(ahead, distance) / reach) * 38;
        const angle = distance > .001 ? Math.atan2(dy, dx) : body.id * 2.399;
        vx += Math.cos(angle) * force;
        vy += Math.sin(angle) * force;
      }
    }
    const margin = body.radius * 1.65;
    let x = body.x + vx * dt, y = body.y + vy * dt;
    if ((x < margin && vx < 0) || (x > world.width - margin && vx > 0)) heading = Math.PI - heading;
    if ((y < margin && vy < 0) || (y > world.height - margin && vy > 0)) heading = -heading;
    x = clamp(x, margin, world.width - margin);
    y = clamp(y, margin, world.height - margin);
    return { ...body, x, y, heading: ((heading % TAU) + TAU) % TAU,
      // Room to unfold is measured in both modes, never awarded by the switch.
      space: body.space + (space - body.space) * Math.min(1, dt * 2),
    };
  });
  return { ...world, time, bodies };
}

export function resizeRoam(world, width, height) {
  const radius = Math.min(38, width / 12);
  const margin = radius * 1.65;
  return { ...world, width, height, bodies: world.bodies.map(body => ({ ...body, radius,
    x: clamp(body.x / world.width * width, margin, width - margin),
    y: clamp(body.y / world.height * height, margin, height - margin),
  })) };
}
