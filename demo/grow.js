/* =========================================================================
   DEMO 03 · GROW — a week in the life once the build is live.
   Weekly dashboard, AI recommendations you approve, the four standing
   questions, the check-in rhythm, and 24/7 cover.
   Every number here is example data for an illustrative account — the real
   reporting is built from the client's own systems.
   ========================================================================= */

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/* Singularise the LAST word only. Stripping a trailing "s" at every word
   boundary turned "new business enquiries" into "new busines enquiry". */
const singular = s => String(s).replace(/(\w+)$/, w => w.replace(/ies$/, "y").replace(/s$/, ""));

/* ---------- the four example weeks ---------------------------------------
   Shape: an improving trend with a deliberate week-3 setback (cost per
   enquiry spikes, bookings dip slightly). Real weeks are not monotonic and
   pretending otherwise is the fastest way to lose trust on the call. */
const WEEK_SHAPE = [
  { label: "Week 1", lead: 1.00, close: 1.00, resp: 74, cpl: 1.00, mix: 0.96, wait: 2 },
  { label: "Week 2", lead: 1.12, close: 1.08, resp: 49, cpl: 0.93, mix: 1.02, wait: 1 },
  { label: "Week 3", lead: 1.08, close: 0.98, resp: 44, cpl: 1.11, mix: 0.99, wait: 3 },
  { label: "Week 4", lead: 1.24, close: 1.18, resp: 38, cpl: 0.88, mix: 1.08, wait: 1 }
];

function weekData(cfg) {
  const base = Math.max(4, Math.round(cfg.monthlyLeads / 4));
  const cr = cfg.closeRate / 100;
  /* illustrative cost per enquiry, scaled off deal size and clamped to a
     believable band — labelled example data wherever it is shown */
  const cpl0 = Math.min(220, Math.max(15, Math.round(cfg.avgValue * 0.035 / 5) * 5));
  return WEEK_SHAPE.map(s => {
    const enq = Math.round(base * s.lead);
    const booked = Math.max(1, Math.round(enq * cr * s.close));
    const cpl = Math.round(cpl0 * s.cpl);
    /* deal mix moves week to week, so booked value isn't just count × average */
    return {
      label: s.label, enq, booked, resp: s.resp, cpl, wait: s.wait,
      value: Math.round(booked * cfg.avgValue * s.mix)
    };
  });
}

