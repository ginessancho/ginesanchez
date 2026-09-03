# Bestiary — design

Date: 2026-09-03
Status: approved in conversation, ready for an implementation plan

## Purpose

A page at `/bestiary/` where organisms drawn in Ginés's sketchbook grammar
take form and move. It is the first home for a small engine that turns a
body plan into an inked, boiling, moving creature. The engine is
renderer-agnostic so the same creatures can later be drawn with Canvas or
WebGL, or bound to the decision ledger on the homepage, without a rewrite.

## Source style (what the engine must preserve)

Inferred from eight sketchbook pages:

- **Bodies are assembled, not outlined.** A creature is a spine (one line)
  with modules hung on it.
- **Rigid meets wobbly.** Wireframe lattices, box stacks and staircases sit
  beside spirals, scribble knots and hairy stalks.
- **One ink weight, no fills.** Black on white. Solid accents are small:
  triangles, cones, hats. Density comes from hatching.
- **Everything has a heading.** Beaks, arrows, leading triangles.
- **Populations, not heroes.** A page is a colony of thumbnails.
- **The hand is in the line.** Tremor, overshoot, loops that do not close,
  doubled strokes.

## Page

- `bestiary/index.html`, same head pattern, same `../styles.css`, no build
  step, no dependencies.
- White paper, black ink. The site blue is reserved for one accent at most
  (the reseed control).
- Content: a title line, one sentence, and the field. One control: reseed.
  No sliders, no panels.
- Honours `prefers-reduced-motion`: field renders once, no boil, no drift.
- Sitemap gets one entry. `llms.txt` gets one line.

## Architecture

Four layers, each a pure function of the one above it except the renderer.

```
plan (data)  →  pose (per frame)  →  strokes (polylines)  →  renderer
```

### 1. Grammar (plan generation)

A plan is plain data:

```js
{
  seed, species,
  spine: [{x, y}, ...],          // 2–5 control points, local space
  heading: radians,
  modules: [
    { kind, at, size, angle, phase, params }   // at ∈ [0,1] along spine
  ]
}
```

Module catalogue, drawn from the pages:

| kind      | what it is                          | oscillator                 |
|-----------|-------------------------------------|----------------------------|
| burst     | radial strokes from a point         | pulse (radius)             |
| spiral    | inward spiral                       | wind / unwind (turns)      |
| pinwheel  | fan of triangles                    | rotate                     |
| lattice   | 3D wireframe polyhedron             | tumble (3D rotation)       |
| beads     | line with dots                      | sway (kelp)                |
| comb      | hatching strokes                    | breathe (spacing)          |
| boxes     | stacked rectangles                  | jitter (stack shift)       |
| limb      | zigzag leg or arm                   | walk (phase-offset stride) |
| eye       | circle with cilia                   | blink / cilia flicker      |
| cone      | solid small triangle, hat or beak   | none (marks heading)       |
| knot      | scribble mass                       | random walk trail          |
| drip      | vertical strokes falling            | gravity                    |

Generation rules (weighted, seeded PRNG so a seed reproduces a creature):

- exactly one head module (burst, eye, cone, spiral, or lattice)
- zero to three limbs
- two or three body modules is the strong mode; never more than six total
- one heading; cones and leading triangles align to it
- species are weighted presets over the same rules (walker, flyer, crystal,
  kelp, tower, knot)

### 2. Pose engine

Runs at 60 fps. Input: plan, time, colony state. Output: posed geometry in
world space.

- Spine is a verlet chain with a rest shape; it sways and recovers.
- Each module evaluates its oscillator at `t + phase` and returns local
  geometry.
- Locomotion by species: walkers stride via limb phase offsets; flyers move
  along heading with a wing burst; crystals tumble in place and drift;
  kelp is anchored and sways; towers stand; knots random-walk.
- Lattice is real 3D: vertices rotated then orthographically projected.
- Colony: a light boids pass (separation strong, alignment weak, cohesion
  weak) keeps creatures drifting without overlap and inside the field.

### 3. Stroke layer

Pose becomes a list of strokes:

```js
{ points: [{x, y}, ...], weight: 1, solid: false }
```

Hand rules, applied here and nowhere else:

- overshoot: each open stroke extends a little past both ends
- loops stop short of closing by a small gap
- some strokes are doubled with a slight offset
- jitter: per-point noise, **resampled at 8 fps** while positions update at
  60 fps, so the line boils like hand-drawn animation
- one fixed stroke weight (one pen); `solid` marks the few filled accents

### 4. Renderer

Interface: `render(strokes, surface)`. SVG first: one `<path>` per stroke
group, round caps and joins, `fill: none`, `stroke: var(--ink)`. Solid
accents are filled paths. Canvas and WebGL are later implementations of the
same interface; nothing above this layer changes.

## Files

- `bestiary/index.html`
- `bestiary/bestiary.js` — one file with clear sections (grammar, pose,
  strokes, svg renderer, page). Split into modules only if it passes a few
  hundred lines.
- `bestiary/test.js` — plain Node, `node --test`, no framework. Covers
  grammar and stroke rules (pure functions).
- `sitemap.xml`, `llms.txt` — one entry each.

## Testing

- Grammar: seed reproducibility; exactly one head; module count bounds;
  cone aligns with heading.
- Strokes: overshoot extends ends; loops leave a gap; jitter changes only on
  the 8 fps tick; weight is constant.
- Pose: a walker's limbs are out of phase; a lattice's projected vertices
  move under rotation; boids keep creatures inside the field.
- Rendering: visual check in the browser; reduced-motion produces a static
  field.

## Out of scope

Canvas and WebGL renderers, binding to the ledger, any UI beyond reseed,
sound, export.

## Lineage (added 2026-09-03)

Every field after the first is bred from the one before it. `breed(plans,
seed, { mutation })` in `grammar.js` gives each child two parents from the
field: species, spine and heading from one; each part from either; then a
mutation pass that nudges sizes, phases and parameters within their ranges
and occasionally swaps, drops or adds a part. The hard rules hold across
generations. The hash is `#origin` or `#origin.generation`; a lineage is
replayed from its origin on load. The button reads "Next generation" and a
quiet label shows the generation number. No selection yet: every specimen
breeds with equal chance.
