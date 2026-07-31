/* =========================================================================
   THE LIBRARY — every system we build, grouped by where it sits in the
   pipeline. The blueprint links straight in here (resources.html#SPEED), so
   when the demo says "we'd build you a speed-to-lead responder" a prospect
   can find out what that actually involves without asking anyone.

   No prices. Same rule as the rest of the site: scoped and priced on the call.
   ========================================================================= */

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let catFilter = "all";

function byCat() {
  const out = {};
  Object.entries(BUILDS).forEach(([code, b]) => {
    (out[b.cat] = out[b.cat] || []).push({ code, ...b });
  });
  return out;
}

function renderCats() {
  const groups = byCat();
  const pick = $("#catPick");
  const cats = [["all", "Everything"]].concat(
    BUILD_CATS.filter(c => groups[c[0]]).map(c => [c[0], c[1]]));

  pick.innerHTML = cats.map(([id, label]) =>
    `<button type="button" class="pick${id === catFilter ? " on" : ""}" data-c="${id}">${esc(label)}</button>`).join("");

  $$(".pick", pick).forEach(b => b.addEventListener("click", () => {
    catFilter = b.dataset.c;
    renderCats();
    renderList();
  }));
}

function renderList() {
  const groups = byCat();
  const shown = BUILD_CATS.filter(c => groups[c[0]] && (catFilter === "all" || catFilter === c[0]));

  $("#resList").innerHTML = shown.map(([id, title, why]) => `
    <section class="resgroup" id="cat-${id}">
      <div class="reshead">
        <h3>${esc(title)}</h3>
        <p class="dim">${esc(why)}</p>
      </div>
      <div class="resgrid">
        ${groups[id].map(b => `
          <article class="rescard" id="${b.code}">
            <div class="rctop">
              <span class="rcdot" style="background:${b.col}"></span>
              <h4>${esc(b.name)}</h4>
              <span class="rcdays">${esc(b.days)}</span>
            </div>
            <p>${esc(b.what)}</p>
            <div class="rcneed"><span class="needlab">What we need from you</span>${esc(b.needs)}</div>
            <div class="rcfoot">
              <span class="chip ${b.tier === "core" ? "violet" : "blue"}">${b.tier === "core" ? "The full build" : "Entry build"}</span>
              <a href="full.html" class="rclink">Do I need this? →</a>
            </div>
          </article>`).join("")}
      </div>
    </section>`).join("");

  const n = shown.reduce((t, c) => t + groups[c[0]].length, 0);
  $("#resCount").textContent = catFilter === "all"
    ? `${Object.keys(BUILDS).length} systems, ${BUILD_CATS.length} stages`
    : `${n} system${n === 1 ? "" : "s"} in this stage`;

  initReveal();
  highlightTarget();
}

/* Arriving from the blueprint at resources.html#SPEED: open that card's
   category, scroll to it and mark it, so the link lands on the thing it
   promised rather than somewhere near it. */
function highlightTarget() {
  const code = location.hash.replace("#", "");
  if (!code || !BUILDS[code]) return;
  const el = document.getElementById(code);
  if (!el) return;
  el.classList.add("hit");
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  const code = location.hash.replace("#", "");
  if (code && BUILDS[code]) catFilter = BUILDS[code].cat;
  renderCats();
  renderList();
  wireBooking();
  applyEmbedMode();
});

window.addEventListener("hashchange", () => {
  const code = location.hash.replace("#", "");
  if (code && BUILDS[code]) {
    catFilter = BUILDS[code].cat;
    renderCats();
    renderList();
  }
});