/* ---------- KPI tiles ----------------------------------------------------- */
function spark(vals, sel, lowerIsBetter) {
  const w = 120, h = 30, pad = 3.5;
  const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  const rng = (max - min) || 1;
  const px = i => pad + i * (w - pad * 2) / (vals.length - 1);
  const py = i => h - pad - ((vals[i] - min) / rng) * (h - pad * 2);
  const pts = vals.map((v, i) => px(i).toFixed(1) + "," + py(i).toFixed(1)).join(" ");
  const better = lowerIsBetter ? vals[sel] <= vals[0] : vals[sel] >= vals[0];
  const col = better ? "#9fd6b8" : "#ffb3b3";
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="30" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6"
      stroke-linejoin="round" stroke-linecap="round" opacity=".7"></polyline>
    <circle cx="${px(sel).toFixed(1)}" cy="${py(sel).toFixed(1)}" r="2.9" fill="${col}"></circle>
  </svg>`;
}

/* delta vs the previous week — coloured by good/bad, not by direction */
function delta(cur, prev, lowerIsBetter, fmt) {
  if (prev == null) return { txt: "baseline week", cls: "flat" };
  const d = cur - prev;
  if (d === 0) return { txt: "level WoW", cls: "flat" };
  const good = lowerIsBetter ? d < 0 : d > 0;
  const sign = d > 0 ? "+" : "−";
  return { txt: sign + fmt(Math.abs(d)) + " WoW", cls: good ? "up" : "down" };
}

function kpiTile(label, val, series, sel, lowerIsBetter, dl) {
  return `<div class="kpi">
    <div class="klabel">${label}</div>
    <div class="kval">${val}<span class="kdelta ${dl.cls}">${dl.txt}</span></div>
    ${spark(series, sel, lowerIsBetter)}
  </div>`;
}

function renderKpis(cfg, weeks, i) {
  const w = weeks[i], p = i > 0 ? weeks[i - 1] : null;
  const n = x => String(x);
  $("#growKpis").innerHTML = [
    kpiTile(`${esc(cfg.enquiry)} in`, w.enq, weeks.map(x => x.enq), i, false,
      delta(w.enq, p && p.enq, false, n)),
    kpiTile("Median first response", w.resp + "s", weeks.map(x => x.resp), i, true,
      delta(w.resp, p && p.resp, true, v => v + "s")),
    kpiTile("Booked &amp; value", `${w.booked} · ${fmtGBPk(w.value)}`, weeks.map(x => x.value), i, false,
      delta(w.value, p && p.value, false, fmtGBPk)),
    kpiTile("Cost per " + esc(singular(cfg.enquiry)), fmtGBP(w.cpl), weeks.map(x => x.cpl), i, true,
      delta(w.cpl, p && p.cpl, true, fmtGBP))
  ].join("");
}

/* ---------- week note ----------------------------------------------------- */
/* "held at 4" vs "slipped 4 → 3" — phrased from the data, never assumed */
function bookedPhrase(w, p) {
  if (!p || w.booked === p.booked) return `held at ${w.booked}`;
  return w.booked < p.booked ? `slipped ${p.booked} → ${w.booked}` : `rose ${p.booked} → ${w.booked}`;
}

function renderNote(cfg, weeks, i) {
  const w = weeks[i], p = i > 0 ? weeks[i - 1] : null;
  /* every narrative below is built, but only notes[i] is shown — pv keeps the
     unshown week-2/3/4 strings from dereferencing a null previous week on week 1 */
  const pv = p || w;
  const val = `<b>${fmtGBP(w.value)}</b>`;
  const notes = [
    `<b>First full week live.</b> Baseline set: every one of the ${w.enq} ${esc(cfg.enquiry)} answered,
     ${w.booked} converted to a ${esc(cfg.deal)} — ${val} of work in the diary. We deliberately changed
     nothing else this week; you can't read a change you made on top of five others.`,
    `<b>Response time cut by a third.</b> The instant-reply order went live on Tuesday and median first
     response dropped ${pv.resp}s → ${w.resp}s. ${w.booked} booked, ${val} in the diary, and cost per
     ${esc(singular(cfg.enquiry))} eased to ${fmtGBP(w.cpl)}.`,
    `<b>A week that went backwards — and you heard it from us on Tuesday.</b> Cost per
     ${esc(singular(cfg.enquiry))} rose ${fmtGBP(pv.cpl)} → <b>${fmtGBP(w.cpl)}</b>: an auction spike over a
     short week, plus one source over-delivering low-intent traffic. Bookings ${bookedPhrase(w, p)}
     (${val}). We had the keyword-group pause drafted and in front of you the same day, tightened the
     score threshold, and told you before you had to ask. This is what a bad week looks like when
     someone is watching it.`,
    `<b>Best week so far.</b> The spend rebalance landed: cost per ${esc(singular(cfg.enquiry))}
     ${fmtGBP(pv.cpl)} → <b>${fmtGBP(w.cpl)}</b>, ${w.enq} ${esc(cfg.enquiry)} in and ${w.booked} booked —
     ${val}. Median first response now ${w.resp}s, day or night.`
  ];
  $("#weekNote").innerHTML =
    `<p style="font-size:14.5px;color:var(--muted);line-height:1.65">${notes[i]}</p>
     <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
       <span class="chip blue">${w.label} · ${esc(cfg.label)} example</span>
       <span class="chip violet">${w.wait} ${w.wait === 1 ? "message" : "messages"} waiting on you</span>
       <span class="modeltag">Example data — not a promise</span>
     </div>`;
}

/* ---------- AI recommendations -------------------------------------------- */
const approved = new Set();

