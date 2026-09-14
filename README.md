# ginesanchez

A small personal site for Ginés Sánchez.

No build step and no runtime dependencies: open `index.html` directly or serve
the directory with any static file server.

The bestiary (`bestiary/`) is plain ES modules. Its grammar, pose engine and
hand rules are pure and tested with Node's built-in runner:

    npm test

The landing page reuses the drawing engine for a small discovery-sharing
experiment. `bestiary/learning.js` contains its pure model: information travels
one connection per exchange and action follows receipt. The population is
fixed across viewport sizes. The homepage keeps all extra content in initially closed sections, with only
one open at a time. The bestiary pauses when its section closes and supports pause/manual
steps, and uses manual steps for reduced motion.

Regenerate the static fallback illustration after changing its drawing layout:

    node bestiary/render-landing-still.js
