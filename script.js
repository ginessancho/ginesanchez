const contactAddress = "hello@alteridad.org";
const contactSubject = document.body.classList.contains("book-page")
  ? "Culture Decides" : "";
document.querySelectorAll("[data-contact]").forEach((link) => {
  const subject = link.dataset.subject || contactSubject;
  link.href = `mailto:${contactAddress}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  link.setAttribute("aria-label", `Write to Ginés at ${contactAddress}`);
});

// Native name grouping also works without JavaScript in supporting browsers.
// Keep the same one-at-a-time behaviour in older browsers.
const chapters = [...document.querySelectorAll(".chapter")];
function closeOtherChapters(current) {
  for (const chapter of chapters) {
    if (chapter !== current) chapter.open = false;
  }
}
for (const chapter of chapters) {
  chapter.addEventListener("toggle", () => {
    if (chapter.open) closeOtherChapters(chapter);
  });
}

// Native disclosures work without JavaScript; direct links open their section.
function revealSection() {
  const target = document.getElementById(location.hash.slice(1));
  const section = target?.closest("details");
  if (section instanceof HTMLDetailsElement) {
    closeOtherChapters(section);
    section.open = true;
    target.scrollIntoView();
  }
}
revealSection();
addEventListener("hashchange", revealSection);

// A link must reopen its section even when the URL already has that hash.
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", () => {
    if (link.hash === location.hash) revealSection();
  });
});
