/* =========================================================================
   DEMO 01 · PREDICT — form → staged analysis → modelled prediction report.
   All maths is deliberately conservative and expressed as ranges. Factors
   are illustrative sector heuristics (fractions of published speed-to-lead /
   follow-up research), NOT the real TMA engine — that runs on the call.
   ========================================================================= */

/* lift factor ranges [low, high] applied to baseline revenue */
const RESP_FACTORS = { u5: [1.00, 1.03], hour: [1.02, 1.08], sameday: [1.08, 1.22], nextday: [1.18, 1.42] };
const FU_FACTORS   = { f4: [1.00, 1.03], f23: [1.04, 1.12], f01: [1.12, 1.30] };
/* share of enquiries that effectively go cold before contact, by reply speed */
const UNREACHED    = { u5: 0.02, hour: 0.07, sameday: 0.18, nextday: 0.35 };
const COMBINED_CAP = 1.75;   /* total funnel-lift ceiling — keeps the range defensible */

function readSeg(id) { const on = $("#" + id + " button.on"); return on ? on.dataset.v : null; }

function wireSegs() {
  $$(".seg").forEach(seg => seg.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $$("button", seg).forEach(x => x.classList.remove("on"));
    b.classList.add("on");
  }));
}

function prefillFromPreset() {
  const cfg = PRESETS[getProfile().industry];
  $("#qValue").value = cfg.avgValue;
  $("#qLeads").value = cfg.monthlyLeads;
  $("#qClose").value = cfg.closeRate;
}

/* ---------- the model ---------------------------------------------------- */
function analyse() {
  const cfg   = PRESETS[getProfile().industry];
  const value = Math.max(1, +$("#qValue").value || cfg.avgValue);
  const leads = Math.max(1, +$("#qLeads").value || cfg.monthlyLeads);
  const close = Math.min(95, Math.max(1, +$("#qClose").value || cfg.closeRate)) / 100;
  const resp  = readSeg("qResp"), fu = readSeg("qFu"), react = readSeg("qReact");
  const goal  = +readSeg("qGoal") || 0;

  const baseMonthly = leads * close * value;
  const baseAnnual  = baseMonthly * 12;

  const rF = RESP_FACTORS[resp], fF = FU_FACTORS[fu];
  const combinedLow  = Math.min(rF[0] * fF[0], COMBINED_CAP);
  const combinedHigh = Math.min(rF[1] * fF[1], COMBINED_CAP);

  /* dormant-list reactivation (12-month, one programme) */
  const dormant = Math.round(leads * (1 - close) * 18);           /* ~18 months of unconverted enquiries */
  const reactMult = react === "no" ? 1 : react === "some" ? 0.5 : 0;
  const reactLow  = dormant * 0.02 * value * reactMult;
  const reactHigh = dormant * 0.05 * value * reactMult;

  const upLow  = baseAnnual * (combinedLow - 1)  + reactLow;
  const upHigh = baseAnnual * (combinedHigh - 1) + reactHigh;
  /* geometric mean leans conservative, but is undefined when the low case is
     zero (a prospect who already answers fast, follows up 4+ times and works
     the dormant list) — fall back to the arithmetic midpoint there */
  const upMid  = upLow > 0 ? Math.sqrt(upLow * upHigh) : (upLow + upHigh) / 2;

  /* per-lever monthly impact (midpoints) for ranking */
  const respImpact  = baseMonthly * ((rF[0] + rF[1]) / 2 - 1);
  const fuImpact    = baseMonthly * ((fF[0] + fF[1]) / 2 - 1);
  const reactImpact = (reactLow + reactHigh) / 2 / 12;

  return { cfg, value, leads, close, resp, fu, react, goal,
           baseMonthly, baseAnnual, upLow, upMid, upHigh,
           dormant, respImpact, fuImpact, reactImpact };
}

