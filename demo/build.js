/* =========================================================================
   DEMO 02 · BUILD — workflow canvas, test-run simulation, dashboard, code.
   Everything here is an example build with example data — the real system is
   mapped onto the prospect's channels, tools and rules on the diagnosis call.
   ========================================================================= */

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_W = 170, NODE_H = 64;

/* ---------- which of our builds delivers which part of the pipeline -------
   These are the real entry builds from the pricing page, not invented modules.
   Every node names the system that does it and the question we'd ask on the
   diagnosis call to find out whether this business actually needs that part —
   the whole point being that most people need three or four of these, not
   fifteen, and the call is how we find out which.

   The catalogue itself lives in shared.js, so the canvas and the full demo
   can never drift apart on what a build is called or how long it takes. */
const SYSTEMS = BUILDS;

/* ---------- nodes --------------------------------------------------------- */
function nodeDefs(cfg) {
  const b = cfg.build;
  return [
    { id: 1,  x: 30,  y: 60,  ic: "⚡", name: b.trigger,              sub: b.triggerSub, sys: "RESCUE",
      dx: "How many of your enquiries arrive as a missed call or a DM, and what happens to those today?" },
    { id: 2,  x: 240, y: 60,  ic: "🧹", name: "Capture & clean",       sub: "Dedupe · validate · normalise", sys: "SPEED",
      dx: "How many separate places do you have to check to be sure you've seen every enquiry?" },
    { id: 3,  x: 450, y: 60,  ic: "🔎", name: "Enrich contact",        sub: "Phone · company · source", sys: "SIGNAL",
      dx: "When a name lands, how much do you know about them before you pick up the phone?" },
    { id: 4,  x: 660, y: 60,  ic: "🤖", name: "AI qualify & score",    sub: "Intent · urgency · fit → 0–100", sys: "TRIAGE",
      dx: "Who decides which enquiry gets called first, and on what basis?" },
    { id: 5,  x: 880, y: 60,  ic: "🔀", name: "Route by score",        sub: "Hot ≥70 · Warm 40–69 · Cold <40", sys: "MACHINE",
      dx: "Roughly what share of your enquiries are worth a call?" },
    { id: 6,  x: 240, y: 210, ic: "✉️", name: "Instant reply <60s",    sub: "SMS + email · your voice", sys: "SPEED",
      dx: "Time your last ten enquiries from arrival to first human reply. What's the median?" },
    { id: 7,  x: 450, y: 210, ic: "📅", name: b.book,                  sub: b.bookSub, sys: "SPEED",
      dx: "How many booked calls reach your diary without someone retyping them?" },
    { id: 8,  x: 660, y: 210, ic: "🔔", name: "Hot-lead alert to you", sub: "Straight to your phone", sys: "RESCUE",
      dx: "If your best-fit lead all year came in at 7pm on a Friday, when would you find out?" },
    { id: 9,  x: 240, y: 330, ic: "💬", name: b.nurture,               sub: b.nurtureSub, sys: "MACHINE",
      dx: "How many times does someone chase a quiet enquiry before they give up?" },
    { id: 10, x: 450, y: 330, ic: "👤", name: "Your approval gate",    sub: "One tap · approve / edit / skip", human: true, sys: "TRIAGE",
      dx: "Which messages would you insist on seeing before they go out in your name?" },
    { id: 11, x: 660, y: 330, ic: "📤", name: "Send + schedule",       sub: "Best send-time · stops on reply", sys: "MACHINE",
      dx: "Today, what stops a follow-up sequence when someone replies?" },
    { id: 12, x: 240, y: 450, ic: "🗂️", name: "Long-term list",        sub: "Quarterly value emails", sys: "MACHINE",
      dx: "How many enquiries from last year are sitting in a spreadsheet doing nothing?" },
    { id: 13, x: 450, y: 450, ic: "♻️", name: "Reactivation campaign", sub: "Dormant leads · 90-day cycle", sys: "SIGNAL",
      dx: "When did you last go back to someone who enquired six months ago?" },
    { id: 14, x: 880, y: 270, ic: "🗄️", name: b.crm,                   sub: "Every touch logged automatically", sys: "CRM",
      dx: "How much of the week goes on retyping the same details into a second system?" },
    { id: 15, x: 880, y: 410, ic: "📊", name: "Weekly report to you",  sub: "Monday 08:00 · plain English", sys: "DASH",
      dx: "Which number do you check on a Monday morning, and where do you get it from?" }
  ];
}

