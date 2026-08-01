/* =========================================================================
   FULL DEMO — a customised blueprint from a short form.

   The design constraint that shapes this whole file: a form cannot diagnose a
   business. It can tell you which builds are RELEVANT, and it can order them.
   It cannot tell you what they cost, whether they will integrate with the
   tooling you already run, or whether your economics support any of it. So
   this page recommends confidently and then says, in detail and unprompted,
   exactly what it could not see. The gate is the product, not a disclaimer.
   ========================================================================= */

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const singular = s => String(s).replace(/(\w+)$/, w => w.replace(/ies$/, "y").replace(/s$/, ""));

/* ---------- symptoms → builds --------------------------------------------
   Weights, not flags. Several symptoms point at the same build, and a build
   named by three separate answers should outrank one named once. */
const SYMPTOMS = [
  { id: "slow",    text: "Enquiries sit for hours before anyone replies",        hits: { SPEED: 3, RESCUE: 1 } },
  { id: "missed",  text: "We miss calls and don't always ring back",             hits: { RESCUE: 3, SPEED: 1 } },
  { id: "triage",  text: "I can't tell which enquiry to call first",             hits: { TRIAGE: 3 } },
  { id: "quotes",  text: "Quotes and proposals go out late, or not at all",      hits: { QUOTE: 3, SPEED: 1 } },
  { id: "chase",   text: "We give up chasing after one or two attempts",         hits: { MACHINE: 3, TRIAGE: 1 } },
  { id: "hours",   text: "Nothing happens outside office hours",                 hits: { SPEED: 2, RESCUE: 2 } },
  { id: "retype",  text: "We retype the same details into two systems",          hits: { CRM: 3 } },
  { id: "lost",    text: "Enquiries live in an inbox, not anywhere I can see",   hits: { CRM: 2, DASH: 2 } },
  { id: "dormant", text: "Old enquiries never hear from us again",               hits: { SIGNAL: 3, MACHINE: 1 } },
  { id: "numbers", text: "I couldn't tell you this week's numbers",              hits: { DASH: 3 } },
  { id: "reviews", text: "We never get round to asking for reviews",             hits: { REVIEW: 3 } },
  { id: "volume",  text: "We're not reaching enough new people at all",          hits: { MACHINE: 3, SIGNAL: 2 } },
  { id: "content", text: "We know we should post, and we don't",                 hits: { CONTENT: 3 } },
  { id: "owner",   text: "It all falls over when one person is away",            hits: { CRM: 2, TRIAGE: 2, DASH: 1 } }
];

/* Context answers nudge the ranking. A business where nobody owns enquiries
   needs triage before it needs reach; one already on a CRM does not need us
   to sell it a CRM. */
const CONTEXT_HITS = {
  qVol:   { low: { SIGNAL: 2, MACHINE: 2 }, mid: {}, high: { TRIAGE: 2, CRM: 1 } },
  qWho:   { me: { SPEED: 2, TRIAGE: 1 }, team: { CRM: 1, DASH: 1 }, nobody: { TRIAGE: 3, SPEED: 2 } },
  qHours: { wait: { SPEED: 3, RESCUE: 2 }, some: { SPEED: 1, RESCUE: 1 }, covered: {} },
  qWhere: { inbox: { CRM: 3, DASH: 1 }, sheet: { CRM: 2, DASH: 2 }, crm: { DASH: 1 } }
};

/* Total inputs a real diagnosis works from. Used for the coverage bar. This
   is deliberately a big number: the point of the bar is to show the gap. */
const DIAGNOSIS_INPUTS = 40;

let picked = new Set();

/* ---------- the form ------------------------------------------------------ */
function renderSymptoms() {
  $("#symptoms").innerHTML = SYMPTOMS.map(s =>
    `<button type="button" class="sym${picked.has(s.id) ? " on" : ""}" data-id="${s.id}">
       <span class="symtick"></span>${esc(s.text)}</button>`).join("");
  $$("#symptoms .sym").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id;
    picked.has(id) ? picked.delete(id) : picked.add(id);
    b.classList.toggle("on", picked.has(id));
    updateCount();
  }));
}

function updateCount() {
  const n = picked.size;
  $("#pickCount").textContent = n === 0
    ? "Pick at least one above."
    : `${n} picked. Add more if they apply, or build it.`;
  $("#buildBtn").disabled = n === 0;
}

function readSeg(id) { const on = $("#" + id + " button.on"); return on ? on.dataset.v : null; }

