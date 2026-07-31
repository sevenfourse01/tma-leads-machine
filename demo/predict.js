/* =========================================================================
   DEMO 01 · PREDICT — seven answers → a real Monte Carlo forecast.

   The maths lives in engine.js, a faithful browser port of the production
   engine (PREDICTION-ENGINE/revenue_model.py): Beta-PERT three-point inputs,
   the same funnel chain, cohort revenue, payback arithmetic and refusal rules.
   Verified against the Python engine at 200,000 draws — percentiles agree to
   within Monte Carlo error (<0.4%).

   This file's job is only to turn seven plain-English answers into a Profile
   the engine can simulate, and to render what comes back honestly.
   ========================================================================= */

/* ---------- sector economics --------------------------------------------
   What the demo ASSUMES when the prospect hasn't told us. Every one of these
   is surfaced in the provenance grid on the report, so a prospect can see
   exactly which numbers are theirs and which are ours. The real engine
   measures these on the diagnosis call instead of assuming them.

   NOTE ON cpl: this is the cost of one NEW enquiry bought from advertising —
   NOT total spend divided by total enquiries. Those are different numbers by a
   wide margin, because most businesses get referral and organic enquiries that
   no budget paid for. Deriving cost per lead by division was the first version
   of this file and it produced nonsense: a vet practice buying 49 extra
   enquiries a month for £900 and more than doubling itself. The real engine
   reads the actual ad account; the demo uses a sector benchmark and says so. */
const SECTOR_ECON = {
  dental:      { margin: 0.62, spend: 1500, cpl: [28, 45, 85],  leadToCall: 0.55, callShow: 0.80 },
  aesthetics:  { margin: 0.68, spend: 1800, cpl: [22, 35, 65],  leadToCall: 0.58, callShow: 0.76 },
  hvac:        { margin: 0.42, spend: 2000, cpl: [45, 70, 130], leadToCall: 0.62, callShow: 0.85 },
  recruitment: { margin: 0.55, spend: 1200, cpl: [70, 120, 240], leadToCall: 0.45, callShow: 0.82 },
  ifa:         { margin: 0.70, spend: 1000, cpl: [55, 95, 180], leadToCall: 0.50, callShow: 0.78 },
  vet:         { margin: 0.55, spend: 900,  cpl: [18, 30, 55],  leadToCall: 0.65, callShow: 0.88 },
  estate:       { margin: 0.6, spend: 1200, cpl: [30, 55, 110], leadToCall: 0.5, callShow: 0.75 },
  law:          { margin: 0.65, spend: 2000, cpl: [45, 80, 160], leadToCall: 0.6, callShow: 0.78 },
  accounting:   { margin: 0.7, spend: 1200, cpl: [50, 90, 180], leadToCall: 0.6, callShow: 0.75 },
  mortgage:     { margin: 0.7, spend: 1200, cpl: [35, 60, 120], leadToCall: 0.52, callShow: 0.78 },
  msp:          { margin: 0.6, spend: 1200, cpl: [75, 150, 300], leadToCall: 0.6, callShow: 0.75 },
  agency:       { margin: 0.6, spend: 1200, cpl: [65, 130, 280], leadToCall: 0.45, callShow: 0.7 },
  construction: { margin: 0.38, spend: 800, cpl: [25, 55, 110], leadToCall: 0.5, callShow: 0.75 },
  solar:        { margin: 0.4, spend: 2500, cpl: [30, 65, 130], leadToCall: 0.45, callShow: 0.7 },
  cleaning:     { margin: 0.35, spend: 900, cpl: [25, 55, 110], leadToCall: 0.6, callShow: 0.75 },
  gym:          { margin: 0.6, spend: 900, cpl: [10, 20, 38], leadToCall: 0.45, callShow: 0.62 },
  physio:       { margin: 0.55, spend: 1000, cpl: [25, 42, 75], leadToCall: 0.62, callShow: 0.78 },
  education:    { margin: 0.45, spend: 800, cpl: [22, 40, 80], leadToCall: 0.58, callShow: 0.72 },
  other:        { margin: 0.55, spend: 1500, cpl: [30, 55, 110], leadToCall: 0.55, callShow: 0.75 }
};

