/* =========================================================================
   FULL DEMO v2 — a free sample of the consulting, not a qualification form.

   The rebuild brief (Adam, Aug 2026): sell the future of the visitor's
   business before asking for effort. Personalise every number to their
   industry. End on a report that reads like TMA's best free work: opportunity
   tiles, a 12-month banded forecast, milestones, the goal gap, then the call.

   The honesty constraints survive the rebuild: every figure is modelled and
   marked, the central case assumes the SMALLEST improvement in each band
   (predict.js convention), and the call is framed as what it adds, never as
   an apology for what a page can't do.
   ========================================================================= */

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const singular = s => String(s).replace(/(\w+)$/, w => w.replace(/ies$/, "y").replace(/s$/, ""));

/* ---------- sector economics ---------------------------------------------
   Mirrors SECTOR_ECON in archive/predict.js (cpl band [low, mode, high],
   margin, typical starting spend, funnel-stage splits). Niches without a row
   fall back to `other`. If archive/predict.js changes, change this too. */
const ECON = {
  dental:      { spend: 1500, cpl: [28, 45, 85],   leadToCall: 0.55, callShow: 0.80 },
  aesthetics:  { spend: 1800, cpl: [22, 35, 65],   leadToCall: 0.58, callShow: 0.76 },
  hvac:        { spend: 2000, cpl: [45, 70, 130],  leadToCall: 0.62, callShow: 0.85 },
  recruitment: { spend: 1200, cpl: [70, 120, 240], leadToCall: 0.45, callShow: 0.82 },
  ifa:         { spend: 1000, cpl: [55, 95, 180],  leadToCall: 0.50, callShow: 0.78 },
  vet:         { spend: 900,  cpl: [18, 30, 55],   leadToCall: 0.65, callShow: 0.88 },
  estate:      { spend: 1200, cpl: [30, 55, 110],  leadToCall: 0.50, callShow: 0.75 },
  law:         { spend: 2000, cpl: [45, 80, 160],  leadToCall: 0.60, callShow: 0.78 },
  accounting:  { spend: 1200, cpl: [50, 90, 180],  leadToCall: 0.60, callShow: 0.75 },
  mortgage:    { spend: 1200, cpl: [35, 60, 120],  leadToCall: 0.52, callShow: 0.78 },
  msp:         { spend: 1200, cpl: [75, 150, 300], leadToCall: 0.60, callShow: 0.75 },
  agency:      { spend: 1200, cpl: [65, 130, 280], leadToCall: 0.45, callShow: 0.70 },
  construction:{ spend: 800,  cpl: [25, 55, 110],  leadToCall: 0.50, callShow: 0.75 },
  solar:       { spend: 2500, cpl: [30, 65, 130],  leadToCall: 0.45, callShow: 0.70 },
  cleaning:    { spend: 900,  cpl: [25, 55, 110],  leadToCall: 0.60, callShow: 0.75 },
  gym:         { spend: 900,  cpl: [10, 20, 38],   leadToCall: 0.45, callShow: 0.62 },
  physio:      { spend: 1000, cpl: [25, 42, 75],   leadToCall: 0.62, callShow: 0.78 },
  education:   { spend: 800,  cpl: [22, 40, 80],   leadToCall: 0.58, callShow: 0.72 },
  other:       { spend: 1500, cpl: [30, 55, 110],  leadToCall: 0.55, callShow: 0.75 }
};
const econOf = id => ECON[id] || ECON.other;

/* Conservative improvement bands, same shape and values as archive/predict.js:
   the LOW end of every band is ~1.0, the pessimistic case is "no better than
   today". The central case uses the low end too, so the typical outcome shown
   is the modest one. */
const RESP_FACTORS = { u5: [1.00, 1.03], hour: [1.02, 1.08], sameday: [1.08, 1.22], nextday: [1.18, 1.42] };
const FU_FACTORS   = { f4: [1.00, 1.03], f23: [1.04, 1.12], f01: [1.12, 1.30] };
const OOH_FACTORS  = { wait: [1.00, 1.06], some: [1.00, 1.03], covered: [1.00, 1.00] };

/* How much of a named ad budget buys genuinely NEW business rather than
   enquiries that would have arrived anyway. Applied to the reach arm only;
   the lower band counts none of it, so "today carried forward unchanged"
   stays literally true of the band's lower edge. */
const INCREMENTALITY = { mid: 0.85, hi: 1.00 };

/* Rollout ramps: recovery builds land in weeks, the machine takes months. */
const RAMP_FIX   = [0, .30, .60, .85, 1, 1, 1, 1, 1, 1, 1, 1, 1];
const RAMP_REACH = [0, 0, .25, .50, .70, .85, 1, 1, 1, 1, 1, 1, 1];

const DIAGNOSIS_INPUTS = 40;

/* ---------- symptoms → builds (weights, unchanged from v1) --------------- */
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