/* ---------- report content ----------------------------------------------- */
function buildOpportunities(m) {
  const ops = [];
  const money = n => fmtGBPk(Math.max(n, 0)) + "/mo";

  if (m.resp !== "u5") ops.push({
    impact: m.respImpact, conf: "High", confCls: "hi",
    title: "Answer every enquiry in under 60 seconds — automatically",
    body: `Around ${Math.round(m.leads * UNREACHED[m.resp])} of your ${m.leads} monthly ${m.cfg.enquiry} currently go cold before anyone speaks to them. An instant, personal reply (SMS + email, written in your voice) is the single best-evidenced lever in lead generation.`,
    tag: "≈ " + money(m.respImpact) + " modelled"
  });

  if (m.fu !== "f4") ops.push({
    impact: m.fuImpact, conf: "High", confCls: "hi",
    title: "A follow-up engine that never forgets",
    body: `Most sales happen between the 3rd and 6th touch — you stop at ${m.fu === "f01" ? "one" : "two or three"}. We run a persistent, polite sequence for every unanswered enquiry, and you approve the tone once.`,
    tag: "≈ " + money(m.fuImpact) + " modelled"
  });

  if (m.react !== "yes") ops.push({
    impact: m.reactImpact, conf: "Medium", confCls: "md",
    title: "Wake your dormant list",
    body: `You're sitting on roughly ${m.dormant.toLocaleString()} past enquiries that never bought. A reactivation campaign to people who already raised their hand is usually the cheapest revenue available to you.`,
    tag: "≈ " + money(m.reactImpact) + " modelled"
  });

  if (m.close < 0.15) ops.push({
    impact: m.baseMonthly * 0.1, conf: "Medium", confCls: "md",
    title: "Fix the middle of the funnel before buying more leads",
    body: `At a ${fmtPct(m.close * 100)} close rate, extra spend multiplies waste. Qualification, booking and reminder flows lift the rate before a pound more goes on ads.`,
    tag: "Sequencing insight"
  });

  ops.push({
    impact: 0, conf: "Medium", confCls: "md",
    title: `A predictable volume engine on ${m.cfg.channels[0]}`,
    body: `Once response and follow-up stop leaking, each new ${m.cfg.deal} costs less to win — that's when we scale ${m.cfg.channels[0].toLowerCase()} spend with weekly measurement, not hope.`,
    tag: "Phase 2"
  });

  return ops.sort((a, b) => b.impact - a.impact).slice(0, 3);
}

function buildRisks(m) {
  const risks = [];
  if (m.resp === "nextday" || m.resp === "sameday") risks.push({
    sev: "High", cls: "lo", title: "The first responder wins",
    body: `${m.cfg.noun[0].toUpperCase() + m.cfg.noun.slice(1)} enquire with 2–3 providers at once. While a reply waits ${m.resp === "nextday" ? "overnight" : "hours"}, a faster competitor books the ${m.cfg.deal}. This risk compounds with every pound you spend on marketing.`
  });
  risks.push({
    sev: "Medium", cls: "md", title: `Single-channel dependence on ${m.cfg.channels[0]}`,
    body: `If most enquiries arrive via ${m.cfg.channels[0]}, a cost spike or policy change there hits revenue directly. The plan should include a second proven channel (${m.cfg.channels[1] || "referrals"}).`
  });
  if (m.close >= 0.3) risks.push({
    sev: "Medium", cls: "md", title: "Capacity ceiling",
    body: `A ${fmtPct(m.close * 100)} close rate says sales isn't the constraint — delivery is. Growth plans that ignore capacity break operations first. We model this before recommending spend.`
  });
  else risks.push({
    sev: "Medium", cls: "md", title: "Measurement gap",
    body: `If close rate and enquiry counts are estimates rather than tracked numbers, every decision downstream inherits the error. Fixing tracking is week-one work.`
  });
  return risks.slice(0, 3);
}

function buildAha(m) {
  const em = s => `<span class="bignum">${s}</span>`;
  if (m.resp === "nextday" || m.resp === "sameday") {
    const lost = Math.round(m.leads * UNREACHED[m.resp]);
    const dead = lost * m.close * m.value;
    return `<h3>The thing most people miss</h3>
      <p>You don't have a lead problem — you have a <b>response-time</b> problem. At ${em(m.leads + " enquiries/mo")}
      with ${m.resp === "nextday" ? "next-day" : "same-day"} replies, roughly ${em(lost + " enquiries a month")} go cold
      before anyone speaks to them. At your close rate and ${fmtGBP(m.value)} average value, that's
      ${em("~" + fmtGBPk(dead) + "/month")} of pipeline dying before you spend a penny more on marketing.
      Fixing this costs a fraction of buying more leads.</p>`;
  }
  if (m.react !== "yes") {
    return `<h3>The thing most people miss</h3>
      <p>Your cheapest revenue isn't new leads — it's the ${em(m.dormant.toLocaleString() + " past enquiries")} already
      in your inbox who never bought. They know you, they raised their hand once, and nobody has spoken to them since.
      A respectful reactivation campaign typically re-engages 2–5% — at ${fmtGBP(m.value)} a ${m.cfg.deal}, that's real
      money from a list you already paid to build.</p>`;
  }
  if (m.fu !== "f4") {
    return `<h3>The thing most people miss</h3>
      <p>Speed and volume are fine — persistence is your gap. Most ${m.cfg.noun} say yes between the
      ${em("3rd and 6th touch")}, and your follow-up stops before that window opens. The revenue isn't lost;
      it's sitting one polite reminder away.</p>`;
  }
  const need = m.goal ? Math.round(m.leads * m.goal / 100) : Math.round(m.leads * 0.5);
  const altPts = Math.min(20, Math.max(2, Math.round((m.close * (m.goal || 50) / 100) * 100)));
  return `<h3>The thing most people miss</h3>
    <p>Your funnel is already tight — so the question becomes <b>which lever is cheaper</b>. To hit your goal you'd need
    ${em("~" + need + " more enquiries/mo")} at today's close rate… or ${em("+" + altPts + " points of close rate")}
    on the volume you already have. The second is usually 3–5× cheaper. That's exactly what the full engine
    calculates on your real numbers.</p>`;
}