/* Conservative improvement ranges for the two levers the service actually
   pulls. The LOW end of every band is ~1.0 — the pessimistic case is "we run
   your funnel no better than you run it today". Nothing here claims a result;
   they only widen a distribution. */
const RESP_FACTORS = { u5: [1.00, 1.03], hour: [1.02, 1.08], sameday: [1.08, 1.22], nextday: [1.18, 1.42] };
const FU_FACTORS   = { f4: [1.00, 1.03], f23: [1.04, 1.12], f01: [1.12, 1.30] };

/* The two engagement shapes from the pricing page. We model the TOP of the
   published core range — a forecast that flatters itself by assuming the
   cheapest possible fee is not a forecast. */
const TIERS = {
  core:  { label: "the full machine", build: 10000, monthly: 2500 },
  entry: { label: "an entry build",   build: 1000,  monthly: 0 }
};


/* ---------- reading the form --------------------------------------------- */
function readSeg(id) { const on = $("#" + id + " button.on"); return on ? on.dataset.v : null; }

function readAnswers() {
  const cfg = PRESETS[getProfile().industry];
  const num = (id, dflt) => {
    const v = parseFloat($("#" + id).value);
    return Number.isFinite(v) && v > 0 ? v : dflt;
  };
  return {
    value: num("qValue", cfg.avgValue),
    leads: num("qLeads", cfg.monthlyLeads),
    close: Math.min(95, num("qClose", cfg.closeRate)) / 100,
    spend: parseFloat($("#qSpend").value),
    resp: readSeg("qResp") || "sameday",
    fu: readSeg("qFu") || "f01",
    repeat: readSeg("qRepeat") || "oneoff"
  };
}

/* A conversion rate with an improvement band, clamped so it can never leave
   [0, cap]. Without the clamp a prospect entering a 95% close rate pushed the
   low end above the cap and Est refused the inverted triple — a crash on a
   legitimate answer. When the clamp collapses the band, Beta-PERT correctly
   degenerates to a point mass. `mode` sits at the LOW end deliberately. */
function rateBand(base, fLow, fMode, fHigh, cap, label) {
  const c = v => Math.min(cap, Math.max(0, base * v));
  const s = [c(fLow), c(fMode), c(fHigh)].sort((x, y) => x - y);
  return Est(s[0], s[1], s[2], false, label);
}

