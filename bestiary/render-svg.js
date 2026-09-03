// SVG renderer. Strokes in, two <path> elements out: one for the ink
// lines, one for the few solid accents. Nothing above this file knows
// about the DOM, so Canvas or WebGL can replace it later.

export function pathData(points) {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}

export function createSvgRenderer(svg) {
  const NS = "http://www.w3.org/2000/svg";
  const ink = document.createElementNS(NS, "path");
  ink.setAttribute("class", "ink");
  const solid = document.createElementNS(NS, "path");
  solid.setAttribute("class", "solid");
  svg.append(ink, solid);

  return function render(strokes) {
    let d = "", ds = "", weight = 1;
    for (const s of strokes) {
      weight = s.weight;
      if (s.solid) ds += pathData(s.points) + "Z";
      else d += pathData(s.points);
    }
    ink.setAttribute("d", d);
    ink.setAttribute("stroke-width", String(weight));
    solid.setAttribute("d", ds);
  };
}
