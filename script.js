const closedInput = document.querySelector("[data-closed]");

if (closedInput) {
  const strip = document.querySelector("[data-year]");
  const closedCount = document.querySelector("[data-closed-count]");
  const resultElement = document.querySelector("[data-result]");
  const paceElement = document.querySelector("[data-pace]");
  const DECISIONS = 10;
  // A fixed order so the same decisions stay closed as the slider moves.
  const closeOrder = [1, 4, 7, 2, 9, 5, 0, 8, 3, 6];

  const readClosed = () => {
    const parsed = Number.parseInt(closedInput.value, 10);
    return Number.isFinite(parsed)
      ? Math.max(0, Math.min(DECISIONS, parsed))
      : 0;
  };

  const describe = (closed) => {
    const open = DECISIONS - closed;
    if (closed === DECISIONS) {
      return `<b>All ${DECISIONS} of your last decisions</b> came back. Nothing is still out there.`;
    }
    if (closed === 0) {
      return `<b>None of your last ${DECISIONS} decisions</b> came back. All of them are still out there. Whatever they had to teach, nobody learned.`;
    }
    const others = open === 1 ? "The other one is" : `The other ${open} are`;
    const taught = open === 1 ? "Whatever it had to teach" : "Whatever they had to teach";
    return `<b>${closed} of your last ${DECISIONS} decisions</b> came back. ${others} still out there. ${taught}, nobody learned.`;
  };

  const paceFor = (closed) => {
    if (closed === DECISIONS) {
      return "Every decision returns. Either the organisation is very small, or very honest.";
    }
    if (closed >= 8) return "Most decisions return. The ones that do not are worth naming.";
    if (closed >= 5) return "About half return. The organisation learns from a coin flip.";
    if (closed >= 2) return "Most decisions vanish. The organisation decides more than it learns.";
    if (closed === 1) return "One came back. The organisation is almost never wrong, so it almost never learns.";
    return "Nothing comes back. The organisation cannot be wrong, which means it cannot learn.";
  };

  const drawYear = (closed) => {
    strip.textContent = "";
    const closedSet = new Set(closeOrder.slice(0, closed));
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < DECISIONS; index += 1) {
      const decision = document.createElement("span");
      decision.className = closedSet.has(index) ? "decision closed" : "decision open";
      fragment.appendChild(decision);
    }
    strip.appendChild(fragment);
  };

  const update = () => {
    const closed = readClosed();
    closedCount.textContent = String(closed);
    drawYear(closed);
    resultElement.innerHTML = describe(closed);
    paceElement.textContent = paceFor(closed);
  };

  closedInput.addEventListener("input", update);
  update();
}

const contactName = ["hel", "lo"].join("");
const contactHost = ["alter", "idad", ".org"].join("");
const contactAddress = `${contactName}@${contactHost}`;
const contactSubject = document.body.classList.contains("book-page")
  ? "Culture Decides"
  : "Building something with you";

document.querySelectorAll("[data-contact]").forEach((contactLink) => {
  contactLink.href =
    `mailto:${contactAddress}?subject=${encodeURIComponent(contactSubject)}`;
  contactLink.setAttribute("aria-label", `Write to Ginés at ${contactAddress}`);
});
