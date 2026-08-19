/* =========================================================================
   FULL DEMO v3 — the page, and only the page.

   Every number on this screen comes out of demo/engine/. This file asks the
   questions, hands the answers to the engine, and renders what comes back —
   including the times it comes back saying no. There is no arithmetic here
   beyond formatting.

   What changed from v2, and why: v2 mapped answers to benchmark multipliers,
   which cannot tell you whether two systems pull the same lever, cannot stop
   a rate passing 100%, and cannot refuse. v3 models an explicit causal chain
   per system, composes them without double-counting, propagates uncertainty
   by Monte Carlo, and declines where the inputs cannot carry a forecast.

   The honesty constraints survive the rebuild and get stricter: every figure
   is a range, every input carries a confidence tag, every recommendation
   shows its working, and the forecast is a DIFFERENCE against carrying on
   exactly as you are — never a total.
   ========================================================================= */

import { BY_ID, ENGINE_VERSION } from './engine/services.js';
import { confidenceCounts, val } from './engine/model.js';
import { forecast } from './engine/forecast.js';
import { simulate } from './engine/simulate.js';
import { refusals } from './engine/verdicts.js';
import {
  econOf, MIX, ANSWER_PHONE, RESP, inferSpareCapacity, PRICING
} from './engine/presets.js';
import { record, save } from './engine/log.js';

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const singular = s => String(s).replace(/(\w+)$/, w => w.replace(/ies$/, "y").replace(/s$/, ""));

const DIAGNOSIS_INPUTS = 40;

/* ---------- symptoms → systems -------------------------------------------
   The symptoms no longer score anything. The engine ranks on arithmetic, and
   a second, softer ranking running alongside it would just be a thumb on the
   scale. What they do instead is earn an answer: section 03 tells you where
   the thing you picked came out, including when the answer is "we would not
   build that for you". */
const SYMPTOMS = [
  { id: "slow",    text: "Enquiries sit for hours before anyone replies",      maps: ["speedlead", "inbox", "webchat"] },
  { id: "missed",  text: "We miss calls and don't always ring back",           maps: ["missedcall"] },
  { id: "triage",  text: "I can't tell which enquiry to call first",           maps: ["score", "enrich"] },
  { id: "quotes",  text: "Quotes and proposals go out late, or not at all",    maps: ["quote", "docs"] },
  { id: "chase",   text: "We give up chasing after one or two attempts",       maps: ["nurture", "booking"] },
  { id: "hours",   text: "Nothing happens outside office hours",               maps: ["missedcall", "speedlead", "webchat"] },
  { id: "retype",  text: "We retype the same details into two systems",        maps: ["crmbuild", "onboard", "calls"] },
  { id: "lost",    text: "Enquiries live in an inbox, not anywhere I can see", maps: ["crmbuild", "dashboard"] },
  { id: "dormant", text: "Old enquiries never hear from us again",             maps: ["reactivate", "signals"] },
  { id: "numbers", text: "I couldn't tell you this week's numbers",            maps: ["dashboard", "attrib"] },
  { id: "reviews", text: "We never get round to asking for reviews",           maps: ["referral"] },
  { id: "volume",  text: "We're not reaching enough new people at all",        maps: ["machine", "signals"] },
  { id: "content", text: "We know we should post, and we don't",               maps: ["content"] },
  { id: "owner",   text: "It all falls over when one person is away",          maps: ["crmbuild", "dashboard", "calls"] }
];

let picked = new Set();
let touched = new Set();          /* sliders the visitor actually moved */
let lastRun = null;

const GOAL_LABEL = { steady: "steadier months at today's size", g25: "around 25% more", g50: "around 50% more", g2x: "double or beyond" };
const GOAL_MULT = { steady: 1, g25: 1.25, g50: 1.5, g2x: 2 };
const RESP_NOW = { u5: "under 5 min", hour: "within the hour", sameday: "same day", nextday: "next day or later" };

const COPY = {
  work: (cfg, goalText) => [
    "Reading your answers",
    "Checking " + companyName() + " against the " + cfg.plural + " range",
    "Costing what each leak leaves recoverable",
    "Simulating two thousand versions of your business",
    "Ranking each system by what it adds on top of the last",
    "Sizing the gap between today and " + goalText
  ]
};

/* ---------- formatting ----------------------------------------------------
   §10: every figure carries a unit and a period. Never a bare pound sign. */
const money = n => fmtGBP(Math.round(n));
const moneyK = n => fmtGBPk(n);
const pct = n => Math.round(n * 100) + "%";

/* the house format for a banded figure, used everywhere a number appears */
function rangeLine(b, period) {
  const p = period === undefined ? " per month" : (period ? " " + period : "");
  return money(b.p10) + "–" + money(b.p90) + p + ", central case " + money(b.p50);
}

/* the tile format: central case large, band immediately adjacent. Never the
   central case on its own. */
function tileValue(b) {
  return `<em>${esc(moneyK(b.p50))}</em> <span style="font-size:.62em;color:var(--dim)">${esc(moneyK(b.p10))}–${esc(moneyK(b.p90))}</span>`;
}

const CONF_CLASS = { measured: "hi", inferred: "blue", assumed: "md" };
const CONF_WORD = {
  measured: "you told us",
  inferred: "derived from your answers",
  assumed: "our industry default"
};
const confChip = c => `<span class="chip ${CONF_CLASS[c] || "md"}" title="${esc(CONF_WORD[c] || "")}">${esc(c)}</span>`;

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
        if (seg.id === "qCapKnown" || seg.id === "qSize") syncCapacity();
      });
    });
  });
}

/* ---------- industry-personalised sliders --------------------------------- */
const nice = v => {
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.round(v / mag * 2) / 2 * mag;
};
const stepFor = range => range <= 80 ? 1 : range <= 400 ? 5 : range <= 2000 ? 25 : range <= 10000 ? 100 : 250;

/* customers a month before anything is built, used to size the capacity
   slider and to infer capacity when they say they are not sure */
function currentCustomers() {
  const cfg = PRESETS[getProfile().industry];
  /* dataset.k is set by renderSliders, so before the first paint we read the
     preset rather than a bare range input's default of 50 — which quietly
     sized the capacity question off numbers nobody had entered */
  const li = $("#inleads"), ci = $("#inclose");
  const leads = li && li.dataset.k ? +li.value : cfg.monthlyLeads;
  const close = ci && ci.dataset.k ? +ci.value / 100 : cfg.closeRate / 100;
  return Math.max(1, leads * close);
}