/* ---------- seven answers → an engine Profile ---------------------------- */
function buildProfile(a, tier) {
  const id = getProfile().industry;
  const cfg = PRESETS[id], econ = SECTOR_ECON[id];
  const flags = [];

  /* Spend is the decision variable. A forecast at zero spend is a forecast of
     zero new leads, so if they leave it blank we model the sector's typical
     starting budget and say so, rather than returning a confident nothing. */
  let spend = a.spend;
  if (!Number.isFinite(spend) || spend <= 0) {
    spend = econ.spend;
    flags.push("You didn't give a marketing budget, so we modelled " + fmtGBP(spend) +
      " a month, a typical starting spend for this sector. At £0 there is nothing " +
      "for the model to scale.");
  }

  /* Sector benchmark for the cost of a bought enquiry — see the note on
     SECTOR_ECON. Never spend ÷ enquiries. */
  const cplMode = econ.cpl[1];

  /* They gave ONE overall conversion rate; the engine models three stages. We
     split it on sector-typical shares so the product equals the number they
     actually gave us, then let the two levers move the outer stages. */
  let l2c = econ.leadToCall, show = econ.callShow;
  let closeBase = a.close / (l2c * show);
  if (closeBase > 0.85) {              /* stated conversion is very high —
                                          push the surplus up the funnel */
    const excess = Math.sqrt(closeBase / 0.85);
    l2c = Math.min(0.95, l2c * excess);
    show = Math.min(0.98, show * excess);
    closeBase = Math.min(0.95, a.close / (l2c * show));
  }

  /* The central case assumes the SMALLEST improvement in each band (mode =
     low). Beta-PERT with mode at the low end is right-skewed: usually the
     modest gain, occasionally the big one. The alternative — a mid-band mode —
     quietly assumed a ~39% conversion lift as the typical outcome. */
  const r = RESP_FACTORS[a.resp], f = FU_FACTORS[a.fu];

  const v = a.value;
  let mrr, ret;
  if (a.repeat === "retainer") {
    mrr = Est(v * 0.06, v * 0.10, v * 0.18, true, "monthly value");
    ret = Est(6, 12, 24, true, "how long they stay");
  } else if (a.repeat === "repeat") {
    mrr = Est(v * 0.02, v * 0.05, v * 0.09, true, "monthly value");
    ret = Est(3, 6, 12, true, "how long they stay");
  } else {
    mrr = Est(0, 0, 0, true, "monthly value");
    ret = Est(0, 0, 0, true, "how long they stay");
  }

  const profile = {
    horizonMonths: 12,
    monthlySpend: spend,
    costPerLead: Est(econ.cpl[0], econ.cpl[1], econ.cpl[2], false, "cost per enquiry"),
    /* levers: mode at the LOW end — the central case assumes the smallest
       improvement we'd expect. show-up rate is not a lever, so its mode sits
       on the sector norm with symmetric noise either side. */
    leadToCall: rateBand(l2c, r[0], r[0], r[1], 0.95, "enquiry → conversation"),
    callShow: rateBand(show, 0.92, 1.00, 1.06, 0.98, "they turn up"),
    showToClose: rateBand(closeBase, f[0], f[0], f[1], 0.95, "conversation → sale"),
    dealValue: Est(v * 0.80, v, v * 1.35, true, "value of a customer"),
    monthlyRecurring: mrr,
    retentionMonths: ret,
    grossMargin: Est(Math.max(0.05, econ.margin - 0.08), econ.margin, Math.min(0.95, econ.margin + 0.08), false, "gross margin"),
    tmaBuildFee: tier.build,
    tmaMonthly: tier.monthly,
    baselineDealsPerMonth: Est(a.leads * a.close * 0.85, a.leads * a.close, a.leads * a.close * 1.15, true, "what you close today")
  };
  /* Saturation anchored to the SIZE OF THEIR BUSINESS, not to their spend: a
     business turning over £13k a month cannot absorb £6k a month of ads at a
     flat cost per lead. Anchoring it to spend (the first version) made the
     multiplier a constant and did no work at all. */
  const baseRevenue = a.leads * a.close * a.value;
  const cap = Math.max(500, baseRevenue * 0.5);
  /* the ceiling is a finiteness guard, NOT a modelling choice — capping it low
     (4×) let a £50k/month budget on a £14k/month business go linear again and
     buy 176 new customers a month. Saturation is supposed to bite. */
  const mult = Math.min(25, 1 + Math.pow(spend / cap, 1.4));

  return { profile, spend, flags, cplMode, econ, cfg, mult, cap, baseRevenue,
           baselineDeals: a.leads * a.close };
}

/* ---------- running it ---------------------------------------------------- */
let LAST = null;

function runEngine() {
  const a = readAnswers();

  /* Model the full machine first. If it cannot clear its own fee for this
     business more often than not, model the entry build instead and say why —
     the same call a decent adviser makes, and the one the site promises. */
  let tierKey = "core";
  let built = buildProfile(a, TIERS.core);
  const mult = built.mult;
  let sim = simulate(built.profile, { n: N_SIMS, cplMultiplier: mult });
  let rep = report(built.profile, sim);
  let downgraded = null;

  if (rep.pBeatOurFee < 0.5) {
    downgraded = rep.pBeatOurFee;
    tierKey = "entry";
    built = buildProfile(a, TIERS.entry);
    sim = simulate(built.profile, { n: N_SIMS, cplMultiplier: mult });
    rep = report(built.profile, sim);
  }

  /* Counterfactual runs: neutralise one lever at a time and diff the medians.
     This is what each fix is worth inside this specific funnel — measured by
     re-simulation, not asserted. */
  const levers = {};
  [["resp", "u5"], ["fu", "f4"]].forEach(pair => {
    const flat = Object.assign({}, a);
    flat[pair[0]] = pair[1];                 /* the already-perfect setting */
    const b2 = buildProfile(flat, TIERS[tierKey]);
    const r2 = report(b2.profile, simulate(b2.profile, { n: N_SIMS, cplMultiplier: mult }));
    levers[pair[0]] = rep.upliftVsNoIntervention.p50 - r2.upliftVsNoIntervention.p50;
  });

  LAST = { a, built, sim, rep, tier: TIERS[tierKey], tierKey, downgraded, levers, mult };
  return LAST;
}