function buildSteps(m) {
  const top = buildOpportunities(m)[0];
  return [
    { n: 1, chips: [["blue", "Now"], ["hi", "Free"]],
      title: "Diagnosis call — the full engine on your real numbers",
      body: "≈90 questions, your actual funnel and spend. You leave with the complete model whether or not we work together." },
    { n: 2, chips: [["blue", "Week 1"], ["md", "Entry build"]],
      title: `First build: ${top ? top.title.toLowerCase().replace(/ — .*/, "") : "the highest-impact fix"}`,
      body: "A small, focused build delivered inside a week — you describe the outcome, we build and run it, you approve everything that goes out." },
    { n: 3, chips: [["violet", "Ongoing"]],
      title: "The weekly Grow loop",
      body: "Dashboard, weekly recommendations you approve, proactive check-ins. Growth as a partnership, not a project. (That's Demo 03.)" }
  ];
}

/* ---------- render -------------------------------------------------------- */
function renderReport(m) {
  $("#repCompany").textContent = companyName();
  $("#repBig").textContent  = fmtGBPk(m.upMid);
  $("#repLow").textContent  = fmtGBPk(m.upLow);
  $("#repMid").textContent  = fmtGBPk(m.upMid);
  $("#repHigh").textContent = fmtGBPk(m.upHigh);
  $("#repSummary").textContent =
    `Baseline: ${m.leads} ${m.cfg.enquiry}/mo × ${fmtPct(m.close * 100)} close × ${fmtGBP(m.value)} ≈ ` +
    `${fmtGBPk(m.baseMonthly)}/mo today. The range above is what the modelled fixes add across 12 months — ` +
    `before any increase in marketing spend.`;

  $("#repOps").innerHTML = buildOpportunities(m).map(o => `
    <div class="opcard">
      <div class="ophead"><h4>${o.title}</h4></div>
      <p>${o.body}</p>
      <div class="opfoot">
        <span class="chip ${o.confCls}">Confidence: ${o.conf}</span>
        <span class="chip blue">${o.tag}</span>
      </div>
    </div>`).join("");

  $("#repAha").innerHTML = buildAha(m);

  $("#repRisks").innerHTML = buildRisks(m).map(r => `
    <div class="opcard">
      <div class="ophead"><h4>${r.title}</h4><span class="chip ${r.cls}">${r.sev}</span></div>
      <p>${r.body}</p>
    </div>`).join("");

  $("#repSteps").innerHTML = buildSteps(m).map(s => `
    <div class="step-row">
      <span class="snum">${s.n}</span>
      <div><h4>${s.title}</h4><p>${s.body}</p></div>
      <div class="schips">${s.chips.map(c => `<span class="chip ${c[0]}">${c[1]}</span>`).join("")}</div>
    </div>`).join("");
}

/* ---------- staged analysis animation ------------------------------------- */
const STAGES = [
  "Reading your funnel",
  "Benchmarking your sector",
  "Applying conservative range factors",
  "Ranking opportunities & risks",
  "Writing your report"
];

function runAnalysis() {
  const m = analyse();
  $("#formStage").classList.add("hide");
  $("#analyseStage").classList.remove("hide");
  window.scrollTo({ top: 0, behavior: "instant" });

  const box = $("#stageSteps");
  box.innerHTML = STAGES.map(s =>
    `<div class="stage-step"><span class="ic">·</span><span>${s}</span></div>`).join("");
  const rows = $$(".stage-step", box);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stepMs = reduced ? 60 : 620;

  let i = 0;
  (function tick() {
    if (i > 0) { rows[i - 1].classList.remove("run"); rows[i - 1].classList.add("done"); rows[i - 1].querySelector(".ic").textContent = "✓"; }
    if (i >= rows.length) {
      $("#analyseStage").classList.add("hide");
      renderReport(m);
      $("#reportStage").classList.remove("hide");
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    rows[i].classList.add("run"); rows[i].querySelector(".ic").textContent = "";
    $("#analyseTitle").textContent = STAGES[i] + "…";
    i++;
    setTimeout(tick, stepMs);
  })();
}

/* ---------- init ----------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderPicker($("#industryPick"), prefillFromPreset);
  wireNameInput($("#bizname"));
  wireSegs();
  prefillFromPreset();
  $("#runBtn").addEventListener("click", runAnalysis);
  $("#rerunBtn").addEventListener("click", () => {
    $("#reportStage").classList.add("hide");
    $("#formStage").classList.remove("hide");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});