function sliderSpec() {
  const cfg = PRESETS[getProfile().industry], econ = econOf(getProfile().industry);
  const L = cfg.monthlyLeads, V = cfg.avgValue;
  const align = (val, minRaw, step) => Math.max(step, val - Math.floor((val - minRaw) / step) * step);
  const snapMax = (min, max, step) => min + Math.floor((max - min) / step) * step;
  const lStep = stepFor(L * 4), vStep = stepFor(V * 3.5);
  const lMin = align(L, Math.max(2, L * 0.15), lStep);
  const vMin = align(V, Math.max(50, V * 0.25), vStep);
  const capDefault = inferSpareCapacity(readSeg("qSize") || "small", currentCustomers());
  const capMax = Math.max(6, Math.round(currentCustomers() * 2));
  return {
    leads: { min: lMin, max: snapMax(lMin, Math.max(20, nice(L * 4)), lStep), step: lStep, val: L,
             fmt: v => v + " a month" },
    value: { min: vMin, max: snapMax(vMin, nice(V * 3.5), vStep), step: vStep, val: V,
             fmt: v => fmtGBP(v) },
    close: { min: 2, max: 75, step: 1, val: cfg.closeRate, fmt: v => v + "%" },
    spend: { min: 0, max: Math.max(1000, nice(econ.spend || 1500) * 4), step: 50, val: 0,
             fmt: v => v === 0 ? "£0" : fmtGBP(v) + "/mo" },
    cap:   { min: 0, max: capMax, step: 1, val: Math.min(capDefault, capMax),
             fmt: v => v === 0 ? "none, we're full" : v + (v === 1 ? " customer" : " customers") + " a month" }
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
    cfg.plural + ". Every one you move stops being our benchmark and becomes your figure, and the " +
    "report says which is which.";
}

/* the capacity slider follows the volume and win-rate answers until the
   visitor takes hold of it themselves */
function syncCapacity() {
  if (touched.has("cap") && readSeg("qCapKnown") !== "unsure") return;
  const input = $("#incap");
  if (!input) return;
  const spec = sliderSpec().cap;
  input.min = spec.min; input.max = spec.max; input.step = spec.step;
  input.value = spec.val;
  paintSlider(input);
}

function wireSliders() {
  ["leads", "value", "close", "spend", "cap"].forEach(k => {
    $("#in" + k).addEventListener("input", e => {
      touched.add(k);
      if (k === "cap") {
        const seg = $("#qCapKnown");
        $$("button", seg).forEach(x => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
        const known = $('#qCapKnown button[data-v="known"]');
        known.classList.add("on"); known.setAttribute("aria-pressed", "true");
      }
      paintSlider(e.target);
      if (k === "leads" || k === "close") syncCapacity();
    });
  });
}

function readAnswers() {
  return {
    leads: +$("#inleads").value,
    value: +$("#invalue").value,
    close: +$("#inclose").value / 100,
    spend: +$("#inspend").value,
    cap: +$("#incap").value,
    capKnown: readSeg("qCapKnown") || "known",
    role: readSeg("qRole") || "owner",
    size: readSeg("qSize") || "small",
    goal: readSeg("qGoal") || "g25",
    first: readSeg("qFirst") || "replies",
    success: readSeg("qSuccess") || "revenue",
    resp: readSeg("qResp") || "sameday",
    mix: readSeg("qMix") || "even",
    answer: readSeg("qAnswer") || "many",
    quote: readSeg("qQuote") || "yes",
    fu: readSeg("qFu") || "f23",
    who: readSeg("qWho") || "me",
    crm: readSeg("qCrm") || "inbox",
    hours: readSeg("qHours") || "wait"
  };
}

/* ---------- answers → the engine's input set ------------------------------
   Every field carries where it came from. A slider left where we set it is
   our benchmark and is tagged `assumed`; one the visitor moved is theirs. */
function buildInputs(a) {
  const econ = econOf(getProfile().industry);
  const mix = MIX[a.mix];
  const resp = RESP[a.resp];
  const tag = (k, v) => ({ value: v, confidence: touched.has(k) ? "measured" : "assumed" });

  const baseCustomers = a.leads * a.close;
  const capacity = a.capKnown === "unsure"
    ? { value: inferSpareCapacity(a.size, baseCustomers), confidence: "inferred" }
    : { value: a.cap, confidence: touched.has("cap") ? "measured" : "inferred" };

  return {
    enquiries: tag("leads", a.leads),
    mixPhone: { value: mix.mixPhone, confidence: "inferred" },
    mixForm: { value: mix.mixForm, confidence: "inferred" },
    answerPhone: { value: ANSWER_PHONE[a.answer].value, confidence: "inferred" },
    respForm: { value: resp.respForm, confidence: "inferred" },
    respEmail: { value: resp.respEmail, confidence: "inferred" },
    closeRate: tag("close", a.close),
    quoteBased: { value: a.quote === "yes", confidence: "measured" },
    firstValue: tag("value", a.value),
    margin: { value: econ.margin, confidence: "assumed" },
    repeat: { value: econ.repeat, confidence: "assumed" },
    spareCapacity: capacity,
    budget: tag("spend", a.spend),
    costPerLead: { value: econ.costPerLead, confidence: "assumed" },
    hourlyCost: { value: econ.hourlyCost, confidence: "assumed" },
    spread: { value: econ.spread, confidence: "assumed" },
    buildPerSystem: {
      value: { default: PRICING.entry.build, machine: PRICING.core.build }, confidence: "assumed"
    },
    runPerSystem: {
      value: { default: PRICING.entry.monthly, machine: PRICING.core.monthly }, confidence: "assumed"
    }
  };
}

/* ---------- the chart -----------------------------------------------------
   The delta, month by month, as a band. The zero line is "carry on exactly as
   you are", so the chart reads as the difference the work makes rather than
   as a revenue total nobody promised. */
function chartSVG(year) {
  const W = 720, H = 300, pL = 62, pR = 18, pT = 18, pB = 34;
  const hi = year.months.map(m => m.p90), lo = year.months.map(m => m.p10), mid = year.months.map(m => m.p50);
  const maxY = Math.max(...hi, 1) * 1.12;
  const minY = Math.min(0, ...lo) * 1.12;
  const x = t => pL + (W - pL - pR) * (t - 1) / 11;
  const y = v => pT + (H - pT - pB) * (1 - (v - minY) / (maxY - minY));
  const pts = a => a.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const band = "M " + hi.map((v, i) => `${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`).join(" L ") +
    " L " + lo.map((v, i) => ({ v, i })).reverse().map(p => `${x(p.i + 1).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" L ") + " Z";

  const stepY = nice((maxY - minY) / 3.4) || 1;
  let grid = "";
  for (let v = Math.ceil(minY / stepY) * stepY; v < maxY; v += stepY) {
    if (Math.abs(v) < 1e-9) continue;
    grid += `<line x1="${pL}" x2="${W - pR}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.06)"/>
      <text x="${pL - 8}" y="${y(v) + 3}" text-anchor="end" class="ct">${esc(moneyK(v))}</text>`;
  }
  let ticks = "";
  for (let t = 1; t <= 12; t += 1) {
    if (t !== 1 && t % 2) continue;
    ticks += `<text x="${x(t)}" y="${H - 10}" text-anchor="middle" class="ct">m${t}</text>`;
  }
  const dots = [1, 3, 6, 12].map(t =>
    `<circle cx="${x(t)}" cy="${y(mid[t - 1])}" r="4" fill="#4da3ff" stroke="#000" stroke-width="1.5"/>`).join("");

  /* months seven onward are marked on the chart, not only in the caption */
  const split = (x(6) + x(7)) / 2;
  const dim = `<rect x="${split}" y="${pT}" width="${W - pR - split}" height="${H - pT - pB}"
      fill="rgba(255,255,255,.022)"/>
    <line x1="${split}" x2="${split}" y1="${pT}" y2="${H - pB}" stroke="rgba(255,255,255,.14)" stroke-dasharray="3 5"/>
    <text x="${split + 7}" y="${pT + 12}" class="ct">lower confidence from here</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Modelled monthly difference against doing nothing, over twelve months, as a band">
    <style>.ct{font:10.5px "JetBrains Mono",monospace;fill:rgba(142,154,168,.9)}</style>
    ${grid}${dim}
    <path d="${band}" fill="rgba(77,163,255,.14)"/>
    <line x1="${pL}" x2="${W - pR}" y1="${y(0)}" y2="${y(0)}" stroke="rgba(255,255,255,.4)" stroke-width="1.5" stroke-dasharray="5 5"/>
    <text x="${pL + 4}" y="${y(0) - 6}" class="ct">carry on unchanged</text>
    <polyline points="${pts(mid)}" fill="none" stroke="#4da3ff" stroke-width="2.5" stroke-linejoin="round"/>
    <polyline points="${pts(hi)}" fill="none" stroke="rgba(77,163,255,.35)" stroke-width="1.2"/>
    <polyline points="${pts(lo)}" fill="none" stroke="rgba(77,163,255,.35)" stroke-width="1.2"/>
    ${dots}${ticks}
  </svg>`;
}

/* ---------- section 01 · opportunity estimate ----------------------------- */
function renderOpportunity(inp, f, cfg) {
  const rec = f.leaks.reduce((t, l) => t + l.revenue, 0);
  const recBand = {
    p10: f.leaks.reduce((t, l) => t + f.sim.sets[l.key].p10, 0),
    p50: f.leaks.reduce((t, l) => t + f.sim.sets[l.key].p50, 0),
    p90: f.leaks.reduce((t, l) => t + f.sim.sets[l.key].p90, 0)
  };
  const hoursBand = f.central.delta.hours;
  const yr = f.year.cumulative;

  $("#planTiles").innerHTML = `
    <div class="rtile"><span class="rtlab">Recoverable a month</span>
      <span class="rtval">${tileValue(recBand)}</span>
      <span class="rtsub">Revenue the four leaks below could return, on your numbers, once the systems
      that act on them are running. ${confChipsFor(inp, ["enquiries", "closeRate", "firstValue"])}
      <span class="modeltag">modelled</span></span></div>
    <div class="rtile"><span class="rtlab">Twelve months, net</span>
      <span class="rtval">${tileValue(yr)}</span>
      <span class="rtsub">Added across the year against carrying on unchanged, after our fees and after
      any budget. ${esc(rangeLine(yr, "across the year"))}. <span class="modeltag">modelled</span></span></div>
    <div class="rtile"><span class="rtlab">Simulated runs that cleared the cost</span>
      <span class="rtval"><em>${esc(pct(f.monthly.pPositive))}</em></span>
      <span class="rtsub">Of ${f.sim.n.toLocaleString("en-GB")} simulated versions of a business
      answering as you did, the share where the modelled gain cleared the modelled cost. This is a
      property of the model, not a record of what happened to anyone.
      <span class="modeltag">modelled</span></span></div>
    <div class="rtile"><span class="rtlab">Hours back a month</span>
      <span class="rtval"><em>${hoursBand.toFixed(0)}</em> hrs</span>
      <span class="rtsub">Admin hours the recommended systems take off your team, valued at
      ${esc(money(val(inp, "hourlyCost")))} an hour. ${confChip("assumed")}</span></div>`;

  const rows = f.leaks.map(l => {
    const b = f.sim.sets[l.key];
    const working = l.channel === "close"
      ? `close rate ${pct(l.before)} → ${pct(l.after)}, applied to every source at once`
      : `${Math.round(val(inp, "enquiries") * l.share)} of ${Math.round(val(inp, "enquiries"))} ${esc(cfg.enquiry)} a month · ${pct(l.before)} → ${pct(l.after)} reaching a conversation`;
    return `<tr>
      <td>${esc(l.label)}</td>
      <td>${esc(working)}</td>
      <td>+${l.customers.toFixed(1)}/mo</td>
      <td><b>${esc(money(b.p50))}</b> <span class="dim">${esc(money(b.p10))}–${esc(money(b.p90))}</span></td>
    </tr>`;
  }).join("");

  $("#leakBox").innerHTML = `
    <table class="ltable">
      <thead><tr><th>Where it leaks</th><th>What moves, and by how much</th><th>Customers</th>
        <th>Recoverable per month</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="dim" style="font-size:13px;margin-top:12px;max-width:78ch">These four rows do not add up
    to the forecast, in either direction. They overlap, because a better close rate lifts the phone line
    and the form line at the same time, and capacity clips the total afterwards. They also leave things
    out: sourced leads, referrals, content and the ${f.central.delta.hours.toFixed(0)} hours a month
    saved are all in the forecast and none of them are a leak. The forecast composes the lot properly;
    this table is only the split of where enquiries go cold today.</p>`;
}

const FIELD_NAME = {
  enquiries: "enquiry volume", closeRate: "win rate", firstValue: "customer value",
  margin: "margin", repeat: "repeat business", spareCapacity: "capacity",
  budget: "budget", costPerLead: "cost per lead", answerPhone: "call answer rate"
};

/* a bare row of "assumed assumed assumed" says nothing about what is assumed */
function confChipsFor(inp, keys) {
  return keys.map(k =>
    `<span class="chip ${CONF_CLASS[inp[k].confidence] || "md"}" title="${esc(CONF_WORD[inp[k].confidence] || "")}">${esc(FIELD_NAME[k] || k)}: ${esc(inp[k].confidence)}</span>`
  ).join(" ");
}

/* ---------- section 02 · the forecast -------------------------------------- */
function renderForecast(inp, f, cfg) {
  const m1 = f.year.months[0], m12 = f.year.months[11];
  $("#chartBox").innerHTML = chartSVG(f.year) + `
    <div class="flegend">
      <span><i></i>central case (p50)</span>
      <span><i class="band"></i>p10 to p90</span>
      <span><i class="base"></i>carry on unchanged</span>
      <span class="modeltag" style="margin-left:auto">modelled, not promised</span>
    </div>`;

  const width1 = m1.p90 - m1.p10, width12 = m12.p90 - m12.p10;
  $("#howModel").innerHTML = `<summary>How we modelled this</summary>
    <p>The chain, in order. ${Math.round(val(inp, "enquiries"))} ${esc(cfg.enquiry)} a month split
    ${pct(val(inp, "mixPhone"))} phone, ${pct(val(inp, "mixForm"))} form,
    ${pct(1 - val(inp, "mixPhone") - val(inp, "mixForm"))} email. Each channel has a rate at which an
    enquiry reaches a conversation, and each system raises that rate by capturing a share of the gap to
    a ceiling: new = old + capture × (ceiling − old). That is why a second system on the same channel
    adds less than the first, and why a business already answering nine calls in ten has less to gain
    than one answering half.</p>
    <p>What survives that becomes engaged enquiries, which meet your win rate of
    ${pct(val(inp, "closeRate"))}, itself raised the same way and capped at 95%. Sourced leads and
    referred customers are added on top and converted at that same composed rate, with outbound
    discounted to 0.38 of it because someone you approached does not buy like someone who rang you.
    The total is then clipped at your capacity — ${Math.round(val(inp, "spareCapacity"))} more customers
    a month — proportionally across every source, and only then valued at
    ${esc(money(val(inp, "firstValue")))} a customer times ${val(inp, "repeat")} for repeat business,
    at ${pct(val(inp, "margin"))} gross margin.</p>
    <p>Every figure on this page is the difference between that and the same calculation with nothing
    built. We then re-ran it ${f.sim.n.toLocaleString("en-GB")} times, drawing every capture rate and
    your win rate from Beta distributions and your customer value from a log-normal, with one firm-quality
    draw applied across all of them so a business that executes badly executes badly everywhere. The
    band is the 10th to 90th percentile of those runs. It is seeded from your answers, so the same
    answers give the same forecast every time.</p>
    <p>The band widens as the year goes on: ${esc(money(width1))} wide in month one,
    ${esc(money(width12))} by month twelve. That is not pessimism about your business, it is what a
    forecast horizon does, and a band that stayed the same width for twelve months would be the clearest
    sign of a model that had not thought about time. Months seven to twelve are marked lower confidence
    for the same reason.</p>
    <p>What this does not know: your real cost per ${esc(singular(cfg.enquiry))}, your deliverability
    position, and whether the benchmarks we filled in for you hold. Those are the call.</p>`;
}

/* ---------- section 03 · recommended systems ------------------------------- */
function systemCard(inp, f, id, opts) {
  const s = BY_ID[id];
  const b = f.sim.perService[id];
  const v = f.views[id];
  const declined = opts.declined || null;
  const code = s.buildCode;
  const days = BUILDS[code] ? BUILDS[code].days : s.buildDays + " days";
  const figure = declined
    ? (s.kind === "time"
        ? `<b>${s.hours} hrs a month</b>, no revenue effect modelled`
        : `<b>${money(0)} a month</b> as things stand`)
    : `<b>${esc(money(b.marginal.p50))} a month</b> <span class="dim">${esc(money(b.marginal.p10))}–${esc(money(b.marginal.p90))}</span>`;

  const reasons = declined
    ? `<div class="bcneed"><span class="needlab">Why we would not build this yet</span>
        ${declined.reasons.map(r => `<b>${esc(r.message)}</b><br><span class="dim">${esc(r.detail)}</span>`).join("<br><br>")}</div>`
    : "";

  const working = `<details class="how"><summary>Show the working</summary>
    <p><b>Where it acts.</b> ${esc(s.acts)}.
    ${s.kind === "rate" ? `Ceiling ${pct(s.ceiling)}, capturing ${pct(s.capture)} of the gap between where
      you are and that ceiling. On your numbers that is ${pct(f.central.current.rates[s.channel].before)}
      → ${pct(f.central.current.rates[s.channel].after)} once everything above it is running.` : ""}
    ${s.kind === "close" ? `Ceiling ${pct(Math.min(val(inp, "closeRate") * s.ceilingMult, s.ceilingCap))}
      (your ${pct(val(inp, "closeRate"))} × ${s.ceilingMult}, capped at ${pct(s.ceilingCap)}), capturing
      ${pct(s.capture)} of the gap.` : ""}
    ${s.kind === "volume" ? `Adds ${(typeof s.volume === "function" ? s.volume(inp) : s.volume).toFixed(1)}
      leads a month, converted at your composed win rate and discounted to 0.38 for outbound.` : ""}
    ${s.kind === "engine" ? `Turns ${esc(money(val(inp, "budget")))} a month of budget into leads at
      ${esc(money(val(inp, "costPerLead")))} each, converted at your composed win rate and discounted to
      0.38 for outbound.` : ""}
    ${s.kind === "value" ? `Raises lifetime value from ${val(inp, "repeat")}× a first sale toward
      ${s.repeatCeiling}×, capturing ${pct(s.capture)} of that gap. It adds no customers.` : ""}
    ${s.kind === "referral" ? `${pct(s.referralRate)} of customers refer someone, and a referral closes at
      ${s.referralCloseMult}× your rate. It compounds on every other system, which is why its marginal
      figure is larger than its standalone one.` : ""}
    ${s.kind === "content" ? `Lifts inbound enquiries ${pct(s.inboundLift)}, discounted to
      ${pct(s.horizonDiscount)} because attribution over a year is weak, and ramped across nine months.` : ""}
    ${s.kind === "time" ? "No transition in your funnel. Hours only." : ""}</p>
    <p><b>On its own</b> ${esc(money(b.standalone.p50))} a month
      (${esc(money(b.standalone.p10))}–${esc(money(b.standalone.p90))}).
    <b>On top of everything above it</b> ${esc(money(b.marginal.p50))} a month
      (${esc(money(b.marginal.p10))}–${esc(money(b.marginal.p90))}).
    ${Math.abs(b.standalone.p50 - b.marginal.p50) > 1
      ? "The two differ because other systems in this plan pull on the same lever. The build order uses the second figure."
      : "The two agree here, because nothing else in this plan touches the same transition."}</p>
    <p><b>Cost and payback.</b> ${esc(money(v.build))} to build${v.run > 0 ? ", " + esc(money(v.run)) + " a month to run" : ", no monthly fee"}.
    ${v.marginalCustomers > 0.01
      ? `${v.marginalCustomers.toFixed(2)} extra customers a month at
         ${esc(money(v.cac))} each, against ${esc(money(v.affordableCac))} affordable at a three-to-one
         target return.`
      : "It adds no customers, so it is judged on payback rather than on cost per customer."}
    ${Number.isFinite(v.payback) ? `Payback in ${v.payback.toFixed(1)} months.` : "It does not pay back within the term."}</p>
    <p><b>Confidence in these figures.</b> ${esc(s.confidence)}. The ceiling and capture rate this
    system is modelled on are ${s.confidence === "measured"
      ? "held against real deployments"
      : s.confidence === "inferred"
        ? "reasoned from how the mechanism works rather than measured on clients, so treat the shape as sound and the size as provisional"
        : "a starting guess, and the first thing a deployment would correct"}.</p>
  </details>`;

  return `<div class="bcard${declined ? "" : ""}">
    <div class="bctop">
      <span class="bcdot" style="background:${BUILDS[code] ? BUILDS[code].col : "#4da3ff"}"></span>
      <div><h4>${esc(s.name)}</h4><span class="bcdays">${esc(days)}${opts.rank ? " · rank " + opts.rank : ""}</span></div>
    </div>
    <p style="margin-bottom:8px">${figure}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      ${confChip(s.confidence)}<span class="chip blue">${esc(s.acts)}</span>
    </div>
    <p>${esc(s.why)}</p>
    <div class="bcneed"><span class="needlab">The honest catch</span>${esc(s.catch)}</div>
    ${reasons}
    ${working}
    <a class="bclink" href="resources.html#${esc(code)}">What this involves →</a>
  </div>`;
}

function renderSystems(inp, f) {
  const built = f.ranked.map((id, i) =>
    systemCard(inp, f, id, { rank: i + 1 })).join("");
  const dec = f.declined
    .filter(d => f.sim.perService[d.id])
    .map(d => systemCard(inp, f, d.id, { declined: d })).join("");
  const unavailable = f.unavailable.map(u => {
    const s = BY_ID[u.id];
    return `<div class="bcard">
      <div class="bctop"><span class="bcdot" style="background:#b7c0cc"></span>
        <div><h4>${esc(s.name)}</h4><span class="bcdays">not applicable</span></div></div>
      <p>This one acts on ${esc(s.acts)}, and your answers say that step does not exist in your
      business. There is nothing to model, so there is nothing to sell you.</p>
    </div>`;
  }).join("");

  /* when most of what we turn down is turned down for the same reason, that
     reason is the finding, and it belongs above the cards rather than buried
     in the fourteenth one */
  const capBound = f.declined.filter(d => d.reasons.some(r => r.code === "capacity-binds"));
  const capNote = capBound.length >= 3
    ? `<div class="panel edge edge-violet pad" style="margin-bottom:20px">
        <h4 style="margin-bottom:6px">Read this before the list: capacity, not demand, is what limits you</h4>
        <p class="dim" style="font-size:14px;line-height:1.6;max-width:78ch">${capBound.length} of the
        systems below would each win you customers, and are turned down anyway, because the
        ${Math.round(val(inp, "spareCapacity"))} extra customers a month you told us you could
        serve are already spoken for by the ${f.ranked.length} above them. Buying more demand on top of
        that would be buying a queue. The most valuable thing on this page for you is not a system, it
        is the answer to how much you could serve if you wanted to — which is why the call counts it
        against your diary rather than a slider.</p>
      </div>`
    : "";

  $("#systemsBox").innerHTML = capNote + `
    <div class="phase">
      <div class="phhead"><span class="phnum">BUILD</span>
        <div><h4>${f.ranked.length} system${f.ranked.length === 1 ? "" : "s"}, ranked by what each adds on top of the last</h4></div></div>
      <div class="bcards">${built || '<div class="bcard"><p>Nothing in the library clears its own cost on these numbers. That is the finding, not a gap in the list.</p></div>'}</div>
    </div>
    ${dec || unavailable ? `<div class="phase">
      <div class="phhead"><span class="phnum">DECLINED</span>
        <div><h4>What we would not build, and why</h4></div></div>
      <div class="bcards">${dec}${unavailable}</div>
    </div>` : ""}`;
}

/* what the visitor picked, against what the arithmetic did with it */
function renderPicked(f) {
  if (!picked.size) { $("#pickedBox").innerHTML = ""; return; }
  const rankOf = {};
  f.ranked.forEach((id, i) => { rankOf[id] = i + 1; });
  const declinedBy = {};
  f.declined.forEach(d => { declinedBy[d.id] = d.reasons[0]; });

  const rows = SYMPTOMS.filter(s => picked.has(s.id)).map(s => {
    const answers = s.maps.map(id => {
      const svc = BY_ID[id];
      if (!svc) return null;
      if (rankOf[id]) return `<b>${esc(svc.name)}</b> is number ${rankOf[id]} in the build order`;
      if (declinedBy[id]) return `<b>${esc(svc.name)}</b> declined: ${esc(declinedBy[id].message.toLowerCase())}`;
      return `<b>${esc(svc.name)}</b> is not applicable to you`;
    }).filter(Boolean).join("; ");
    return `<tr><td>${esc(s.text)}</td><td>${answers}</td></tr>`;
  }).join("");

  $("#pickedBox").innerHTML = `
    <h4 style="margin-bottom:8px">What you picked, and where the arithmetic put it</h4>
    <p class="dim" style="font-size:13.5px;max-width:78ch;margin-bottom:12px">Your picks do not move the
    ranking. The numbers do. This is where each one landed, including the ones we would not build.</p>
    <table class="ltable"><tbody>${rows}</tbody></table>`;
}

/* ---------- section 04 · build roadmap ------------------------------------- */
function renderRoadmap(inp, f, cfg) {
  const byMonth = {};
  f.plan.forEach(p => { (byMonth[p.liveMonth] = byMonth[p.liveMonth] || []).push(p); });
  const monthsList = Object.keys(byMonth).map(Number).sort((a, b) => a - b);

  $("#planPhases").innerHTML = monthsList.map((mo, i) => {
    const cards = byMonth[mo].map(p => {
      const s = BY_ID[p.id], code = s.buildCode, B = BUILDS[code];
      return `<div class="bcard">
        <div class="bctop"><span class="bcdot" style="background:${B ? B.col : "#4da3ff"}"></span>
          <div><h4>${esc(s.name)}</h4><span class="bcdays">${esc(B ? B.days : s.buildDays + " days")} · full effect by month ${p.liveMonth + p.rampMonths - 1}</span></div></div>
        <p>${esc(s.why)}</p>
        ${B ? `<div class="bcneed"><span class="needlab">To integrate it we need</span>${esc(B.needs)}</div>` : ""}
        <a class="bclink" href="resources.html#${esc(code)}">What this involves →</a>
      </div>`;
    }).join("");
    const n = byMonth[mo].length;
    return `<div class="phase">
      <div class="phhead"><span class="phnum${mo > 3 ? " core" : ""}">${String(i + 1).padStart(2, "0")}</span>
        <div><h4>Live in month ${mo} · ${n} system${n === 1 ? "" : "s"}${n > 1 ? ", two crews working in parallel" : ""}</h4></div></div>
      <div class="bcards">${cards}</div>
    </div>`;
  }).join("");

  const at = m => f.year.months[m - 1];
  const total = f.selected.length;
  const stillRamping = m => f.plan.filter(p => m < p.liveMonth + p.rampMonths - 1).map(p => BY_ID[p.id].name);
  $("#milesBox").innerHTML = [1, 3, 6, 12].map(m => {
    const row = at(m);
    const live = row.live.length;
    const ramping = stillRamping(m);
    const head = m === 12 ? "The year, read from your accounts"
      : live === 0 ? "Still building"
      : live + " of " + total + " live";
    const body = m === 1
      ? `${live === 0 ? "The first builds are in progress." : live + " live, and none of them send anything in your name without your approval."}`
      : m === 3
        ? `${live} of ${total} live. ${ramping.length
            ? ramping.length + " still climbing to full effect, so the figure below is not yet the steady state."
            : "All of them at full effect, so this is the first month the figure below is a steady state rather than a build."}`
        : m === 6
          ? `${ramping.length
              ? "Everything is live; " + esc(ramping.join(" and ").toLowerCase()) + " is still compounding."
              : "Everything is live and at full effect."} This is the month to check the answer rate against what this page predicted.`
          : `Long enough running that you read the year from your accounts rather than from this page. The band below is at its widest here, which is the point.`;
    return `<div class="mile"><span class="mtag">MONTH ${m}${row.lowConfidence ? " · LOWER CONFIDENCE" : ""}</span>
      <h5>${esc(head)}</h5><p>${body}</p>
      <span class="mfig">${esc(money(row.p50))}/mo <span class="dim" style="font-weight:400">${esc(money(row.p10))}–${esc(money(row.p90))}</span>
      <span class="modeltag" style="margin-left:6px">modelled</span></span></div>`;
  }).join("");
}

/* ---------- section 05 · the goal gap --------------------------------------
   The highest-value honesty moment on the page. If the aim sits above p90 it
   says so, and says what else would have to change. It never stretches the
   forecast to meet the goal. */
function renderGoalGap(inp, a, f, cfg) {
  const box = $("#gapBox");
  const baseRevenue = f.central.baseline.revenue;
  const target = baseRevenue * GOAL_MULT[a.goal];
  const needed = target - baseRevenue;

  if (needed <= baseRevenue * 0.02) {
    box.innerHTML = `<h3>Your aim: steadier, at today's size</h3>
      <p class="glead">You told us predictability matters more than scale, so there is no gap to close.
      The reading that matters for you is the band, not the central case: month one runs
      ${esc(money(f.year.months[0].p10))} to ${esc(money(f.year.months[0].p90))} and month twelve
      ${esc(money(f.year.months[11].p10))} to ${esc(money(f.year.months[11].p90))}. Narrowing that band is
      what the systems buy a business in your position, and it is what the call would scope.</p>`;
    return;
  }

  /* the month-12 revenue delta, banded, drawn from the same engine */
  const w12 = {};
  f.plan.forEach(p => { w12[p.id] = 1; });
  const revSim = simulate(inp, f.selected, {
    n: 1200,
    spread: val(inp, "spread") * (1 + 0.06 * 11),
    weights: w12,
    seed: f.seed,
    sets: [{ key: "rev12", selected: f.selected, metric: "revenue" }]
  });
  const rev = revSim.sets.rev12;
  const coverage = Math.round(rev.p50 / needed * 100);
  const above90 = needed > rev.p90;
  const maxRef = Math.max(target, baseRevenue + rev.p90);
  const bar = v => Math.max(4, Math.min(100, v / maxRef * 100));

  box.innerHTML = `<h3>The gap to your aim</h3>
    <p class="glead">You told us the aim is ${esc(GOAL_LABEL[a.goal])}. That is
    ${esc(money(needed))} a month of extra revenue on top of today's ${esc(money(baseRevenue))}. Here is
    what the recommended systems are modelled to add by month twelve, against it.</p>
    <div class="gbars">
      <div class="gbar now"><div class="gblab"><span>Today</span><b>${esc(money(baseRevenue))}/mo</b></div>
        <div class="gbtrack"><i style="width:${bar(baseRevenue)}%"></i></div></div>
      <div class="gbar model"><div class="gblab"><span>Central case, month 12</span><b>${esc(money(baseRevenue + rev.p50))}/mo</b></div>
        <div class="gbtrack"><i style="width:${bar(baseRevenue + rev.p50)}%"></i></div></div>
      <div class="gbar model"><div class="gblab"><span>Best modelled case (p90), month 12</span><b>${esc(money(baseRevenue + rev.p90))}/mo</b></div>
        <div class="gbtrack"><i style="width:${bar(baseRevenue + rev.p90)}%"></i></div></div>
      <div class="gbar goal"><div class="gblab"><span>Your stated aim</span><b>${esc(money(target))}/mo</b></div>
        <div class="gbtrack"><i style="width:${bar(target)}%"></i></div></div>
    </div>
    <p class="gnote">${above90
      ? `<b>The systems alone will not get you there.</b> Your aim sits above the top of the modelled
         band: even the best of ${revSim.n.toLocaleString("en-GB")} simulated runs adds
         ${esc(money(rev.p90))} a month against the ${esc(money(needed))} you want. Closing the rest
         means changing something these systems do not touch — the price of the work, the mix of what
         you sell, the size of the market you address, or headcount. We would rather tell you that here
         than quietly widen the forecast until it agreed with you. What the call does is work out which
         of those four is actually available to you.`
      : rev.p10 > needed
        ? `<b>Your aim is inside the lower edge of the band.</b> Even the pessimistic case adds
           ${esc(money(rev.p10))} a month against the ${esc(money(needed))} you asked for. Read that as
           a sign the aim is set low rather than as a sign the plan is strong: on these answers the
           binding question is not whether you can grow 25%, it is what you would do with more than
           that, and whether you would want to. The call is worth having on the second question.`
        : coverage >= 100
          ? `The central case clears your aim by month twelve, but the lower edge of the band does not:
             ${esc(money(rev.p10))} against the ${esc(money(needed))} you want. So the honest read is
             that the aim is reachable rather than likely, and the call's job is to pressure-test the
             two or three assumptions the difference rests on.`
          : `The central case covers about ${Math.max(0, coverage)}% of the gap by month twelve, and the
             upper case ${Math.round(rev.p90 / needed * 100)}%. The remainder is what the call scopes:
             which levers your real numbers say to pull, and in what order.`}
      <span class="modeltag" style="margin-left:6px">modelled</span></p>
    ${f.central.current.clipped > 0.01
      ? `<p class="gnote"><b>Note on capacity.</b> ${f.central.current.clipped.toFixed(1)} customers a
         month are already being turned away in this model, because the plan wins more than the
         ${Math.round(val(inp, "spareCapacity"))} extra you told us you could serve. Raising capacity is
         worth more to you than any system on this page.</p>`
      : ""}`;
}

/* ---------- provenance ----------------------------------------------------- */
function renderProvenance(inp, f) {
  const c = confidenceCounts(inp);
  const items = ["measured", "inferred", "assumed"].map(k =>
    `<div class="cfg-row"><span class="k">${confChip(k)} ${esc(CONF_WORD[k])}</span><span class="v">${c[k]} of ${c.total}</span></div>`).join("");
  $("#provBox").innerHTML = `
    <div class="panel edge pad" style="margin-top:20px">
      <h4 style="margin-bottom:4px">Where these numbers came from</h4>
      <p class="dim" style="font-size:13.5px;max-width:78ch;margin-bottom:12px">A narrow band over
      figures you never gave us is not precision, it is confidence in a guess. So the count is here,
      and every figure below carries its tag.</p>
      ${items}
      <div class="covbar" style="margin-top:14px"><i style="width:${Math.round((1 - c.assumedShare) * 100)}%"></i></div>
      <p class="dim" style="font-size:12.5px;margin-top:8px">${Math.round((1 - c.assumedShare) * 100)}%
      of the inputs are yours or derived from your answers. Above 40% guesswork we stop quoting a
      forecast at all.</p>
    </div>`;
}

/* ---------- refusal --------------------------------------------------------- */
function renderRefusal(list, cfg) {
  $("#reportBody").classList.add("hide");
  $("#planHeadline").textContent = "We are not going to forecast this";
  $("#planSummary").textContent = "Not every set of answers can carry a forecast, and pretending " +
    "otherwise would be the easiest thing on this page to get wrong. Here is what stopped it, and what " +
    "we would do instead.";
  $("#refuseBox").innerHTML = `
    <div class="panel edge edge-violet pad" style="margin-top:24px">
      <div class="mrefuse">
        ${list.map(r => `<div style="margin-bottom:22px">
          <h4>${esc(r.message)}</h4>
          <p>${esc(r.detail)}</p>
        </div>`).join("")}
        <div class="bcneed" style="margin-top:4px">
          <span class="needlab">What we would do instead</span>
          A short call to measure the two or three numbers this rested on. If they land where you think
          they do, the forecast runs; if they don't, you have saved yourself an engagement. Either way
          the measuring is free.
        </div>
      </div>
    </div>`;
}

/* ---------- the whole report ------------------------------------------------ */
function renderPlan() {
  const cfg = PRESETS[getProfile().industry];
  const a = readAnswers();
  const inp = buildInputs(a);

  $("#planCompany").textContent = companyName();
  $("#refuseBox").innerHTML = "";
  $("#reportBody").classList.remove("hide");

  /* the refusal check runs against the plan the engine would actually
     propose, so the unit-economics test has a real commitment to test */
  const probe = forecast(inp, { n: 200, monthlyN: 100 });
  const refused = refusals(inp, probe.selected);
  renderProvenance(inp, probe);

  if (refused.length) {
    renderRefusal(refused, cfg);
    logRun(inp, probe, refused);
    attachSummaryToBooking(bookingSummary(a, cfg, null, refused));
    wireBooking();
    return;
  }

  const f = forecast(inp);
  lastRun = { inp, f, a, cfg };

  $("#planHeadline").textContent = `What the next twelve months could hold for ${companyName()}`;
  const first = f.ranked[0] ? BY_ID[f.ranked[0]] : null;
  $("#planSummary").innerHTML = first
    ? `On your numbers the widest gap is <b>${esc(first.acts)}</b>, which is why the
       <b>${esc(first.name.toLowerCase())}</b> comes first: it adds
       ${esc(money(f.sim.perService[f.ranked[0]].marginal.p50))} a month on top of everything else in the
       plan. Everything below is a difference against carrying on exactly as you are, quoted as a range,
       and every figure says whether it came from you or from us.`
    : `Nothing in the library clears its own cost on these numbers, which is a finding rather than a
       failure. The sections below show the arithmetic that got there.`;

  renderOpportunity(inp, f, cfg);
  renderForecast(inp, f, cfg);
  renderSystems(inp, f);
  renderPicked(f);
  renderRoadmap(inp, f, cfg);
  renderDream(f, cfg);
  renderGoalGap(inp, a, f, cfg);
  renderRhythm();
  renderGate(f, cfg);

  const rec = logRun(inp, f, []);
  attachSummaryToBooking(bookingSummary(a, cfg, f, [], rec));
  wireBooking();
}

function renderDream(f, cfg) {
  const fast = f.selected.some(id => ["speedlead", "missedcall", "inbox", "webchat"].includes(id));
  const firstName = f.ranked[0] ? BY_ID[f.ranked[0]].name.toLowerCase() : "first system";
  $("#dreamBox").innerHTML = `<span class="dtag">Where this is heading</span>
    <h3>An ordinary Monday, month six</h3>
    <p>It is 08:10 on a Monday in month six and the kettle is on. ${fast
      ? `Three ${esc(cfg.enquiry)} came in overnight; each got a reply in minutes, and two have already
         picked a time to talk.`
      : `Three ${esc(cfg.enquiry)} came in overnight; each is already logged and ranked by how ready it
         is to buy.`} Your approval queue holds four drafted messages, written in your voice, waiting for
    your yes before anything sends. The 08:00 report is in your inbox: what came in last week, what got
    booked, what changed, what happens next. The ${esc(firstName)} has been running so long you have
    stopped checking it. You read the report with your coffee, approve the queue in four taps, and start
    the week already ahead of it.</p>`;
}

function renderRhythm() {
  $("#planRhythm").innerHTML = [
    ["Mon", "Your report, 08:00", "What came in, what got booked, what we changed and what we're doing next."],
    ["Tue", "We build what you approved", "Your Monday approvals go live the same day."],
    ["Wed", "Mid-week watch", "If cost or response time drifts, you hear it from us first."],
    ["Thu", "Tune and test", "One change at a time, so we can tell what worked."],
    ["Fri", "Optional 15 minutes", "Useful when something big is moving, skippable when it isn't."]
  ].map(r => `<div class="rt"><div class="day">${r[0]}</div><h5>${r[1]}</h5><p>${r[2]}</p></div>`).join("");
}

function renderGate(f, cfg) {
  const one = singular(cfg.enquiry);
  const used = picked.size + 18;
  const p = Math.min(100, Math.round(used / DIAGNOSIS_INPUTS * 100));
  const med = f.mediators;
  const gates = [
    ["Your real cost per " + esc(one),
     "We read it from your ad account and re-run this forecast on it, swapping a benchmark for a measured number."],
    ["Your real answer rate",
     "This forecast predicts your phone answer rate moves from " + pct(med.phoneAnswerRate.from) + " to " +
     pct(med.phoneAnswerRate.to) + ". We measure the first figure on the call, and the second one after " +
     "launch. If it lands below " + pct(med.phoneAnswerRate.refutedBelow) + ", the model was wrong at a " +
     "link we can name."],
    ["Fit with your tools",
     "We map each build against the stack you already run, so the plan drops into your business instead of beside it."],
    ["Your deliverability position",
     "We check domain history, SPF, DKIM and DMARC before outbound switches on, because outbound shares " +
     "a reputation with the domain your invoices leave from."],
    ["Your sector's claim rules",
     "We check what marketing for " + esc(cfg.plural) + " is allowed to say before we draft a word."],
    ["Your capacity ceiling, properly",
     "The single most load-bearing answer on this page was a slider. We count it against your diary, your " +
     "team and your delivery times, because getting it wrong in either direction wastes the whole engagement."]
  ];
  $("#gateBox").innerHTML = `
    <div class="gatehead">
      <span class="gatelock">🎯</span>
      <div>
        <h3>Six things the call adds</h3>
        <p class="dim" style="font-size:14.5px;margin-top:6px;max-width:66ch">This report worked from
        ${used} answers and the benchmarks we hold for ${esc(cfg.plural)}, which is as far as honest
        modelling goes from a form. The call works from your real accounts: around ${DIAGNOSIS_INPUTS}
        inputs, most of which live in your ad account, your CRM and your DNS records.</p>
      </div>
    </div>
    <div class="covbar" style="margin:18px 0 6px"><i style="width:${p}%"></i></div>
    <p class="dim" style="font-size:12.5px;margin-bottom:14px">${p}% of a full diagnosis, from one page.
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
}

/* ---------- the forecast log ------------------------------------------------
   Client-side only. The id travels in the booking payload so a forecast can be
   scored against what actually happened, which is what the homepage promises. */
function logRun(inp, f, verdictList) {
  const out = f.monthly || { p10: 0, p50: 0, p90: 0, pPositive: 0 };
  const rec = record(inp, f.selected || [], out, {
    mediators: f.mediators || {},
    verdicts: verdictList.map(v => ({ code: v.code, message: v.message, value: v.value }))
  });
  save(rec);
  return rec;
}

/* ---------- carrying the answers to the call -------------------------------- */
function bookingSummary(a, cfg, f, refused, rec) {
  const L = [
    "From the demo blueprint (modelled, unverified) — engine v" + ENGINE_VERSION,
    rec ? "Forecast id: " + rec.id : "",
    "Business: " + companyName() + " · " + cfg.label,
    "Volume: " + a.leads + " " + cfg.enquiry + "/mo · win rate " + Math.round(a.close * 100) +
      "% · typical customer " + fmtGBP(a.value),
    "Channel mix: " + MIX[a.mix].label.toLowerCase() + " · calls answered same day: " +
      ANSWER_PHONE[a.answer].label.toLowerCase(),
    "Spare capacity: " + a.cap + " more customers/mo" + (a.capKnown === "unsure" ? " (inferred, not measured)" : ""),
    a.spend > 0 ? "Outreach budget: " + fmtGBP(a.spend) + "/mo" : "Outreach budget: not given",
    "Quotes or proposals: " + (a.quote === "yes" ? "yes" : "no"),
    "Goal: " + GOAL_LABEL[a.goal],
    "Today: first reply " + RESP_NOW[a.resp] + " · " +
      { f4: "chases 4+ times", f23: "chases 2 to 3 times", f01: "chases once" }[a.fu],
    "Picked: " + SYMPTOMS.filter(s => picked.has(s.id)).map(s => s.text).join("; ")
  ];
  if (refused && refused.length) {
    L.push("ENGINE REFUSED: " + refused.map(r => r.message).join(" | "));
  } else if (f) {
    L.push("Proposed: " + f.ranked.map(id => BY_ID[id].name).join(", "));
    L.push("Modelled net addition: " + money(f.monthly.p10) + " to " + money(f.monthly.p90) +
      " per month, central case " + money(f.monthly.p50));
    L.push("Twelve months: " + money(f.year.cumulative.p10) + " to " + money(f.year.cumulative.p90) +
      ", central case " + money(f.year.cumulative.p50));
  }
  return L.filter(Boolean).join("\n");
}

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

/* ---------- the working animation -------------------------------------------
   The engine takes about half a second of main-thread time. The animation is
   not there to hide it — it is there because six named steps tell the visitor
   what is being done to their answers. */
function runBuild() {
  const cfg = PRESETS[getProfile().industry];
  const WORK = COPY.work(cfg, GOAL_LABEL[readSeg("qGoal") || "g25"]);
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
      if (h) h.focus();
    }, gap);
  }, i * gap));
}

/* ---------- init -------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderNicheSearch($("#industrySearch"), () => { touched.delete("cap"); renderSliders(); });
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