/* ---------- distribution chart -------------------------------------------
   4,000 real draws, binned. The zero line is the decision line: everything
   left of it is a scenario where this loses money. */
function histogram(draws, p10, p50, p90) {
  const W = 720, H = 190, PAD = 26, BINS = 46;
  const lo = Math.min.apply(null, draws), hi = Math.max.apply(null, draws);
  const span = (hi - lo) || 1;
  const counts = new Array(BINS).fill(0);
  draws.forEach(v => {
    let b = Math.floor((v - lo) / span * BINS);
    if (b >= BINS) b = BINS - 1;
    if (b < 0) b = 0;
    counts[b]++;
  });
  const peak = Math.max.apply(null, counts) || 1;
  const x = v => PAD + (v - lo) / span * (W - PAD * 2);
  const bw = (W - PAD * 2) / BINS;

  const bars = counts.map((c, i) => {
    const binMid = lo + ((i + 0.5) / BINS) * span;
    const h = (c / peak) * (H - 46);
    return `<rect x="${(PAD + i * bw).toFixed(1)}" y="${(H - 26 - h).toFixed(1)}" ` +
      `width="${Math.max(0.8, bw - 1).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" ` +
      `fill="${binMid < 0 ? "rgba(255,107,107,.45)" : "rgba(77,163,255,.55)"}"></rect>`;
  }).join("");

  const mark = (v, col, label, dash) => {
    if (!Number.isFinite(v) || v < lo || v > hi) return "";
    const px = x(v).toFixed(1);
    return `<line x1="${px}" y1="14" x2="${px}" y2="${H - 26}" stroke="${col}" ` +
      `stroke-width="1.4"${dash ? ' stroke-dasharray="4 4"' : ""}></line>` +
      `<text x="${px}" y="10" fill="${col}" font-size="10.5" font-weight="700" ` +
      `text-anchor="middle">${label}</text>`;
  };

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" ` +
    `aria-label="Distribution of ${draws.length} simulated twelve-month outcomes">
    ${bars}
    <line x1="${PAD}" y1="${H - 26}" x2="${W - PAD}" y2="${H - 26}" stroke="rgba(255,255,255,.22)"></line>
    ${mark(0, "#ffb3b3", "BREAK EVEN", false)}
    ${mark(p10, "rgba(183,192,204,.9)", "P10", true)}
    ${mark(p50, "#9fd6b8", "P50", false)}
    ${mark(p90, "rgba(183,192,204,.9)", "P90", true)}
    <text x="${PAD}" y="${H - 10}" fill="rgba(142,154,168,.9)" font-size="10.5">${money(lo)}</text>
    <text x="${W - PAD}" y="${H - 10}" fill="rgba(142,154,168,.9)" font-size="10.5" text-anchor="end">${money(hi)}</text>
  </svg>`;
}

/* ---------- report --------------------------------------------------------
   A bare 100% or 0% is a fabricated certainty — 4,000 draws of an assumed
   model cannot establish either. We clamp the display and footnote it. */
const pct = p => Math.round(p * 100) + "%";
/* shared.js's fmtGBPk renders −17118 as "£-17,118"; a forecast that can come
   out negative needs the sign in front of the £, and the k-scale on both sides */
const money = n => (n < 0 ? "−" : "") + fmtGBPk(Math.abs(n));
const pctSafe = p => {
  const r = Math.round(p * 100);
  if (r >= 100) return "≥99%";
  if (r <= 0) return "≤1%";
  return r + "%";
};
const isExtreme = p => Math.round(p * 100) >= 100 || Math.round(p * 100) <= 0;

