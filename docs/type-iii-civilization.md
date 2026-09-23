# The beasts borrow words and imagine a Type III civilization

## Core idea

The existing settlement remains the opening world. In an optional experience,
its creatures begin to borrow words from the page. A borrowed word becomes a
shared tool: it changes what the creatures can notice, remember, build, or
coordinate. The camera then follows the consequences through a sequence of
imagined eras, ending with a Type III civilization spread across a galaxy.

This is a fable made from the simulation's rules, not a prediction that a
village can become a galactic civilization in a few minutes. The world should
never advance merely because a timer fired. A transition needs an observable
event in the preceding era; a short transition can then stand for the much
longer time between eras. The beasts retain their varied bodies. No body type
is treated as more intelligent or more evolved.

## The first scene: a word leaves the page

One creature notices **know** in the story's sentence. The word briefly lifts
out of its place, leaving a same-width space. The creature carries the visible
word to a lookout after several beasts build it together. Two others read the
new sign. That shared use unlocks the next imagined era.

The implemented story uses one word in each era:

| Word | Visible use | Rule it changes |
| --- | --- | --- |
| **know** | a sign at the lookout | two other beasts read it before the story can continue |
| **share** | a sign joining settlements | a discovery travels to all three groups |
| **learn** | a planetary mark | energy sites must replenish more than the planet uses |
| **create** | a mark by the star | several beasts build a maintained collector swarm |
| **see** | a galactic sign | discoveries travel along built routes between systems |

The word must be carried and put to use. Merely collecting it does not count
as progress.

## The arc

| Era | What the viewer sees | What must happen first |
| --- | --- | --- |
| Settlement | creek, food, paths, crossing, store, gardens, lookout | several beasts finish the lookout and two others read the borrowed sign |
| Many settlements | paths and signs connect distinct groups | a borrowed word has improved a working structure and its benefit has spread |
| Type I | a planet-sized network of places and energy flows | groups coordinate a shared resource without exhausting it |
| Type II | a star and a *swarm* of collectors, with routes between habitats | distributed groups use the planetary network to construct and maintain collectors |
| Type III | a galaxy of many inhabited systems and energy routes | discoveries and resources can travel between systems without a central leader |

Each era gets a legible new behavior before the scene changes. The Type III
image is a web of unevenly lit systems, not a uniform disc or a victory badge.
This is a bounded story model, while the homepage settlement continues to run
under its existing, richer need-and-memory rules.

## How it belongs on the personal site

- Keep the main introduction fully readable. Borrow at most one word at a time
  from the optional story's non-interactive text, for only a brief visual interval. Keep its text in
  the accessibility tree and restore its visual appearance even if animation
  stops, the tab hides, or the visitor closes the experience.
- Put the long arc behind an explicit **Follow the beasts** action. The
  homepage remains a personal site with a quiet living drawing, rather than a
  game that competes with the message or email link.
- Keep Pause and Begin again. At an era boundary, offer **Continue their
  story** instead of a speed multiplier. It makes the time jump explicit while
  creature motion within each era stays at its natural pace.
- With reduced motion, present still scenes and short descriptions of the
  consequences. No word should vanish automatically.
- Build the eras as a bounded visual model: six local agents and aggregate
  networks, not simulated trillions of creatures or stars. State and drawing
  remain separate so each claimed consequence can be tested.

## Implementation

`bestiary/civilization.js` runs the five-era state machine locally. A stage
cannot advance until the word has been carried and the stage's work rule has
been met. `bestiary/civilization-art.js` renders each stage from that state;
`bestiary/civilization-page.js` handles the page, controls and borrowed-word
effect. The word returns to its text after use or whenever the story pauses or
the tab hides. No live generative AI runs for visitors.