/* edge key, path kind (h horizontal / dl down-left / v vertical), lane badge */
const EDGES = [
  ["1-2", "h"], ["2-3", "h"], ["3-4", "h"], ["4-5", "h"],
  ["5-6", "dl", "HOT", "#ffd9a0"], ["5-9", "dl", "WARM", "#a9d3ff"], ["5-12", "dl", "COLD", "#b7c0cc"],
  ["6-7", "h"], ["7-8", "h"], ["8-14", "h"],
  ["9-10", "h"], ["10-11", "h"], ["11-14", "h"],
  ["12-13", "h"], ["13-14", "h"], ["14-15", "v"]
];

function edgePath(kind, f, t) {
  if (kind === "h") {
    const fx = f.x + NODE_W, fy = f.y + NODE_H / 2, tx = t.x, ty = t.y + NODE_H / 2;
    const dx = Math.min(80, Math.max(24, (tx - fx) / 2));
    return `M ${fx} ${fy} C ${fx + dx} ${fy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
  }
  if (kind === "dl") {
    const fx = f.x + NODE_W / 2, fy = f.y + NODE_H, tx = t.x, ty = t.y + NODE_H / 2;
    return `M ${fx} ${fy} C ${fx} ${fy + 70}, ${tx - 90} ${ty}, ${tx} ${ty}`;
  }
  const fx = f.x + NODE_W / 2, fy = f.y + NODE_H, tx = t.x + NODE_W / 2, ty = t.y;
  return `M ${fx} ${fy} C ${fx} ${fy + 30}, ${tx} ${ty - 30}, ${tx} ${ty}`;
}

/* ---------- svg helpers --------------------------------------------------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svgText(x, y, cls, str) {
  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", x); t.setAttribute("y", y);
  t.setAttribute("class", cls);
  t.textContent = str;
  return t;
}

/* split a "a · b · c" sub-label onto ≤2 lines that fit the node width */
function subLines(sub) {
  if (sub.length <= 26) return [sub];
  const parts = sub.split(" · ");
  if (parts.length === 1) return [sub];
  let l1 = parts[0], i = 1;
  while (i < parts.length && (l1 + " · " + parts[i]).length <= 26) { l1 += " · " + parts[i]; i++; }
  const l2 = parts.slice(i).join(" · ");
  return l2 ? [l1, l2] : [l1];
}

/* ---------- canvas -------------------------------------------------------- */
let nodeEls = {}, edgeEls = {}, flowEls = [];

function renderCanvas() {
  const cfg = PRESETS[getProfile().industry];
  const svg = $("#wfSvg");
  svg.innerHTML = "";
  nodeEls = {}; edgeEls = {}; flowEls = [];
  const defs = nodeDefs(cfg);
  const byId = {}; defs.forEach(n => { byId[n.id] = n; });

  EDGES.forEach(([key, kind, badge, color]) => {
    const [a, b] = key.split("-").map(Number);
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", edgePath(kind, byId[a], byId[b]));
    p.setAttribute("class", "wf-edge");
    svg.appendChild(p);
    edgeEls[key] = p;
    if (badge) {
      const t = svgText(byId[b].x - 14, byId[b].y + NODE_H / 2 - 8, "wf-badge", badge);
      t.setAttribute("text-anchor", "end");
      t.setAttribute("fill", color);
      svg.appendChild(t);
    }
  });

  defs.forEach(n => {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "wf-node" + (n.human ? " human" : ""));
    g.setAttribute("data-id", n.id);
    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("x", n.x); r.setAttribute("y", n.y);
    r.setAttribute("width", NODE_W); r.setAttribute("height", NODE_H);
    r.setAttribute("rx", 13);
    g.appendChild(r);
    g.appendChild(svgText(n.x + 14, n.y + 25, "nname", n.name));
    subLines(n.sub).forEach((ln, i) => g.appendChild(svgText(n.x + 14, n.y + 41 + i * 13, "nsub", ln)));
    const ic = svgText(n.x + NODE_W - 12, n.y + 44, "nicon", n.ic);
    ic.setAttribute("text-anchor", "end");
    g.appendChild(ic);
    /* which of our builds delivers this step — shown only in systems view */
    const tag = svgText(n.x + 14, n.y - 7, "nsys", n.sys);
    /* inline style, not a fill attribute — `.wf-node text{fill:#fff}` is a CSS
       rule and beats a presentation attribute, which painted every tag white */
    tag.style.fill = SYSTEMS[n.sys].col;
    g.appendChild(tag);
    g.addEventListener("click", () => openDrawer(n));
    svg.appendChild(g);
    nodeEls[n.id] = g;
  });
}

