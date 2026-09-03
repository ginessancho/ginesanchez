# ginesanchez

A small personal site for Ginés Sánchez.

No build step and no runtime dependencies: open `index.html` directly or serve
the directory with any static file server.

The bestiary (`bestiary/`) is plain ES modules. Its grammar, pose engine and
hand rules are pure and tested with Node's built-in runner:

    node --test bestiary/test.js