function recsFor(cfg, weeks, i) {
  const w = weeks[i], p = i > 0 ? weeks[i - 1] : null;
  const ch = cfg.channels, one = singular(cfg.enquiry), b = cfg.build;
  const sets = [
    [
      { st: "pending", conf: 74, title: `Extend ${b.nurture.toLowerCase()} from 5 touches to 6`,
        body: `Most ${esc(cfg.noun)} who book after a follow-up do it on touch 4 or later. One more touch,
               same tone, same easy opt-out.`,
        impact: `+2–4 extra ${esc(cfg.deal)}s a month (modelled range, conservative end)` },
      { st: "running", conf: 86, title: "Send the instant reply by SMS first, email second",
        body: `SMS gets read within minutes at any hour; email waits for morning. Identical message,
               better order. Live since Tuesday.`,
        impact: `Median first response ${w.resp}s and falling` },
      { st: "done", conf: 91, title: `Fast-lane urgent ${esc(cfg.enquiry)} on keyword match`,
        body: `"emergency", "today" and "urgent" now skip straight past scoring and alert you directly,
               instead of waiting their turn.`,
        impact: "Shipped Thursday — 3 alerts fired, all answered" }
    ],
    [
      { st: "pending", conf: 81, title: `Lean into ${esc(ch[0])}, throttle the weakest source`,
        body: `${esc(ch[0])} is producing your highest-scoring ${esc(cfg.enquiry)} at the lowest cost.
               We throttle the weakest source rather than kill it, and keep a small control so we can
               prove the difference.`,
        impact: `−8–12% cost per ${esc(one)} (modelled range)` },
      { st: "running", conf: 78, title: "Two-stage booking confirmation",
        body: `Confirmation at the time of booking, then a reminder 2 hours before. Aimed at no-shows,
               which cost you more than the ad spend does.`,
        impact: "Testing on this week's bookings" },
      { st: "done", conf: 88, title: "Weekend and evening cover on the hot lane",
        body: `Hot ${esc(cfg.enquiry)} arriving out of hours now get the full instant reply and hold a
               provisional slot, instead of queuing until Monday.`,
        impact: "Shipped last Friday — 4 out-of-hours replies sent" }
    ],
    [
      { st: "pending", conf: 88, title: "Pause the keyword group behind the cost spike",
        body: `One group drove 31% of spend and none of the bookings this week. Pause it, hold the budget,
               and review in 14 days rather than deleting the history.`,
        impact: `Cost per ${esc(one)} back toward ${fmtGBP(p ? p.cpl : w.cpl)} (modelled)` },
      { st: "running", conf: 72, title: "Raise the hot-lane score threshold 70 → 74",
        body: `Low-intent traffic is reaching your phone. A slightly stricter threshold means fewer alerts
               and better ones — you can put it back in one tap if it feels wrong.`,
        impact: "Fewer, better alerts — measured over 10 days" },
      { st: "done", conf: 84, title: "Short-week message variant",
        body: `Follow-ups sent over the short week now reference the closure dates instead of promising
               a call-back that couldn't happen.`,
        impact: "Shipped Wednesday — no missed call-backs" }
    ],
    [
      { st: "pending", conf: 69, title: `Reactivation wave to the dormant list`,
        body: `Everyone who enquired, never booked and has gone quiet for 90+ days gets one respectful,
               genuinely useful message. Low expectations, high margin — these ${esc(cfg.noun)} cost
               nothing to reach.`,
        impact: `+1–3 ${esc(cfg.deal)}s from existing data (modelled, conservative)` },
      { st: "running", conf: 76, title: `Ask for the review 7 days after the ${esc(cfg.deal)}`,
        body: `Timed for the moment people are happiest, drafted for them to edit. Reviews feed
               ${esc(ch[0])} performance, so this compounds.`,
        impact: "Running on this week's completions" },
      { st: "done", conf: 90, title: "Spend rebalance shipped Monday",
        body: `The pause and reallocation you approved last week went live Monday morning. Cost per
               ${esc(one)} is down and volume is up — both, which is rarer than it sounds.`,
        impact: `Cost per ${esc(one)} ${fmtGBP(w.cpl)}, ${w.enq} in` }
    ]
  ];
  return sets[i];
}

const REC_STATUS = {
  pending: ["violet", "Awaiting your approval"],
  running: ["blue", "Running now"],
  done: ["hi", "Done last week"]
};