/* ---------- node config drawer -------------------------------------------- */
function drawerRows(n, cfg) {
  const b = cfg.build;
  switch (n.id) {
    case 1:  return [["Sources", b.triggerSub], ["Capture window", "24/7, nothing missed"], ["Missed-call catch", "Auto-SMS within 30s"], ["Field mapping", "Name · phone · message"]];
    case 2:  return [["Dedupe key", "Phone + email"], ["Validation", "Phone format · spam filter"], ["Normalise", "Names, numbers, casing"]];
    case 3:  return [["Lookups", "Phone type · area · source"], ["On failure", "Continues without blocking"], ["Data", "Held in your own accounts"]];
    case 4:  return [["Model", "AI scorer tuned to " + cfg.plural], ["Signals", "Intent · urgency · fit"], ["Output", "Score 0–100 + plain-English reason"], ["Latency", "Under 2 seconds"]];
    case 5:  return [["Hot lane", "Score ≥ 70 → instant reply"], ["Warm lane", "40–69 → approved nurture"], ["Cold lane", "Below 40 → long-term list"]];
    case 6:  return [["Channels", "SMS + email"], ["Voice", "Trained on your tone; you approve it once"], ["Speed", "Under 60 seconds, 24/7"], ["Contains", "Answer + booking link"]];
    case 7:  return [["Calendar", b.bookSub], ["Slots", "Live availability only"], ["Reminders", "24h + 2h before"]];
    case 8:  return [["Channel", "WhatsApp / SMS"], ["Contains", "Name, score, why it's hot"], ["When", "Within seconds, any hour"]];
    case 9:  return [["Sequence", b.nurtureSub], ["Timing", "Day 0 · 2 · 5 · 9 · 14"], ["Stops", "Instantly on any reply"]];
    case 10: return [["You see", "Drafted message + full context"], ["Choices", "Approve · edit · skip"], ["Time cost", "About 10 seconds per message"], ["Where", "Your phone or inbox"]];
    case 11: return [["Send time", "Optimised per recipient"], ["Auto-stop", "On reply or booking"], ["Record", "Every send logged"]];
    case 12: return [["Cadence", "One useful email a quarter"], ["Tone", "Value, never pressure"], ["Exit", "Any reply → warm lane"]];
    case 13: return [["Trigger", "90 days dormant"], ["Typical result", "2–5% re-engage (modelled)"], ["Tone", "Respectful, easy opt-out"]];
    case 14: return [["Writes", "Contact · activity · outcome"], ["Dedupe", "Updates, never duplicates"], ["Retyping for you", "None, ever"]];
    case 15: return [["When", "Monday 08:00"], ["Format", "Plain English + the numbers"], ["Includes", "Wins · issues · next steps"]];
  }
  return [];
}

function openDrawer(n) {
  const cfg = PRESETS[getProfile().industry];
  const sys = SYSTEMS[n.sys];
  const rows = drawerRows(n, cfg)
    .map(r => `<div class="cfg-row"><span class="k">${esc(r[0])}</span><span class="v">${esc(r[1])}</span></div>`)
    .join("");
  $("#nodeDrawer").innerHTML = `
    <div class="dhead${n.human ? " human" : ""}"><span class="dic">${n.ic}</span>
      <div><h4>${esc(n.name)}</h4><p class="dim" style="font-size:13px">${esc(n.sub)}</p></div>
    </div>
    ${rows}
    <div class="cfg-row"><span class="k">Owner</span><span class="v">${n.human ? "You · one click" : "TMA builds & runs it"}</span></div>
    <div class="sysbox">
      <div class="syshead">
        <span class="sysdot" style="background:${sys.col}"></span>
        <div>
          <div class="sysname">${esc(sys.name)}</div>
          <div class="sysmeta">${sys.tier === "core" ? "part of the full build" : "a standalone entry build"} · ${sys.days}</div>
        </div>
      </div>
      <div class="sysdx"><span class="dxlab">On the call we'd ask</span>${esc(n.dx)}</div>
    </div>`;
}

