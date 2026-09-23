const contactAddress = "hello@alteridad.org";
const contactSubject = document.body.classList.contains("book-page")
  ? "Culture Decides" : "";
document.querySelectorAll("[data-contact]").forEach((link) => {
  const subject = link.dataset.subject || contactSubject;
  link.href = `mailto:${contactAddress}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  link.setAttribute("aria-label", `Write to Ginés at ${contactAddress}`);
});

// All panels remain readable as a regular page when JavaScript is unavailable.
const chapterLinks = [...document.querySelectorAll(".chapter-link")];
const chapterPanels = [...document.querySelectorAll(".chapter-panel")];
const panelsById = new Map(chapterPanels.map((panel) => [panel.id, panel]));

function showChapter(id, scroll = false) {
  for (const panel of chapterPanels) panel.hidden = panel.id !== id;
  for (const link of chapterLinks) {
    link.setAttribute("aria-expanded", String(link.hash.slice(1) === id));
  }
  if (scroll && panelsById.has(id)) panelsById.get(id).scrollIntoView();
}

function revealHash() {
  const target = document.getElementById(location.hash.slice(1));
  const panel = target?.closest(".chapter-panel");
  showChapter(panel?.id ?? null, Boolean(panel));
}

showChapter(null);
revealHash();
addEventListener("hashchange", revealHash);
addEventListener("popstate", revealHash);

for (const link of chapterLinks) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const id = link.hash.slice(1);
    const nextId = panelsById.get(id)?.hidden ? id : null;
    showChapter(nextId);
    history.pushState(null, "", nextId ? `#${nextId}` : location.pathname + location.search);
  });
}

// Links inside a panel can open another panel, including when the hash is unchanged.
for (const link of document.querySelectorAll('a[href^="#"]:not(.chapter-link)')) {
  link.addEventListener("click", (event) => {
    const panel = panelsById.get(link.hash.slice(1));
    if (!panel) return;
    event.preventDefault();
    showChapter(panel.id, true);
    history.pushState(null, "", link.hash);
  });
}