const NICE_INPUT = {
  cost_per_lead: "What an enquiry costs you", lead_to_call: "Enquiry → conversation",
  call_show: "They turn up", show_to_close: "Conversation → sale",
  deal_value: "What a customer is worth", monthly_recurring: "Repeat revenue",
  retention_months: "How long they stay", gross_margin: "Your gross margin",
  baseline_deals_per_month: "What you close today"
};

function renderReport(R) {
  const { a, built, rep, tier, downgraded, levers } = R;
  const u = rep.upliftVsNoIntervention;

  $("#repCompany").textContent = companyName();
  $("#repBig").textContent = money(u.p50);
  $("#repLow").textContent = money(u.p10);
  $("#repHigh").textContent = money(u.p90);
  $("#repHeadline").textContent = u.p50 >= 0
    ? "Modelled 12-month profit, after everything"
    : "Modelled 12-month result: negative";

  $("#repSummary").innerHTML =
    `The median of <b>${rep.nSims.toLocaleString("en-GB")}</b> simulated years, after ` +
    `${fmtGBP(rep.adCostTotal)} of ad spend and ${fmtGBP(rep.tmaCostTotal)} of our fees ` +
    `(modelled as <b>${tier.label}</b>). The band either side is the middle 80% of outcomes: ` +
    `1 year in 10 lands below ${money(u.p10)}, 1 in 10 above ${money(u.p90)}. ` +
    `That is <b>${rep.dealsPerMonth.p50.toFixed(1)} new sales a month</b> against the ` +
    `<b>${built.baselineDeals.toFixed(1)}</b> you already close. Sense-check that against ` +
    `your own capacity before you believe it. Monte Carlo error on the median is about ` +
    `${fmtGBP(rep.upliftMcStdError || 0)}.`;

  $("#repDist").innerHTML = histogram(rep.upliftDraws, u.p10, u.p50, u.p90);

  const pb = rep.paybackMonth;
  const tile = (label, val, sub, cls) => `<div class="kpi">
    <div class="klabel">${label}</div>
    <div class="kval">${val}<span class="kdelta ${cls}">${sub}</span></div></div>`;
  $("#repProbs").innerHTML = [
    tile("Beats our fee", pctSafe(rep.pBeatOurFee), "of simulated years",
      rep.pBeatOurFee >= 0.6 ? "up" : rep.pBeatOurFee >= 0.4 ? "flat" : "down"),
    tile("You lose money", pctSafe(rep.pLoseMoney), "of simulated years",
      rep.pLoseMoney <= 0.25 ? "up" : rep.pLoseMoney <= 0.5 ? "flat" : "down"),
    tile("Pays for itself",
      pb.p50AmongThoseThatPayBack ? "month " + pb.p50AmongThoseThatPayBack : "not in 12mo",
      pb.p50AmongThoseThatPayBack ? pct(pb.shareThatPayBack) + " of years do" : "on these numbers",
      pb.shareThatPayBack >= 0.6 ? "up" : pb.shareThatPayBack >= 0.35 ? "flat" : "down"),
    tile("New sales a month", rep.dealsPerMonth.p50.toFixed(1),
      rep.dealsPerMonth.p10.toFixed(1) + "–" + rep.dealsPerMonth.p90.toFixed(1) + " range", "flat")
  ].join("");

  /* the "we'll tell you not to buy" moment */
  const warn = $("#repWarn");
  if (downgraded !== null) {
    warn.classList.remove("hide");
    warn.innerHTML = `<h3>We modelled the full machine first. It didn't clear its own fee.</h3>
      <p>On your numbers, ${fmtGBP(TIERS.core.build)} plus ${fmtGBP(TIERS.core.monthly)} a month came out
      ahead in only <b>${pctSafe(downgraded)}</b> of simulated years. So the forecast above is for an
      <b>entry build</b> instead: one scoped job at ${fmtGBP(TIERS.entry.build)}, no retainer.
      We would rather sell you the small thing that works than the big thing that doesn't.</p>`;
  } else warn.classList.add("hide");

  const top = rep.sensitivity.slice(0, 5);
  const maxC = Math.abs(top[0].correlation) || 1;
  $("#repDrivers").innerHTML = top.map(d => {
    const w = Math.abs(d.correlation) / maxC * 100;
    const pos = d.correlation > 0;
    return `<div class="drv">
      <span class="dlab">${NICE_INPUT[d.input] || d.input}</span>
      <span class="dbar"><i style="width:${w.toFixed(0)}%;background:${pos ? "rgba(77,163,255,.75)" : "rgba(255,107,107,.7)"}"></i></span>
      <span class="dval">${pos ? "+" : "−"}${Math.abs(d.correlation).toFixed(2)}</span>
    </div>`;
  }).join("");

  /* provenance — whose number is whose */
  const rows = [
    ["Value of a customer", fmtGBP(a.value), "you"],
    ["Enquiries a month", a.leads, "you"],
    ["Your conversion rate", fmtPct(a.close * 100), "you"],
    ["Marketing spend", fmtGBP(built.spend) + "/mo", built.flags.length ? "assumed" : "you"],
    ["Cost of a bought enquiry", fmtGBP(built.econ.cpl[0]) + "–" + fmtGBP(built.econ.cpl[2]) +
      ", modelled at " + fmtGBP(built.cplMode * R.mult) + " once scaled", "assumed"],
    ["Gross margin", fmtPct(built.econ.margin * 100), "assumed"],
    ["Funnel stage split", fmtPct(built.econ.leadToCall * 100) + " → " + fmtPct(built.econ.callShow * 100), "assumed"],
    ["Our fee", fmtGBP(tier.build) + " + " + fmtGBP(tier.monthly) + "/mo", "assumed"],
    ["Where your market saturates", "assumed near " + fmtGBPk(built.cap) + "/mo of spend", "diagnosis"]
  ];
  const badge = k => k === "you" ? '<span class="pill booked">your number</span>'
    : k === "derived" ? '<span class="pill nurture">derived</span>'
    : k === "diagnosis" ? '<span class="pill review">needs the call</span>'
    : '<span class="pill hot">sector assumption</span>';
  $("#repProv").innerHTML = rows.map(r =>
    `<div class="cfg-row"><span class="k">${r[0]}</span>` +
    `<span class="v">${r[1]} &nbsp;${badge(r[2])}</span></div>`).join("");

  /* levers, priced by counterfactual re-simulation */
  const RESP_TXT = { u5: "inside 5 minutes", hour: "within the hour", sameday: "the same day", nextday: "the next day or later" };
  const FU_TXT = { f01: "0–1 times", f23: "2–3 times", f4: "4 or more times" };
  const leverRows = [];
  if (levers.resp > 0) leverRows.push(["Answer every enquiry inside 5 minutes",
    "Today you reply " + RESP_TXT[a.resp] + ". We re-ran the entire simulation with that one " +
    "thing fixed and nothing else touched. This is the difference in the median.", levers.resp]);
  if (levers.fu > 0) leverRows.push(["Chase every quiet enquiry 4+ times",
    "Today you chase " + FU_TXT[a.fu] + ". Same 4,000 draws, same inputs, only the " +
    "follow-up count changed.", levers.fu]);
  $("#repLevers").innerHTML = leverRows.length
    ? leverRows.map((l, i) => `<div class="step-row">
        <span class="snum">${i + 1}</span>
        <div><h4>${l[0]} <span class="chip hi" style="margin-left:6px">+${money(l[2])} on the median</span></h4>
        <p>${l[1]}</p></div></div>`).join("")
    : `<div class="step-row"><span class="snum">✓</span><div>
        <h4>Your response time and follow-up are already where we'd put them</h4>
        <p>The two levers we usually pull are already pulled, so this forecast assumes no
        improvement to either. Any gain would have to come from somewhere else. That is
        what the full diagnosis goes looking for.</p></div></div>`;

  const notes = built.flags.slice();
  if (isExtreme(rep.pBeatOurFee) || isExtreme(rep.pLoseMoney))
    notes.push("One of the probabilities above rounded to a certainty. It isn't one: every " +
      "one of 4,000 draws fell the same side of the line, under assumptions we chose. We cap the " +
      "display rather than print 100%.");
  notes.push("The cost of a bought enquiry is a sector benchmark, not your ad account. It is the " +
    "single input most likely to move this answer. See the drivers list.");
  notes.push("We draw each input independently. Real funnels are correlated, which would narrow this band.");
  notes.push("Nothing here models your capacity to serve the extra work.");
  if (rep.discardedNonFiniteShare > 0)
    notes.push(pct(rep.discardedNonFiniteShare) + " of draws came out non-finite; we dropped them.");
  $("#repNotes").innerHTML = notes.map(n => `<li>${n}</li>`).join("");
  $("#repMethod").textContent = rep.method;
}