/* ---------- sample dashboard ---------------------------------------------- */
const kpiTile = (label, val, cls, delta) => `
  <div class="kpi"><div class="klabel">${label}</div>
    <div class="kval">${val}<span class="kdelta ${cls}">${delta}</span></div></div>`;

function renderDash() {
  const cfg = PRESETS[getProfile().industry];
  const wk = Math.max(3, Math.round(cfg.monthlyLeads / 4));
  const booked = Math.max(1, Math.round(wk * cfg.closeRate / 100 * 1.2));

  /* deltas derive from the figures above, so a small preset never claims an
     impossible week (e.g. "1 booked, +2 WoW" implies last week was −1) */
  const dEnq = Math.max(1, Math.min(3, Math.round(wk * 0.2)));
  const dBk  = Math.min(2, Math.round(booked * 0.25));

  $("#dashKpis").innerHTML = [
    kpiTile("Enquiries this week", wk, "up", `+${dEnq} WoW`),
    kpiTile("Median first response", "38s", "up", "was 4.2h pre-build"),
    kpiTile("Booked this week", booked, dBk ? "up" : "flat", dBk ? `+${dBk} WoW` : "level WoW"),
    kpiTile("Waiting on you", 1, "flat", "one approval · ~10s")
  ].join("");

  const rows = [
    { i: 0, score: 87, pill: ["hot", "Hot · replied 41s"],  next: "Slot held Tue 14:30" },
    { i: 1, score: 91, pill: ["booked", "Booked"],          next: "Reminder 24h before" },
    { i: 2, score: 54, pill: ["review", "Your approval"],   next: "You: one tap (~10s)" },
    { i: 3, score: 58, pill: ["nurture", "Nurture 2/5"],    next: "Follow-up tomorrow 09:30" },
    { i: 4, score: 21, pill: ["nurture", "Long-term"],      next: "Reactivation in 14 days" }
  ];
  $("#dashTable").innerHTML =
    `<thead><tr><th>Lead</th><th>Enquiry</th><th>AI score</th><th>Status</th><th>Next action</th></tr></thead><tbody>` +
    rows.map(r => `<tr>
      <td>${esc(cfg.leadNames[r.i])}</td><td>${esc(cfg.services[r.i])}</td><td>${r.score}</td>
      <td><span class="pill ${r.pill[0]}">${r.pill[1]}</span></td><td>${r.next}</td></tr>`).join("") +
    `</tbody>`;
}

/* ---------- code excerpt + how it works ------------------------------------ */
function renderCode() {
  $("#codePre").innerHTML =
`<span class="c-cm"># lead_scorer.py: how every enquiry is scored in &lt;2s (excerpt)</span>
<span class="c-kw">from</span> engine <span class="c-kw">import</span> ai, rules, alerts

WEIGHTS = {<span class="c-str">"intent"</span>: <span class="c-num">0.45</span>, <span class="c-str">"urgency"</span>: <span class="c-num">0.30</span>, <span class="c-str">"fit"</span>: <span class="c-num">0.25</span>}
HOT, WARM = <span class="c-num">70</span>, <span class="c-num">40</span>

<span class="c-kw">def</span> <span class="c-fn">score_lead</span>(enquiry):
    <span class="c-str">"""Blend AI signals with your business rules, then route."""</span>
    sig = ai.<span class="c-fn">extract_signals</span>(enquiry.message)  <span class="c-cm"># intent, urgency</span>
    fit = rules.<span class="c-fn">fit_score</span>(enquiry)            <span class="c-cm"># service, area, value</span>

    score = <span class="c-fn">round</span>(<span class="c-num">100</span> * (WEIGHTS[<span class="c-str">"intent"</span>]  * sig.intent
                      + WEIGHTS[<span class="c-str">"urgency"</span>] * sig.urgency
                      + WEIGHTS[<span class="c-str">"fit"</span>]     * fit))

    lane = <span class="c-str">"hot"</span> <span class="c-kw">if</span> score >= HOT <span class="c-kw">else</span> <span class="c-str">"warm"</span> <span class="c-kw">if</span> score >= WARM <span class="c-kw">else</span> <span class="c-str">"cold"</span>
    <span class="c-kw">if</span> lane == <span class="c-str">"hot"</span>:
        alerts.<span class="c-fn">notify_owner</span>(enquiry, score)     <span class="c-cm"># your phone, in seconds</span>
    <span class="c-kw">return</span> score, lane`;
}

