# ginesanchez

A small personal site for Ginés Sánchez.

No build step and no runtime dependencies: open `index.html` directly or serve
the directory with any static file server.

The bestiary (`bestiary/`) is plain ES modules. Its grammar, pose engine and
hand rules are pure and tested with Node's built-in runner:

    npm test

The homepage places four section links side by side. Selecting one opens its
content across the full width below them and closes any other open section.
Without JavaScript, all sections remain readable in page order. Behind the
text, twenty-four drawn creatures live in a small settlement that grows out of what they need, notice, tell one another
and build together. `bestiary/settlement.js` holds that model as pure state;
`bestiary/roaming.js` holds free movement and `bestiary/encounters.js` the
exchange of body parts between creatures that meet.

The settlement, in the order things tend to happen:

- A creek runs across the foot of the page. The far bank is richer. Nobody
  can cross on foot; a creature that has picked up a gliding part can.
- Energy drains. Food patches feed and run out; they regrow with a slow
  season of plenty and scarcity. A creature only knows the patches it has
  seen or been told about, and news can go stale.
- A felt need proposes a site: wanting food across the water proposes a
  crossing, surplus with nowhere to keep it proposes a store, arriving
  twice at food that was already gone proposes a lookout, eating the last
  of a patch proposes a garden.
- Sites are built from material carried from quarries, and the last unit
  only counts once two different creatures have contributed.
- Each structure changes what is possible next: the crossing opens the far
  bank to everyone, the store lets surplus outlive plenty, the lookout pools
  what its visitors know, gardens grow food where it is tended.
- Well-used routes are drawn in and unused ones fade. An exhausted creature
  lies down and is replaced by a newcomer who knows nothing; only places,
  paths and other creatures remember.

Structures are drawn from the same module vocabulary as the bodies. Nothing
in the model ranks body shapes, and there is no leader or shared goal; it is
a drawing experiment, not a model of society. The simulation runs at natural
speed only. The quiet bottom controls pause and begin again; Escape also
pauses and resumes; hidden tabs stop advancing. Reduced motion opens a
settled still scene and requires pressing Play to animate. Without
JavaScript, a static illustration remains. The world resets on reload.

Regenerate the static fallback illustration after changing its drawing layout:

    node bestiary/render-landing-still.js

The homepage uses locally served Newsreader (regular and italic Latin WOFF2)
at one reading size, with smaller section links. Font files come from Google
Fonts; their SIL Open Font License is in `fonts/OFL-Newsreader.txt`.
No external font requests are made by visitors.
