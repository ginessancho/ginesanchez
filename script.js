const contactAddress = "hello@alteridad.org";
const contactSubject = document.body.classList.contains("book-page")
  ? "Culture Decides" : "";
document.querySelectorAll("[data-contact]").forEach((link) => {
  link.href = `mailto:${contactAddress}${contactSubject ? `?subject=${encodeURIComponent(contactSubject)}` : ""}`;
  link.setAttribute("aria-label", `Write to Ginés at ${contactAddress}`);
});

// Native disclosures work without JavaScript; direct links open their section.
function revealSection() {
  const target = document.getElementById(location.hash.slice(1));
  const section = target?.closest("details");
  if (section instanceof HTMLDetailsElement) {
    section.open = true;
    target.scrollIntoView();
  }
}
revealSection();
addEventListener("hashchange", revealSection);