function renderHow() {
  const steps = [
    ["An enquiry arrives", "Webform, ad, DM or missed call. The system catches every channel, 24/7, so nothing depends on who's at the desk."],
    ["Cleaned, enriched, scored", "Within seconds the system dedupes it, enriches it and scores it 0–100 using AI tuned to your business, with the reason written in plain English."],
    ["Hot leads: instant reply + your phone buzzes", "A personal reply in under 60 seconds with a live booking link. You get an alert too, so you can call while they're still looking."],
    ["Warm leads: follow-up you approve", "A polite sequence drafted in your voice. Every message waits at the purple gate for your one-tap approve, edit or skip."],
    ["Everything logs itself", "Every touch lands in the CRM automatically. No retyping, and no \"who was that again?\""],
    ["Your Monday 08:00 report", "A plain-English summary of what happened and what we're tuning next. We run the machine; you steer it."]
  ];
  $("#howSteps").innerHTML = steps.map((s, i) => `
    <div class="step-row">
      <span class="snum">${i + 1}</span>
      <div><h4>${s[0]}</h4><p>${s[1]}</p></div>
    </div>`).join("");
}

/* ---------- init ----------------------------------------------------------- */
/* ---------- systems view --------------------------------------------------
   The canvas answers "what would you build me?". This answers the follow-up:
   "which of those is a thing I can buy on its own, and how would you know I
   need it?" Each node carries the build that delivers it. */
function renderSysLegend() {
  const box = $("#sysLegend");
  if (!box) return;                      /* guard: markup is optional */
  const used = {};
  nodeDefs(PRESETS[getProfile().industry]).forEach(n => {
    used[n.sys] = (used[n.sys] || 0) + 1;
  });
  box.innerHTML = Object.keys(SYSTEMS)
    .filter(k => used[k])
    .map(k => {
      const s = SYSTEMS[k];
      return `<div class="sysitem">
        <span class="sysdot" style="background:${s.col}"></span>
        <span class="sysk" style="color:${s.col}">${k}</span>
        <span class="sysn">${esc(s.name)}</span>
        <span class="sysd">${used[k]} step${used[k] > 1 ? "s" : ""} · ${s.days}</span>
      </div>`;
    }).join("");
}

function toggleSystems() {
  const btn = $("#sysBtn"), leg = $("#sysLegend");
  if (!btn || !leg) return;
  const on = $("#wfSvg").classList.toggle("show-sys");
  leg.classList.toggle("hide", !on);
  btn.classList.toggle("on", on);
  btn.textContent = on ? "◧ Hide the systems" : "◧ Which system does what?";
}

function renderAll() {
  $("#wfTitle").textContent = companyName() + ": lead engine";
  renderCanvas();
  renderSysLegend();
  renderDash();
  renderCode();
  renderHow();
  $("#nodeDrawer").innerHTML = `
    <div class="dhead"><span class="dic">⚙</span>
      <div><h4>Select a node on the canvas</h4><p class="dim" style="font-size:13px">Every node opens like this in the real build: settings, mappings, owner.</p></div>
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  renderPicker($("#industryPick"), renderAll);
  wireNameInput($("#bizname"), () => { $("#wfTitle").textContent = companyName() + ": lead engine"; });
  renderAll();
  const sb = $("#sysBtn");
  if (sb) sb.addEventListener("click", toggleSystems);
});