function renderRecs(cfg, weeks, i) {
  const recs = recsFor(cfg, weeks, i);
  $("#recs").innerHTML = recs.map((r, k) => {
    const isApproved = approved.has(i + ":" + k);
    const st = isApproved ? ["hi", "Approved — we build it this week"] : REC_STATUS[r.st];
    const btn = r.st !== "pending" ? "" : isApproved
      ? `<button class="approve donebtn" disabled>Approved ✓</button>`
      : `<button class="approve" data-k="${k}">Approve</button>`;
    return `<div class="rec">
      <div class="rhead"><h4>${r.title}</h4><span class="chip ${st[0]}">${st[1]}</span></div>
      <p>${r.body}</p>
      <p><b style="color:#9fd6b8">Expected impact</b> — ${r.impact}</p>
      <div class="rfoot">
        <span class="chip blue">Confidence ${r.conf}%</span>
        <span class="modeltag">Modelled projection</span>
        ${btn}
      </div>
    </div>`;
  }).join("");

  $$("#recs .approve:not(.donebtn)").forEach(btn => {
    btn.addEventListener("click", () => {
      approved.add(i + ":" + btn.dataset.k);
      renderRecs(cfg, weeks, i);
      renderQa(cfg, weeks, i);
      toast("Approved — it goes on this week's build list. That's your whole job.");
    });
  });
}

/* ---------- the four standing questions ---------------------------------- */
function renderQa(cfg, weeks, i) {
  const w = weeks[i], p = i > 0 ? weeks[i - 1] : null;
  const pv = p || w;   /* same reason as renderNote — all four answers are built, one is shown */
  const ch = cfg.channels, one = singular(cfg.enquiry);
  const pending = recsFor(cfg, weeks, i).find(r => r.st === "pending");
  const isApproved = approved.has(i + ":" + recsFor(cfg, weeks, i).findIndex(r => r.st === "pending"));

  const goals = [
    `Speed first, volume second. ${w.enq} ${esc(cfg.enquiry)} in, all answered inside ${w.resp}s median,
     ${w.booked} booked (${fmtGBP(w.value)}). We're not touching volume until response time is boring.`,
    `Still speed — and it worked: ${pv.resp}s → ${w.resp}s. Bookings ${bookedPhrase(w, p)}
     (${fmtGBP(w.value)}). Volume is the next lever, one at a time so we can attribute it.`,
    `Yes, and this week tested it: cost drifted up and bookings ${bookedPhrase(w, p)}. The goal was never
     "more leads" — it was more ${esc(cfg.deal)}s per pound. Defending that is the same job as growing it.`,
    `Now, yes. Speed is solved (${w.resp}s), cost is down (${fmtGBP(w.cpl)} per ${esc(one)}) and volume is
     rising (${w.enq} in). The next goal is capacity — making sure you can serve ${w.booked}+ a week.`
  ];
  const best = [
    `${esc(ch[0])} — most of this week's high scores. ${esc(ch[1])} is steady but slower to reply to.
     ${esc(ch[2])} is small and converts best, so we're leaving it alone rather than "optimising" it.`,
    `${esc(ch[0])} again, and the instant reply itself: answers now arrive in ${w.resp}s instead of hours,
     and booked value moved ${fmtGBP(pv.value)} → ${fmtGBP(w.value)}.`,
    `${esc(ch[2])} — quietly the best week of the three sources while the paid ones misbehaved. Your
     approval gate also performed: two drafts you edited landed better than the originals.`,
    `${esc(ch[0])} after the rebalance — ${fmtGBP(w.cpl)} per ${esc(one)}, the lowest yet. The later
     follow-up touches are now the single biggest source of late bookings.`
  ];
  const blocks = [
    `Two things. ${w.wait} drafts are waiting on you (about 10 seconds each), and roughly a third of
     ${esc(cfg.enquiry)} still arrive with no phone number — we're fixing that at the form, not by nagging you.`,
    `No-shows. You're booking well; about one in six doesn't turn up. That's the two-stage confirmation
     currently running.`,
    `Cost, not capacity: ${fmtGBP(w.cpl)} per ${esc(one)} against ${fmtGBP(pv.cpl)} last week, driven by one
     keyword group. ${w.wait} approvals also sat over the short week — the queue waits for you, nothing expires.`,
    `You. Genuinely: ${w.booked} booked this week and the diary is the constraint now, not the enquiries.
     Next Monday we'll bring options for that.`
  ];
  const next = isApproved
    ? `Already moving: you approved <b>${pending.title.toLowerCase()}</b> — it's on this week's build list,
       and next Monday's report will show whether it worked.`
    : `<b>${pending.title}</b> — ${pending.impact}. It's drafted and waiting for your one tap above;
       we don't ship anything in your name without it.`;

  const cards = [
    ["Are we prioritising the right goals?", goals[i]],
    ["What's performing best this week?", best[i]],
    ["Where are the biggest bottlenecks?", blocks[i]],
    ["What should we optimise next?", next]
  ];
  $("#qaGrid").innerHTML = cards.map(c => `
    <div class="qacard">
      <div class="qq">${c[0]}</div>
      <div class="ans">${c[1]}</div>
    </div>`).join("");
}