/* Context answers nudge the ranking, same mechanism as v1, more questions. */
const CONTEXT_HITS = {
  qRole:    { owner: { TRIAGE: 1 }, ops: { DASH: 1 }, mkt: { MACHINE: 1 } },
  qSize:    { solo: { SPEED: 1, TRIAGE: 1 }, small: {}, mid: { CRM: 1, DASH: 1 }, big: { DASH: 2 } },
  qGoal:    { steady: { DASH: 1 }, g25: {}, g50: { MACHINE: 1 }, g2x: { MACHINE: 2, SIGNAL: 1 } },
  qFirst:   { replies: { SPEED: 2 }, follow: { MACHINE: 2 }, pipeline: { CRM: 2, DASH: 2 }, reviews: { REVIEW: 2 } },
  qSuccess: { revenue: { MACHINE: 1 }, time: { QUOTE: 1, CRM: 1 }, steady: { DASH: 1, SIGNAL: 1 }, keyman: { CRM: 1, TRIAGE: 1 } },
  qResp:    { u5: {}, hour: { SPEED: 1 }, sameday: { SPEED: 2, RESCUE: 1 }, nextday: { SPEED: 3, RESCUE: 2 } },
  qFu:      { f4: {}, f23: { MACHINE: 1 }, f01: { MACHINE: 2, SIGNAL: 1 } },
  qWho:     { me: { SPEED: 2, TRIAGE: 1 }, team: { CRM: 1, DASH: 1 }, nobody: { TRIAGE: 3, SPEED: 2 } },
  qCrm:     { crm: { DASH: 1 }, sheet: { CRM: 2, DASH: 2 }, inbox: { CRM: 3, DASH: 1 }, none: { CRM: 3, TRIAGE: 1 } },
  qHours:   { wait: { SPEED: 3, RESCUE: 2 }, some: { SPEED: 1, RESCUE: 1 }, covered: {} }
};

let picked = new Set();

/* ---------- copy ----------------------------------------------------------
   Every visitor-facing string lives here so the words can move without the
   engine moving. Templates take a ctx object; keep them one-expression. */
const COPY = {
  workTitle: "Running your numbers…",
  work: (cfg, goalText) => [
    "Reading your answers",
    "Benchmarking " + companyName() + " against the " + cfg.plural + " range",
    "Costing what the leaks lose you each month",
    "Modelling three paths for the next twelve months",
    "Sizing the gap between today and " + goalText,
    "Choosing your first build, and writing it up"
  ],
  respNow: { u5: "under 5 min", hour: "within the hour", sameday: "same day", nextday: "next day or later" },
  goalLabel: { steady: "steadier months at today's size", g25: "around 25% more", g50: "around 50% more", g2x: "double or beyond" }
};

/* ---------- the form ------------------------------------------------------ */
function renderSymptoms() {
  $("#symptoms").innerHTML = SYMPTOMS.map(s =>
    `<button type="button" class="sym${picked.has(s.id) ? " on" : ""}" data-id="${s.id}"
       aria-pressed="${picked.has(s.id)}">
       <span class="symtick"></span>${esc(s.text)}</button>`).join("");
  $$("#symptoms .sym").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id;
    picked.has(id) ? picked.delete(id) : picked.add(id);
    b.classList.toggle("on", picked.has(id));
    b.setAttribute("aria-pressed", picked.has(id));
    updateCount();
  }));
}

function updateCount() {
  const n = picked.size;
  $("#pickCount").textContent = n === 0
    ? "Pick at least one above."
    : `${n} picked. Add more if they apply.`;
  $("#buildBtn").disabled = n === 0;
}

function readSeg(id) { const on = $("#" + id + " button.on"); return on ? on.dataset.v : null; }