function wireSegs() {
  ["qVol", "qWho", "qHours", "qWhere"].forEach(id => {
    $$("#" + id + " button").forEach(b => b.addEventListener("click", () => {
      $$("#" + id + " button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
    }));
  });
}

/* ---------- scoring ------------------------------------------------------- */
function score() {
  const s = {};
  const add = hits => Object.entries(hits || {}).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
  SYMPTOMS.forEach(sym => { if (picked.has(sym.id)) add(sym.hits); });
  Object.keys(CONTEXT_HITS).forEach(q => add(CONTEXT_HITS[q][readSeg(q)]));

  const ranked = Object.entries(s).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ code: k, n: v }));
  const entry = ranked.filter(r => BUILDS[r.code].tier === "entry");
  const wantsMachine = (s.MACHINE || 0) >= 3;
  return { ranked, entry, wantsMachine, machineScore: s.MACHINE || 0 };
}

/* ---------- the blueprint ------------------------------------------------- */
function phaseCard(label, when, items, cfg) {
  const cards = items.map(code => {
    const b = BUILDS[code];
    return `<div class="bcard">
      <div class="bctop">
        <span class="bcdot" style="background:${b.col}"></span>
        <div><h4>${esc(b.name)}</h4><span class="bcdays">${esc(b.days)}</span></div>
      </div>
      <p>${esc(b.what)}</p>
      <div class="bcneed"><span class="needlab">To integrate it we need</span>${esc(b.needs)}</div>
      <a class="bclink" href="resources.html#${code}">What this involves →</a>
    </div>`;
  }).join("");
  return `<div class="phase">
    <div class="phhead"><span class="phnum">${label}</span>
      <div><h4>${when}</h4></div></div>
    <div class="bcards">${cards}</div>
  </div>`;
}

function renderPlan() {
  const cfg = PRESETS[getProfile().industry];
  const { entry, wantsMachine, machineScore } = score();
  const first = entry.slice(0, 1).map(r => r.code);
  const next = entry.slice(1, 3).map(r => r.code);
  const later = entry.slice(3, 5).map(r => r.code);

  $("#planCompany").textContent = companyName();
  $("#planHeadline").textContent = `What we'd build for ${companyName()}`;

  const nPicked = picked.size;
  const lead = BUILDS[first[0]];
  $("#planSummary").innerHTML =
    `From ${nPicked} symptom${nPicked === 1 ? "" : "s"} and four answers about how you work, the first
     thing we'd build you is the <b>${esc(lead.name.toLowerCase())}</b>: ${esc(lead.what.toLowerCase())}
     ${wantsMachine
      ? `Underneath it, what you've described is a reach problem as much as a speed one, so the full
         machine is the direction of travel rather than another single build.`
      : `You haven't described a reach problem, so we'd fix what you have before anyone talks to you
         about buying more enquiries.`}`;

  /* coverage bar: honest about how thin a form is next to a diagnosis */
  const used = nPicked + 4 + 1;                       /* symptoms + context + sector */
  const pct = Math.min(100, Math.round(used / DIAGNOSIS_INPUTS * 100));
  $("#coverBox").innerHTML = `
    <div class="covtop">
      <div>
        <h4>This blueprint is a sketch, and here's exactly how rough</h4>
        <p class="dim" style="font-size:14px;margin-top:5px">It used <b>${used}</b> inputs.
        A diagnosis call works from around <b>${DIAGNOSIS_INPUTS}</b>, most of which you can't type
        into a form because they live in your ad account, your CRM and your DNS records.</p>
      </div>
      <div class="covpct"><b>${pct}%</b><span>of a diagnosis</span></div>
    </div>
    <div class="covbar"><i style="width:${pct}%"></i></div>`;

  let html = phaseCard("01", "Week one, live and earning before anything else starts", first, cfg);
  if (next.length) html += phaseCard("02", "Weeks two and three, once the first one is proving itself", next, cfg);
  if (later.length) html += phaseCard("03", "After that, if the numbers still say so", later, cfg);
  if (wantsMachine) {
    html += `<div class="phase">
      <div class="phhead"><span class="phnum core">04</span><div><h4>The direction of travel</h4></div></div>
      <div class="bcards"><div class="bcard core">
        <div class="bctop"><span class="bcdot" style="background:${BUILDS.MACHINE.col}"></span>
          <div><h4>${esc(BUILDS.MACHINE.name)}</h4><span class="bcdays">${esc(BUILDS.MACHINE.days)}</span></div></div>
        <p>${esc(BUILDS.MACHINE.what)}</p>
        <div class="bcneed"><span class="needlab">To integrate it we need</span>${esc(BUILDS.MACHINE.needs)}</div>
        <a class="bclink" href="resources.html#MACHINE">What this involves →</a>
      </div></div></div>`;
  }
  $("#planPhases").innerHTML = html;

  $("#planRhythm").innerHTML = [
    ["Mon", "Your report, 08:00", "What came in, what got booked, what we changed and what we're doing next."],
    ["Tue", "We build what you approved", "Your Monday approvals go live the same day."],
    ["Wed", "Mid-week watch", "If cost or response time drifts, you hear it from us first."],
    ["Thu", "Tune and test", "One change at a time, so we can tell what worked."],
    ["Fri", "Optional 15 minutes", "Useful when something big is moving, skippable when it isn't."]
  ].map(r => `<div class="rt"><div class="day">${r[0]}</div><h5>${r[1]}</h5><p>${r[2]}</p></div>`).join("");

  /* the gate — personalised, specific, and the reason the call exists */
  const one = singular(cfg.enquiry);
  const gates = [
    ["What one of your " + esc(cfg.enquiry) + " actually costs",
     "This page used a sector benchmark. Your real cost per " + esc(one) + " lives in your ad account, " +
     "and it is the single number most likely to change what we'd recommend."],
    ["Whether these builds fit the tools you already run",
     "Every build above lists what it needs from you. Until we've looked at your stack we can't promise " +
     "any of it integrates cleanly, and we won't pretend otherwise on a web page."],
    ["Your deliverability position",
     "Domain age, SPF, DKIM, DMARC and your current complaint rate decide whether outbound is even safe " +
     "to switch on. Getting this wrong burns the domain your invoices go out from."],
    ["What your sector won't let us say",
     esc(cfg.label) + " has claim rules a generic form knows nothing about. We check them before a " +
     "single message is drafted, not after."],
    ["Whether you can serve the extra work",
     "More " + esc(cfg.enquiry) + " is only good news if you have the capacity to answer them. " +
     "We'd rather find your ceiling on the call than discover it in month two."],
    ["What it costs",
     "We price on the call, once we know the scope. Anyone quoting you before that is guessing, " +
     "and you'd be paying for the guess."]
  ];
  $("#gateBox").innerHTML = `
    <div class="gatehead">
      <span class="gatelock">🔒</span>
      <div>
        <h3>Six things this page can't tell you</h3>
        <p class="dim" style="font-size:14.5px;margin-top:6px;max-width:66ch">Not because we're holding
        them back. Because they aren't knowable from a form, and each one can change the plan above.
        This is what the diagnosis call is for, and why we don't take an integration on without one.</p>
      </div>
    </div>
    <div class="gategrid">
      ${gates.map((g, i) => `<div class="gitem">
        <span class="gnum">${String(i + 1).padStart(2, "0")}</span>
        <div><h4>${g[0]}</h4><p>${g[1]}</p></div>
      </div>`).join("")}
    </div>
    <div class="gatefoot">
      <span>One call, about 45 minutes, and you keep the forecast either way.</span>
      <a href="#" data-book class="btn primary">Book the diagnosis call</a>
    </div>`;

  wireBooking();
}