/* ---------- rhythm + chat + "what you're buying" -------------------------- */
function renderRhythm(cfg) {
  const rows = [
    ["Mon", "Your report, 08:00", `What came in, what got booked, what we changed, what we're doing next —
      plain English, with the four questions already answered.`],
    ["Tue", "We build what you approved", `Your taps from Monday become live changes the same day.
      Nothing sits in a backlog waiting for a sprint.`],
    ["Wed", "Mid-week watch", `Automated checks on cost, response time and volume. If something drifts,
      you hear it from us before you notice it.`],
    ["Thu", "Tune and test", `One change at a time so the result is attributable. Boring on purpose.`],
    ["Fri", "Optional 15-minute call", `Useful when something big is moving, skippable when it isn't.
      Nothing depends on you being on a call.`]
  ];
  $("#rhythm").innerHTML = rows.map(r => `
    <div class="rt"><div class="day">${r[0]}</div><h5>${r[1]}</h5><p>${r[2]}</p></div>`).join("");
}

function renderChat(cfg) {
  const svc = cfg.services[1] || cfg.services[0];
  const msgs = [
    ["them", "TMA · 02:14", `Heads up — three ${esc(cfg.enquiry)} came in overnight. All three answered:
      38s, 41s and 52s. Nothing waiting.`],
    ["us", "You · 02:14", "Still up. Anything worth me looking at?"],
    ["them", "TMA · 02:15", `One is scored 91 — logged as "${esc(svc)}", and they want it this week.
      Tuesday 14:30 is held provisionally and there's a draft reply ready for you.`],
    ["us", "You · 02:16", "Approved. Send it."],
    ["them", "TMA · 02:16", `Sent, and the slot is confirmed. Go to sleep — it'll all be in Monday's
      report either way.`]
  ];
  $("#chatBox").innerHTML = msgs.map(m => `
    <div class="msg ${m[0]}"><span class="mt">${m[1]}</span>${m[2]}</div>`).join("");
}

function renderBuying() {
  const steps = [
    ["Someone watching daily", "Not a dashboard you have to remember to open. We look, every working day, and we come to you."],
    ["Decisions, not data", "Every recommendation arrives with a confidence rating, an expected impact and a modelled range — so you can say no cheaply."],
    ["One-tap control", "Nothing goes out in your name without your approval. That's a design choice, not a limitation — your judgement is the part that can't be automated."],
    ["Cover at 2am", "The system answers instantly around the clock, and a human picks up anything it shouldn't decide alone."]
  ];
  $("#buyingSteps").innerHTML = steps.map((s, i) => `
    <div class="step-row">
      <span class="snum">${i + 1}</span>
      <div><h4>${s[0]}</h4><p>${s[1]}</p></div>
    </div>`).join("");
}

/* ---------- init ---------------------------------------------------------- */
let selWeek = 3;

function renderWeek() {
  const cfg = PRESETS[getProfile().industry];
  const weeks = weekData(cfg);
  renderKpis(cfg, weeks, selWeek);
  renderNote(cfg, weeks, selWeek);
  renderRecs(cfg, weeks, selWeek);
  renderQa(cfg, weeks, selWeek);
}

function renderWeekSel() {
  const sel = $("#weekSel");
  sel.innerHTML = "";
  WEEK_SHAPE.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s.label;
    if (i === selWeek) b.classList.add("on");
    b.addEventListener("click", () => {
      selWeek = i;
      $$("button", sel).forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      renderWeek();
    });
    sel.appendChild(b);
  });
}

function setTitle() { $("#growTitle").textContent = companyName() + " — weekly growth"; }

function renderAll() {
  const cfg = PRESETS[getProfile().industry];
  setTitle();
  renderWeek();
  renderRhythm(cfg);
  renderChat(cfg);
}

document.addEventListener("DOMContentLoaded", () => {
  renderPicker($("#industryPick"), renderAll);
  wireNameInput($("#bizname"), setTitle);
  renderWeekSel();
  renderBuying();
  renderAll();
});