function wireSegs() {
  $$(".seg").forEach(seg => {
    $$("button", seg).forEach(b => {
      b.setAttribute("aria-pressed", b.classList.contains("on"));
      b.addEventListener("click", () => {
        $$("button", seg).forEach(x => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
        b.classList.add("on");
        b.setAttribute("aria-pressed", "true");
      });
    });
  });
}

/* ---------- industry-personalised sliders ---------------------------------
   Adam's note: 100 enquiries means different things in different trades, so
   the ranges, steps and defaults all come from the sector preset, and they
   re-derive the moment the industry changes. */
const nice = v => {
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.round(v / mag * 2) / 2 * mag;              /* 1.5 sig figs */
};
const stepFor = range => range <= 80 ? 1 : range <= 400 ? 5 : range <= 2000 ? 25 : range <= 10000 ? 100 : 250;

function sliderSpec() {
  const cfg = PRESETS[getProfile().industry], econ = econOf(getProfile().industry);
  const L = cfg.monthlyLeads, V = cfg.avgValue;
  /* min is derived FROM the default so the step always divides (val - min),
     otherwise the browser snaps the pre-set away from the benchmark (55
     rendered as 53, £1,400 as £1,450) */
  const align = (val, minRaw, step) => Math.max(step, val - Math.floor((val - minRaw) / step) * step);
  /* max snaps onto the min+step grid too, or the end label names a figure the
     slider cannot reach */
  const snapMax = (min, max, step) => min + Math.floor((max - min) / step) * step;
  const lStep = stepFor(L * 4), vStep = stepFor(V * 3.5);
  const lMin = align(L, Math.max(2, L * 0.15), lStep);
  const vMin = align(V, Math.max(50, V * 0.25), vStep);
  return {
    leads: { min: lMin, max: snapMax(lMin, Math.max(20, nice(L * 4)), lStep), step: lStep, val: L,
             fmt: v => v + " a month" },
    value: { min: vMin, max: snapMax(vMin, nice(V * 3.5), vStep), step: vStep, val: V,
             fmt: v => fmtGBP(v) },
    close: { min: 2, max: 75, step: 1, val: cfg.closeRate, fmt: v => v + "%" },
    spend: { min: 0, max: Math.max(1000, nice(econ.spend * 4)), step: 50, val: 0,
             fmt: v => v === 0 ? "£0" : fmtGBP(v) + "/mo" }
  };
}

function paintSlider(input) {
  const p = (input.value - input.min) / (input.max - input.min) * 100;
  input.style.setProperty("--p", p + "%");
  const spec = sliderSpec()[input.dataset.k];
  const label = spec.fmt(+input.value);
  $("#v" + input.dataset.k).textContent = label;
  input.setAttribute("aria-valuetext", label);
}

function renderSliders() {
  const spec = sliderSpec();
  Object.entries(spec).forEach(([k, s]) => {
    const input = $("#in" + k);
    input.min = s.min; input.max = s.max; input.step = s.step; input.value = s.val;
    input.dataset.k = k;
    $("#e" + k).innerHTML = `<span>${esc(s.fmt(s.min))}</span><span>${esc(s.fmt(s.max))}</span>`;
    paintSlider(input);
  });
  const cfg = PRESETS[getProfile().industry];
  $("#labLeads").textContent = "New " + cfg.enquiry + " each month";
  $("#labClose").textContent = "Share of " + cfg.enquiry + " you win";
  $("#benchNote").textContent = "Each slider starts at the middle of the range we see for " +
    cfg.plural + ". Drag to correct us; the blueprint follows your numbers.";
}

function wireSliders() {
  ["leads", "value", "close", "spend"].forEach(k => {
    $("#in" + k).addEventListener("input", e => paintSlider(e.target));
  });
}

function readAnswers() {
  return {
    leads: +$("#inleads").value,
    value: +$("#invalue").value,
    close: +$("#inclose").value / 100,
    spend: +$("#inspend").value,
    role: readSeg("qRole") || "owner",
    size: readSeg("qSize") || "small",
    goal: readSeg("qGoal") || "g25",
    first: readSeg("qFirst") || "replies",
    success: readSeg("qSuccess") || "revenue",
    resp: readSeg("qResp") || "sameday",
    fu: readSeg("qFu") || "f23",
    who: readSeg("qWho") || "me",
    crm: readSeg("qCrm") || "inbox",
    hours: readSeg("qHours") || "wait"
  };
}

/* ---------- scoring ------------------------------------------------------- */
function score(a) {
  const s = {};
  const add = hits => Object.entries(hits || {}).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
  SYMPTOMS.forEach(sym => { if (picked.has(sym.id)) add(sym.hits); });
  Object.keys(CONTEXT_HITS).forEach(q => add(CONTEXT_HITS[q][a[q.slice(1).toLowerCase()]]));

  /* enquiry volume relative to the sector norm replaces the old low/mid/high
     segmented question */
  const norm = PRESETS[getProfile().industry].monthlyLeads;
  if (a.leads <= norm * 0.5) add({ SIGNAL: 2, MACHINE: 2 });
  else if (a.leads >= norm * 2) add({ TRIAGE: 2, CRM: 1 });

  const ranked = Object.entries(s).sort((x, y) => y[1] - x[1]).map(([k, n]) => ({ code: k, n }));
  const entry = ranked.filter(r => BUILDS[r.code] && BUILDS[r.code].tier === "entry");
  const wantsMachine = (s.MACHINE || 0) >= 3;
  return { ranked, entry, wantsMachine, machineScore: s.MACHINE || 0 };
}

/* ---------- the forecast --------------------------------------------------
   Transparent arithmetic, not the Monte Carlo engine: baseline from their
   three sliders, conservative recovery bands from how they answered, an
   optional reach arm at sector benchmark costs. Three series over 12 months.
   Central case = the smallest improvement in each band. Everything modelled,
   everything marked. */
function forecast(a, wantsMachine, planCodes) {
  const econ = econOf(getProfile().industry);
  const base = a.leads * a.close * a.value;
  const inPlan = (...codes) => codes.some(c => planCodes.includes(c));

  /* every improvement band must belong to a system the plan actually
     contains, or the forecast models work nobody is proposing to do */
  const ONE = [1, 1];
  const r = inPlan("SPEED", "RESCUE") ? RESP_FACTORS[a.resp] : ONE;
  const f = inPlan("MACHINE", "SIGNAL") ? FU_FACTORS[a.fu] : ONE;
  const o = inPlan("SPEED", "RESCUE") ? OOH_FACTORS[a.hours] : ONE;
  const reactivate = picked.has("dormant") && inPlan("SIGNAL") ? [0, .02, .05] : [0, 0, 0];
  const F = {
    lo: 1,
    mid: Math.min(1.6, r[0] * f[0] * o[0]) + reactivate[1],
    hi: Math.min(1.6, r[1] * f[1] * o[1]) + reactivate[2]
  };

  /* reach arm: what the named budget buys at sector benchmark cost per
     enquiry, through THEIR conversion, with an incrementality haircut.
     Only modelled when the answers actually show a reach problem. */
  let reach = { lo: 0, mid: 0, hi: 0 }, spendUsed = 0, spendAssumed = false;
  if (wantsMachine) {
    spendUsed = a.spend > 0 ? a.spend : econ.spend;
    spendAssumed = a.spend <= 0;
    const closeStage = Math.min(0.95, a.close / (econ.leadToCall * econ.callShow));
    const arm = (cpl, inc) => spendUsed / cpl * econ.leadToCall * econ.callShow * closeStage * a.value * inc;
    reach = {
      lo: 0,                       /* pessimistic case: the budget buys nothing new */
      mid: arm(econ.cpl[1], INCREMENTALITY.mid),
      hi: arm(econ.cpl[0], INCREMENTALITY.hi)
    };
  }

  const series = { lo: [], mid: [], hi: [] };
  for (let t = 0; t <= 12; t++) {
    ["lo", "mid", "hi"].forEach(k => {
      series[k].push(base * (1 + (F[k] - 1) * RAMP_FIX[t]) + reach[k] * RAMP_REACH[t]);
    });
  }
  const sum = k => series[k].slice(1).reduce((acc, v) => acc + (v - base), 0);

  /* hours back each week: handling plus chasing minutes per enquiry, with
     the automated share held at 60 to 80 percent, never 100 */
  const chaseMin = { f4: [10, 18], f23: [6, 12], f01: [2, 5] }[a.fu];
  let hLo = a.leads * (6 + chaseMin[0]) / 60 / 4.33 * 0.6;
  let hHi = a.leads * (12 + chaseMin[1]) / 60 / 4.33 * 0.8;
  if (picked.has("content")) { hLo += 2; hHi += 4; }
  if (picked.has("reviews")) { hLo += .5; hHi += 1.5; }
  if (picked.has("numbers")) { hLo += 1; hHi += 2; }
  if (picked.has("retype")) { hLo += 1; hHi += 3; }

  const goalMult = { steady: 1, g25: 1.25, g50: 1.5, g2x: 2 }[a.goal];
  return {
    base, F, reach, series, spendUsed, spendAssumed,
    added12: { mid: sum("mid"), hi: sum("hi") },
    leak: { mid: base * (F.mid - 1), hi: base * (F.hi - 1) },
    hours: { lo: hLo, hi: hHi },
    target: base * goalMult
  };
}

/* ---------- the chart ----------------------------------------------------- */
function chartSVG(fc) {
  const { series, base, target } = fc;
  const W = 720, H = 300, pL = 58, pR = 18, pT = 16, pB = 32;
  const maxY = Math.max(...series.hi, target, base) * 1.12;
  const x = t => pL + (W - pL - pR) * t / 12;
  const y = v => pT + (H - pT - pB) * (1 - v / maxY);
  const line = a => a.map((v, t) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const band = "M " + series.hi.map((v, t) => `${x(t).toFixed(1)} ${y(v).toFixed(1)}`).join(" L ") +
    " L " + [...series.lo].map((v, t) => ({ v, t })).reverse().map(p => `${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" L ") + " Z";

  /* y gridlines at three round values */
  const stepY = nice(maxY / 3.2);
  let grid = "";
  for (let v = stepY; v < maxY; v += stepY) {
    grid += `<line x1="${pL}" x2="${W - pR}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.06)"/>
      <text x="${pL - 8}" y="${y(v) + 3}" text-anchor="end" class="ct">${esc(fmtGBPk(v))}</text>`;
  }
  let ticks = "";
  for (let t = 0; t <= 12; t += 2) {
    ticks += `<text x="${x(t)}" y="${H - 10}" text-anchor="middle" class="ct">${t === 0 ? "now" : "m" + t}</text>`;
  }
  const dots = [1, 3, 6, 12].map(t =>
    `<circle cx="${x(t)}" cy="${y(series.mid[t])}" r="4" fill="#4da3ff" stroke="#000" stroke-width="1.5"/>`).join("");

  const goalLine = target > base * 1.02
    ? `<line x1="${pL}" x2="${W - pR}" y1="${y(target)}" y2="${y(target)}" stroke="#df7afe" stroke-width="2" stroke-dasharray="2 6" opacity=".8"/>
       <text x="${W - pR}" y="${y(target) - 6}" text-anchor="end" class="ct" fill="#df7afe">your aim ${esc(fmtGBPk(target))}/mo</text>`
    : "";

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Modelled monthly revenue over twelve months">
    <style>.ct{font:10.5px "JetBrains Mono",monospace;fill:rgba(142,154,168,.9)}</style>
    ${grid}
    <path d="${band}" fill="rgba(77,163,255,.14)"/>
    <line x1="${pL}" x2="${W - pR}" y1="${y(base)}" y2="${y(base)}" stroke="rgba(255,255,255,.4)" stroke-width="1.5" stroke-dasharray="5 5"/>
    <text x="${pL + 4}" y="${y(base) - 6}" class="ct">today ${esc(fmtGBPk(base))}/mo</text>
    ${goalLine}
    <polyline points="${line(series.mid)}" fill="none" stroke="#4da3ff" stroke-width="2.5" stroke-linejoin="round"/>
    <polyline points="${line(series.hi)}" fill="none" stroke="rgba(77,163,255,.35)" stroke-width="1.2"/>
    ${dots}${ticks}
  </svg>`;
}

/* ---------- the report ---------------------------------------------------- */
function phaseCard(label, when, items) {
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
  const a = readAnswers();
  const { entry, wantsMachine } = score(a);
  const first = entry.slice(0, 1).map(r => r.code);
  const next = entry.slice(1, 3).map(r => r.code);
  const later = entry.slice(3, 5).map(r => r.code);
  const planCodes = entry.slice(0, 5).map(r => r.code).concat(wantsMachine ? ["MACHINE"] : []);
  const fc = forecast(a, wantsMachine, planCodes);
  const nPicked = picked.size;
  /* lowercase for mid-sentence use, without flattening acronyms like KPI */
  const nameOf = c => BUILDS[c].name.replace(/[A-Z][a-z]+/g, w => w.toLowerCase());
  /* which stories the plan is allowed to tell about itself */
  const speedFirst = ["SPEED", "RESCUE"].includes(first[0]);
  const fastReplies = planCodes.includes("SPEED") || planCodes.includes("RESCUE") || a.resp === "u5";
  const fuFixed = planCodes.includes("MACHINE") || planCodes.includes("SIGNAL");

  $("#planCompany").textContent = companyName();
  $("#planHeadline").textContent = `What the next twelve months could hold for ${companyName()}`;

  const onePick = nPicked === 1;
  const nSym = `The ${nPicked} symptom${onePick ? "" : "s"} you picked`;
  const tightFunnel = !wantsMachine && fc.F.hi < 1.08;
  $("#planSummary").innerHTML = wantsMachine
    ? `${nSym} ${onePick ? "points" : "point"} two ways: ${esc(cfg.enquiry)}
       are slipping through, and not enough arrive to reach ${esc(COPY.goalLabel[a.goal])} even if none
       did. So we would start with the <b>${esc(nameOf(first[0]))}</b>, then widen the top of your
       pipeline. We modelled each figure below from your answers and the benchmarks we hold for
       ${esc(cfg.plural)}, and the call replaces the model with your real numbers.`
    : tightFunnel
      ? `Your reply speed and follow-up already run tight, so ${nSym.toLowerCase()} ${onePick ? "costs" : "cost"}
         you hours and visibility more than revenue. We would start with the
         <b>${esc(nameOf(first[0]))}</b>, and the forecast below stays deliberately flat: the win
         here is time and control, and the call scopes exactly that on your real numbers.`
      : `${nSym} ${onePick ? "shares" : "share"} one cause: enough
         ${esc(cfg.enquiry)} already arrive, and too many go cold before anyone answers. The
         <b>${esc(nameOf(first[0]))}</b> is where we would start, because it attacks the widest leak
         first. We modelled each figure below from your answers and the benchmarks we hold for
         ${esc(cfg.plural)}, and the call replaces the model with your real numbers.`;

  /* --- opportunity tiles --- */
  const leakOk = fc.leak.mid > fc.base * 0.02;
  $("#planTiles").innerHTML = `
    <div class="rtile"><span class="rtlab">Monthly leak</span>
      <span class="rtval">${leakOk ? `<em>${esc(fmtGBPk(fc.leak.mid))}</em>–${esc(fmtGBPk(fc.leak.hi))}` : "small"}</span>
      <span class="rtsub">${leakOk
        ? "What slow first replies and dropped follow-up cost " + esc(companyName()) + " in a typical month, on your numbers. <span class=\"modeltag\">modelled</span>"
        : "Your reply speed and follow-up already run tight. The opportunity here is time and visibility, in the tiles beside this one. <span class=\"modeltag\">modelled</span>"}</span></div>
    <div class="rtile"><span class="rtlab">Hours back</span>
      <span class="rtval"><em>${fc.hours.lo.toFixed(fc.hours.lo < 10 ? 1 : 0)}</em>–${fc.hours.hi.toFixed(fc.hours.hi < 10 ? 1 : 0)}/wk</span>
      <span class="rtsub">Owner and team hours a typical week returns once the first builds run, at 60 to 80% automation, never 100. <span class="modeltag">modelled</span></span></div>
    <div class="rtile"><span class="rtlab">First reply time</span>
      <span class="rtval">${a.resp === "u5" ? "<em>kept</em> <5m" : esc(COPY.respNow[a.resp]) + " → <em>&lt;5m</em>"}</span>
      <span class="rtsub">${a.resp === "u5"
        ? "You already reply inside five minutes. The plan keeps that true at 2am and on the days you're slammed."
        : `Your answer today, next to the under-five-minutes standard the ${speedFirst ? "first build" : "plan"} is designed to hit.`}</span></div>
    <div class="rtile"><span class="rtlab">12-month addition</span>
      <span class="rtval"><em>${esc(fmtGBPk(fc.added12.mid))}</em>–${esc(fmtGBPk(fc.added12.hi))}</span>
      <span class="rtsub">Central to upper case, added revenue across the first year, before the call refines it. <span class="modeltag">modelled</span></span></div>`;

  /* --- forecast chart --- */
  $("#chartBox").innerHTML = chartSVG(fc) + `
    <div class="flegend">
      <span><i></i>central case</span>
      <span><i class="band"></i>modelled range</span>
      <span><i class="base"></i>today, unchanged</span>
      ${fc.target > fc.base * 1.02 ? '<span><i class="goal"></i>your stated aim</span>' : ""}
      <span class="modeltag" style="margin-left:auto">modelled, not promised</span>
    </div>`;
  $("#howModel").innerHTML = `<summary>How we modelled this</summary>
    <p>We start from three of your answers: ${a.leads} ${esc(cfg.enquiry)} a month, a win rate of
    ${Math.round(a.close * 100)}%, and ${esc(String(fmtGBP(a.value)))} a customer, checked against the range we
    see for ${esc(cfg.plural)}. Each improvement range belongs to a system in the plan above and the one
    metric it touches: reply speed, follow-up persistence, out-of-hours cover. The lower band holds
    your current figures flat, the central line takes the smallest figure in each range, and the upper
    band the largest.
    ${wantsMachine ? (fc.spendAssumed
      ? `You didn't name a budget, so the reach arm models ${esc(fmtGBP(fc.spendUsed))} a month, a typical
         starting spend for ${esc(cfg.plural)}. The lower band counts none of it as new business, the
         central case prices it at the benchmark middle cost per ${esc(singular(cfg.enquiry))} and counts 85%
         of what it buys as new, and the upper case uses the low benchmark cost in full.`
      : `The reach arm models your ${esc(fmtGBP(fc.spendUsed))} a month three ways: the lower band counts
         none of it as new business, the central case prices it at the benchmark middle cost per
         ${esc(singular(cfg.enquiry))} and counts 85% of what it buys as new, and the upper case uses the low
         benchmark cost in full. If part of that budget already produces your current enquiries, the call
         nets that out.`) : ""}
    Your real cost per ${esc(singular(cfg.enquiry))} lives in your ad account, which is why the call re-runs this
    forecast on measured numbers before anything is built.</p>`;

  /* --- milestones --- */
  $("#milesBox").innerHTML = [
    ["MONTH 1", "First system live", speedFirst
      ? `The ${esc(nameOf(first[0]))} is live, designed to answer each new
         ${esc(singular(cfg.enquiry))} in under five minutes. Anything beyond the first reply waits for your yes.`
      : `The ${esc(nameOf(first[0]))} is up and earning. ${esc(BUILDS[first[0]].what)} Anything sent in
         your name waits for your yes.`,
      fmtGBPk(fc.series.mid[1]) + "/mo"],
    ["MONTH 3", fuFixed ? "The leaks closed" : "Bedded in", fuFixed
      ? `Follow-up runs to the full sequence, nothing sits unanswered, and
         the Monday 08:00 report has become how you start the week.`
      : `The next builds are live behind the first, and the Monday 08:00 report has become how you
         start the week.`,
      fmtGBPk(fc.series.mid[3]) + "/mo"],
    ["MONTH 6", wantsMachine ? "The machine at speed" : "Running without you", wantsMachine
      ? `The full machine is warmed up and working your market, on the channels your economics can carry.`
      : `The pipeline is visible end to end, and you can measure the forecast's central case against real weeks.`,
      fmtGBPk(fc.series.mid[6]) + "/mo"],
    ["MONTH 12", "The year, banked", `The system runs with you in an approval seat only, and you read the
      year's addition, modelled here as ${esc(fmtGBPk(fc.added12.mid))} to ${esc(fmtGBPk(fc.added12.hi))},
      from your accounts rather than this page.`, fmtGBPk(fc.series.mid[12]) + "/mo"]
  ].map(m => `<div class="mile"><span class="mtag">${m[0]}</span><h5>${m[1]}</h5><p>${m[2]}</p>
    <span class="mfig">${esc(m[3])} <span class="modeltag" style="margin-left:6px">modelled</span></span></div>`).join("");

  /* --- dream narrative --- */
  $("#dreamBox").innerHTML = `<span class="dtag">Where this is heading</span>
    <h3>An ordinary Monday, month six</h3>
    <p>It is 08:10 on a Monday in month six and the kettle is on. ${fastReplies
      ? `Three ${esc(cfg.enquiry)} came in overnight; each got a reply in under five minutes, and two
         have already picked a time to talk.`
      : `Three ${esc(cfg.enquiry)} came in overnight; each is already logged and ranked by how ready
         it is to buy.`} Your
    approval queue holds four drafted messages, written in your voice, waiting for your yes before
    anything sends. The 08:00 report is in your inbox: what came in last week, what got booked, what
    changed, what happens next. The ${esc(nameOf(first[0]))} has been running so long you have stopped
    checking it. You read the report with your coffee, approve the queue in four taps, and start the
    week already ahead of it.</p>`;

  /* --- goal gap --- */
  const gapBox = $("#gapBox");
  if (fc.target > fc.base * 1.02) {
    const m12 = fc.series.mid[12], hi12 = fc.series.hi[12];
    const coverage = Math.round((m12 - fc.base) / (fc.target - fc.base) * 100);
    const covered = coverage >= 100;
    const maxRef = Math.max(fc.target, hi12);
    const bar = v => Math.max(4, Math.min(100, v / maxRef * 100));
    gapBox.innerHTML = `<h3>The gap to your aim</h3>
      <p class="glead">You told us the aim is ${esc(COPY.goalLabel[a.goal])}. Here is how the modelled
      central case stacks against that by month twelve.</p>
      <div class="gbars">
        <div class="gbar now"><div class="gblab"><span>Today</span><b>${esc(fmtGBPk(fc.base))}/mo</b></div>
          <div class="gbtrack"><i style="width:${bar(fc.base)}%"></i></div></div>
        <div class="gbar model"><div class="gblab"><span>Modelled central case, month 12</span><b>${esc(fmtGBPk(m12))}/mo</b></div>
          <div class="gbtrack"><i style="width:${bar(m12)}%"></i></div></div>
        <div class="gbar goal"><div class="gblab"><span>Your stated aim</span><b>${esc(fmtGBPk(fc.target))}/mo</b></div>
          <div class="gbtrack"><i style="width:${bar(fc.target)}%"></i></div></div>
      </div>
      <p class="gnote">${covered
        ? `The central case clears your aim on these numbers. The call's job is to pressure-test that: your
           real cost per ${esc(singular(cfg.enquiry))}, your capacity, and whether the assumptions deserve to survive
           contact with your ad account.`
        : `On benchmark assumptions the central case covers about ${Math.max(0, coverage)}% of the gap
           between today and your aim. The remainder is what the diagnosis call scopes: which levers your
           real numbers say to pull, and in what order. <span class="modeltag">modelled</span>`}</p>`;
  } else {
    gapBox.innerHTML = `<h3>Your aim: steadier, at today's size</h3>
      <p class="glead">You told us predictability matters more than scale. That changes the plan's
      centre of gravity: the dashboard, the pipeline and the follow-up carry more weight than reach,
      and the forecast above is about smoothing the line. That is the plan the call maps.</p>`;
  }

  /* --- build order --- */
  let html = phaseCard("01", "Week one, live and earning before anything else starts", first);
  if (next.length) html += phaseCard("02", "Weeks two and three, once the first one is proving itself", next);
  if (later.length) html += phaseCard("03", "After that, if the numbers still say so", later);
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

  /* --- the gate, additive: what the call adds to this estimate --- */
  const one = singular(cfg.enquiry);
  const used = nPicked + 15;
  const pct = Math.min(100, Math.round(used / DIAGNOSIS_INPUTS * 100));
  const gates = [
    ["Your real cost per " + esc(one),
     "We read it from your ad account and re-run the forecast on it, swapping a benchmark for a " +
     "measured number."],
    ["Fit with your tools",
     "We map each build against the stack you already run, so the plan drops into your business " +
     "instead of beside it."],
    ["Your deliverability position",
     "We check domain history, SPF, DKIM and DMARC before outbound switches on, because outbound shares " +
     "a reputation with the domain your invoices leave from."],
    ["Your sector's claim rules",
     "We check what marketing for " + esc(cfg.plural) + " is allowed to say before we draft a " +
     "word, and we write inside those rules from the first message."],
    ["Your capacity ceiling",
     "We find the point where extra " + esc(cfg.enquiry) + " would outrun your team, and size the plan " +
     "to sit just under it."],
    ["Scoped pricing",
     "We scope the work first and price it on the call, with the arithmetic attached."]
  ];
  $("#gateBox").innerHTML = `
    <div class="gatehead">
      <span class="gatelock">🎯</span>
      <div>
        <h3>Six things the call adds</h3>
        <p class="dim" style="font-size:14.5px;margin-top:6px;max-width:66ch">This report worked from your
        ${used} answers and the benchmarks we hold for ${esc(cfg.plural)}, which is as far as honest
        modelling goes. The call works from your real accounts: around ${DIAGNOSIS_INPUTS} inputs, most of
        which live in your ad account, your CRM and your DNS records. Here is what that unlocks.</p>
      </div>
    </div>
    <div class="covbar" style="margin:18px 0 6px"><i style="width:${pct}%"></i></div>
    <p class="dim" style="font-size:12.5px;margin-bottom:14px">${pct}% of a full diagnosis, from one page.
    <span class="modeltag" style="margin-left:6px">modelled</span></p>
    <div class="gategrid">
      ${gates.map((g, i) => `<div class="gitem">
        <span class="gnum">${String(i + 1).padStart(2, "0")}</span>
        <div><h4>${g[0]}</h4><p>${g[1]}</p></div>
      </div>`).join("")}
    </div>
    <div class="gatefoot">
      <span>About 45 minutes, and this report is yours to keep either way.</span>
      <a href="#" data-book class="btn primary">Book a diagnosis call</a>
    </div>`;

  wireBooking();
  attachSummaryToBooking(bookingSummary(a, cfg, fc, first, wantsMachine));
}

/* ---------- carrying the answers to the call ------------------------------
   Adam's brief: let people send what they filled in, but only attached to a
   booking. A standalone "send us your numbers" button collects junk from
   people poking at the page; a booking costs the sender a slot, which is the
   cheapest spam filter available to a static site. So we prefill the
   scheduler's notes field instead of building an endpoint. No form, no
   inbox to police, nothing stored: the summary only exists in the URL the
   visitor themselves opens. */
function bookingSummary(a, cfg, fc, first, wantsMachine) {
  const L = [
    "From the demo blueprint (modelled, unverified):",
    "Business: " + companyName() + " · " + cfg.label,
    "Volume: " + a.leads + " " + cfg.enquiry + "/mo · win rate " + Math.round(a.close * 100) +
      "% · typical customer " + fmtGBP(a.value),
    a.spend > 0 ? "Marketing budget: " + fmtGBP(a.spend) + "/mo" : "Marketing budget: not given",
    "Goal: " + COPY.goalLabel[a.goal] + " · success looks like " +
      { revenue: "more revenue", time: "time back", steady: "predictable months",
        keyman: "less dependence on me" }[a.success],
    "Today: first reply " + COPY.respNow[a.resp] + " · " +
      { f4: "chases 4+ times", f23: "chases 2 to 3 times", f01: "chases once" }[a.fu] + " · " +
      { crm: "CRM kept current", sheet: "spreadsheet", inbox: "inbox and phone", none: "no system" }[a.crm],
    "Picked: " + SYMPTOMS.filter(s => picked.has(s.id)).map(s => s.text).join("; "),
    "Suggested first: " + BUILDS[first[0]].name + (wantsMachine ? " (reach problem flagged)" : ""),
    "Modelled 12-month addition: " + fmtGBPk(fc.added12.mid) + " to " + fmtGBPk(fc.added12.hi)
  ];
  return L.join("\n");
}

/* Append the summary to whatever wireBooking() resolved, so the scheduler
   opens with it in the notes field and the visitor can read or delete it
   before confirming. Runs after wireBooking(), never before. */
function attachSummaryToBooking(summary) {
  $$("#planStage [data-book]").forEach(a => {
    const href = a.getAttribute("href");
    if (!href || !/^https?:/i.test(href)) return;
    try {
      const u = new URL(href);
      u.searchParams.set("notes", summary);
      a.setAttribute("href", u.toString());
    } catch { /* leave the plain booking link alone */ }
  });
}

/* ---------- the working animation ----------------------------------------- */
function runBuild() {
  const cfg = PRESETS[getProfile().industry];
  const WORK = COPY.work(cfg, COPY.goalLabel[readSeg("qGoal") || "g25"]);
  $("#askStage").classList.add("hide");
  $("#workStage").classList.remove("hide");
  scrollTo({ top: 0, behavior: "instant" });

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gap = reduced ? 60 : 620;
  $("#workSteps").innerHTML = WORK.map(s =>
    `<div class="stage-step"><span class="ic"></span>${esc(s)}</div>`).join("");
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
      const h = $("#planHeadline");
      if (h) h.focus();               /* the clicked button is display:none now */
    }, gap);
  }, i * gap));
}

/* ---------- init ---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderNicheSearch($("#industrySearch"), renderSliders);
  wireNameInput($("#bizname"));
  renderSymptoms();
  wireSegs();
  renderSliders();
  wireSliders();
  updateCount();
  applyEmbedMode();
  wireBooking();
  $("#buildBtn").addEventListener("click", runBuild);
  $("#redoBtn").addEventListener("click", () => {
    $("#planStage").classList.add("hide");
    $("#askStage").classList.remove("hide");
    scrollTo({ top: 0, behavior: "instant" });
  });
});