/* ---------- the working animation ----------------------------------------- */
const WORK = [
  "Reading your answers",
  "Matching them to what we build",
  "Ordering it so each build funds the next",
  "Marking what a form can't know",
  "Drafting your blueprint"
];

function runBuild() {
  $("#askStage").classList.add("hide");
  $("#workStage").classList.remove("hide");
  scrollTo({ top: 0, behavior: "instant" });

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gap = reduced ? 60 : 620;
  $("#workSteps").innerHTML = WORK.map(s =>
    `<div class="stage-step"><span class="ic"></span>${s}</div>`).join("");
  const rows = $$("#workSteps .stage-step");

  rows.forEach((row, i) => setTimeout(() => {
    rows.forEach(r => r.classList.remove("run"));
    row.classList.add("run");
    if (i > 0) rows[i - 1].classList.add("done");
    $("#workTitle").textContent = WORK[i] + "…";
    if (i === rows.length - 1) setTimeout(() => {
      row.classList.remove("run"); row.classList.add("done");
      $("#workStage").classList.add("hide");
      $("#planStage").classList.remove("hide");
      renderPlan();
      initReveal();
      scrollTo({ top: 0, behavior: "instant" });
    }, gap);
  }, i * gap));
}

/* ---------- init ---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderNicheSearch($("#industrySearch"), renderSymptoms);
  wireNameInput($("#bizname"));
  renderSymptoms();
  wireSegs();
  updateCount();
  applyEmbedMode();
  wireBooking();          /* the nav and intro CTAs, before any plan exists */
  $("#buildBtn").addEventListener("click", runBuild);
  $("#redoBtn").addEventListener("click", () => {
    $("#planStage").classList.add("hide");
    $("#askStage").classList.remove("hide");
    scrollTo({ top: 0, behavior: "instant" });
  });
});
