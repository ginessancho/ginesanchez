# ginesanchez

A small personal site for Ginés Sánchez.

No build step and no runtime dependencies: open `index.html` directly or serve
the directory with any static file server.

The bestiary (`bestiary/`) is plain ES modules. Its grammar, pose engine and
hand rules are pure and tested with Node's built-in runner:

    npm test

The homepage keeps all extra content in initially closed sections, with only
one open at a time. Its bestiary uses `bestiary/roaming.js` for independent
paths and optional local anticipation. Creatures keep their own shapes and
paces; nearby crowding determines how much space they have to unfold.
Opening the bestiary starts motion; closing it pauses. Reduced-motion visitors
get a manual step control. No animation runs behind a closed section.

Regenerate the static fallback illustration after changing its drawing layout:

    node bestiary/render-landing-still.js