/* ---------- refusal ------------------------------------------------------- */
function renderRefusal(err) {
  $("#reportStage").classList.add("hide");
  $("#refuseStage").classList.remove("hide");
  const why = (err && err.reasons && err.reasons.length) ? err.reasons : [err ? err.message : "unknown"];
  $("#refuseWhy").innerHTML = why.map(r => `<li>${r}</li>`).join("");
}

/* ---------- staged analysis ----------------------------------------------
   Every line names something the engine actually does. */
const STAGES = [
  "Reading your funnel",
  "Building three-point ranges for every input",
  "Simulating 4,000 twelve-month outcomes",
  "Ranking what drives the answer",
  "Writing your report"
];

function runAnalysis() {
  let R = null, failed = null;
  try { R = runEngine(); } catch (e) { failed = e; }

  $("#formStage").classList.add("hide");
  $("#refuseStage").classList.add("hide");
  $("#analyseStage").classList.remove("hide");
  window.scrollTo({ top: 0, behavior: "smooth" });

  const box = $("#stageSteps");
  box.innerHTML = STAGES.map(s => `<div class="stage-step"><span class="ic"></span>${s}</div>`).join("");
  const rows = $$(".stage-step", box);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const step = reduced ? 60 : 620;

  rows.forEach((el, i) => setTimeout(() => {
    rows.forEach((r, j) => {
      r.classList.toggle("run", j === i);
      r.classList.toggle("done", j < i);
    });
    $("#analyseTitle").textContent = STAGES[i] + "…";
  }, i * step));

  setTimeout(() => {
    rows.forEach(r => { r.classList.remove("run"); r.classList.add("done"); });
    $("#analyseStage").classList.add("hide");
    if (failed) { renderRefusal(failed); return; }
    $("#reportStage").classList.remove("hide");
    renderReport(R);
    initReveal();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, STAGES.length * step + (reduced ? 40 : 420));
}

/* ---------- form wiring ---------------------------------------------------- */
function prefill() {
  const id = getProfile().industry;
  const cfg = PRESETS[id], econ = SECTOR_ECON[id];
  $("#qValue").value = cfg.avgValue;
  $("#qLeads").value = cfg.monthlyLeads;
  $("#qClose").value = cfg.closeRate;
  $("#qSpend").value = econ.spend;
  $$(".noun").forEach(el => { el.textContent = cfg.enquiry; });
}

function wireSegs() {
  ["qResp", "qFu", "qRepeat"].forEach(id => {
    $$("#" + id + " button").forEach(b => b.addEventListener("click", () => {
      $$("#" + id + " button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
    }));
  });
}

function backToForm() {
  $("#reportStage").classList.add("hide");
  $("#refuseStage").classList.add("hide");
  $("#formStage").classList.remove("hide");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  renderPicker($("#industryPick"), prefill);
  wireNameInput($("#bizname"), () => {
    if (!$("#reportStage").classList.contains("hide")) $("#repCompany").textContent = companyName();
  });
  prefill();
  wireSegs();
  $("#runBtn").addEventListener("click", runAnalysis);
  $$("[data-rerun]").forEach(b => b.addEventListener("click", backToForm));
});
