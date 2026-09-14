# ginesanchez

A small personal site for Ginés Sánchez.

No build step and no runtime dependencies: open `index.html` directly or serve
the directory with any static file server.

The bestiary (`bestiary/`) is plain ES modules. Its grammar, pose engine and
hand rules are pure and tested with Node's built-in runner:

    npm test

The homepage keeps supporting text in initially closed sections, with only
one open at a time. Twenty-four drawn creatures roam across the page background.
They start with two parts. Nearby encounters can exchange a new body part,
which grows in briefly in blue and enables springing, gliding, or striding.
The original head, body, spine, and individual pace remain. At most three parts
are visible: each new acquisition replaces the previous gift, while learned
movement is retained. Encounters have a ten-second
cooldown per creature. Population stays fixed. These are drawing rules, not a
model of biological reproduction or a claim about real organisations.

`bestiary/encounters.js` holds the exchange rules and `bestiary/roaming.js`
holds movement. `bestiary/village.js` adds a small cooperative settlement:
creatures discover nearby building sites, carry materials, contribute to a
crossing, garden, and shelter, then visit and maintain them. All three kinds
of work and at least two contributors are required to finish a structure.
Roles are learned through practice rather than assigned by body shape.

Food, rest, company, remembered collaborators, and distance influence their
next activity. Successful trips leave paths. Well-used gardens and shelters
can inspire copies, capped at five places. Unattended places weather and lose
drawing details; tending restores them. Materials are replenishable, and the
population stays fixed. This is a drawing experiment, not a model of society.
The earlier single-crossing experiment remains in `relationships.js` but is
no longer used by the homepage.

The village runs at natural speed (1×). The quiet bottom controls pause and begin again.
Escape also pauses/resumes; hidden tabs stop advancing. Reduced motion opens
a settled still scene and requires pressing Play to animate. Without JavaScript,
a static village illustration remains. The simulation lasts for the current
page visit; reloading starts a fresh world.

Regenerate the static fallback illustration after changing its drawing layout:

    node bestiary/render-landing-still.js

Typography uses locally served Newsreader (regular and italic Latin WOFF2)
for editorial text, with system sans serif controls and body copy. Font files
come from Google Fonts; their SIL Open Font License is in `fonts/OFL-Newsreader.txt`.
No external font requests are made by visitors.
