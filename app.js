/* =========================================================================
   THE MACHINE — landing page behaviour. Vanilla, no dependencies.
   ========================================================================= */

/* ── ⚠️ CONFIG — REPLACE THESE TWO BEFORE GOING LIVE ──────────────────── */
const BOOKING_URL   = 'https://cal.com/adam-attia-b3ay43/discovery-call';
const CONTACT_EMAIL = 'adamattia@themissionautomation.com';
/* ─────────────────────────────────────────────────────────────────────── */

/* This file runs on the homepage and on /contact/, which has no year stamp.
   An unguarded lookup here threw and silently killed every CTA below it. */
const yr = document.getElementById('yr');
if (yr) yr.textContent = new Date().getFullYear();

/* ---- CTA wiring -------------------------------------------------------
   Both conventions: the landing page uses .js-book, the demo pages use
   [data-book]. Supporting one and not the other leaves dead buttons on
   whichever page happens to use the other. */
document.querySelectorAll('.js-book, [data-book]').forEach(a => {
  if (BOOKING_URL) { a.href = BOOKING_URL; a.target = '_blank'; a.rel = 'noopener'; }
});
document.querySelectorAll('.js-mail').forEach(a => {
  a.href = 'mailto:' + CONTACT_EMAIL + '?subject=' +
    encodeURIComponent('THE MACHINE: diagnosis call');
});

/* ---- contents rail ----------------------------------------------------
   Marks the section you are in and fills the progress line. Driven by scroll
   position rather than IntersectionObserver: the sections are wildly different
   heights, so "which one is crossing the upper third" tracks a reader's sense
   of place better than "which one is most visible". */
(() => {
  const toc = document.getElementById('toc');
  if (!toc) return;
  const fill = document.getElementById('tocFill');
  const links = [...toc.querySelectorAll('a[data-t]')];
  const targets = links
    .map(a => ({ a, el: document.getElementById(a.dataset.t) }))
    .filter(t => t.el);

  /* Pin the line between the first and last dot centres, and remember where
     each dot sits along it. Measured, not assumed: the rail's padding and gap
     can change in CSS without this drifting out of alignment. */
  let dotY = [], span = 0;
  const measure = () => {
    const top = toc.getBoundingClientRect().top;
    dotY = targets.map(t => {
      const d = t.a.querySelector('.tdot').getBoundingClientRect();
      return d.top - top + d.height / 2;
    });
    span = dotY[dotY.length - 1] - dotY[0];
    const line = toc.querySelector('.tocline');
    line.style.top = dotY[0] + 'px';
    line.style.height = span + 'px';
  };

  /* Scroll position at which each section takes over. Interpolating between
     these means the fill reaches a dot at the same moment its section does,
     instead of running on raw page percentage and arriving early or late. */
  const marksFor = () => {
    const m = targets.map(t => t.el.offsetTop - innerHeight * 0.32);
    m[0] = 0;
    for (let i = 1; i < m.length; i++) if (m[i] <= m[i - 1]) m[i] = m[i - 1] + 1;
    return m;
  };

  const onScroll = () => {
    const marks = marksFor();
    let px = 0, current = 0;
    if (scrollY >= marks[marks.length - 1]) { px = span; current = marks.length - 1; }
    else {
      for (let i = 0; i < marks.length - 1; i++) {
        if (scrollY < marks[i + 1]) {
          const f = Math.max(0, (scrollY - marks[i]) / (marks[i + 1] - marks[i]));
          px = (dotY[i] - dotY[0]) + f * (dotY[i + 1] - dotY[i]);
          current = i;
          break;
        }
      }
    }
    fill.style.height = px + 'px';
    targets.forEach((t, i) => {
      t.a.classList.toggle('reached', dotY[i] - dotY[0] <= px + 0.5);
      t.a.classList.toggle('on', i === current);
    });
  };

  const refresh = () => { measure(); onScroll(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', refresh);
  addEventListener('load', refresh);
  refresh();
})();

/* ---- sticky nav ------------------------------------------------------- */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---- reveal on scroll ------------------------------------------------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const els = [...e.target.parentElement.querySelectorAll('.rv')];
    e.target.style.transitionDelay = Math.min(els.indexOf(e.target), 5) * 70 + 'ms';
    e.target.classList.add('in');
    io.unobserve(e.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.rv').forEach(el => io.observe(el));

/* Safety net. The reveal animation is a nicety; visibility is not. If the
   observer never fires (unsupported, embedded, throttled background tab) the
   page would sit permanently at opacity 0 — so force anything at or near the
   fold visible shortly after load, regardless. */
const revealNear = () => document.querySelectorAll('.rv:not(.in)').forEach(el => {
  if (el.getBoundingClientRect().top < innerHeight * 1.15) el.classList.add('in');
});
if (!('IntersectionObserver' in window)) {
  document.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
} else {
  setTimeout(revealNear, 1400);
  addEventListener('load', () => setTimeout(revealNear, 300));
}

/* ---- cursor glow inside cards ---------------------------------------- */
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('pointermove', ev => {
    const r = card.getBoundingClientRect();
    const g = card.querySelector('.glow');
    if (g) { g.style.left = (ev.clientX - r.left) + 'px'; g.style.top = (ev.clientY - r.top) + 'px'; }
  });
});

/* ---- count-up --------------------------------------------------------- */
const countIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, target = +el.dataset.count;
    countIO.unobserve(el);
    if (target === 0) { el.textContent = '0'; return; }
    const t0 = performance.now(), dur = 900;
    const step = t => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach(el => countIO.observe(el));

/* =========================================================================
   STAGE EXPLORER — mirrors the engine's real pipeline order.
   ========================================================================= */
const STAGES = [
  {
    kicker: 'Stage 01 · intake',
    ttl: 'You brief us',
    hint: 'The deep profile',
    body: `On the diagnosis call you tell us what you know: what you do, who you sell to, ticket size, margin, what a customer is worth over their lifetime, your monthly budget, your website and platforms, and whatever funnel numbers you have.

We store every metric with its provenance: measured by you, inferred by us, or unknown. That tag follows the number through every decision we make downstream, so nothing we recommend later rests on a guess you never gave us.`,
    out: 'Captured',
    kv: ['<b>Ticket</b> £4,400', '<b>Margin</b> 62%', '<b>LTV</b> ×3.4', '<b>Budget</b> £2,000/mo',
         '<b>Cost per lead</b> unknown', '<b>Call→close</b> inferred']
  },
  {
    kicker: 'Stage 02 · website research',
    ttl: 'We read your business',
    hint: 'Site, socials, voice',
    body: `Before we write a word on your behalf, we read your website and your public profiles. We pull out three things: what you offer, what proof you can point to, and how you sound in writing.

This constraint keeps everything we send honest. We build every later draft from claims your own material already supports, so we can't invent a client, a case study, or a statistic that doesn't exist.`,
    out: 'Extracted',
    kv: ['<b>Offer</b> parsed', '<b>Real proof</b> 4 items', '<b>Tone</b> direct, plain-English',
         '<b>Fabricated claims</b> impossible']
  },
  {
    kicker: 'Stage 03 · market intel',
    ttl: 'We sweep your market',
    hint: 'Live, every run',
    body: `Then we sweep news, community discussion and video across your niche to establish which channels are working, who you compete against, where your ideal customers gather, and which live events are worth referencing in an opening line.

We refresh this on every run rather than baking it in once at setup, because a three-month-old signal tells you nothing about who is buying this week.`,
    out: 'Surfaced',
    kv: ['<b>Channels</b> ranked by strength', '<b>Competitors</b> identified', '<b>Watering holes</b> mapped',
         '<b>Trending signals</b> live']
  },
  {
    kicker: 'Stage 04 · strategy',
    ttl: 'We pick the play',
    hint: 'Gated on your maths',
    body: `Now we decide the channel mix, the budget split across those channels, and the messaging angle for each. We choose against your real economics rather than against what's fashionable.

We hard-gate paid channels on a 3:1 lifetime-value-to-acquisition-cost ratio. If the numbers don't clear it, we reject the channel and write the refusal down with the arithmetic beside it. We also name the human tasks: the parts a person handles.`,
    out: 'Decided',
    kv: ['<b>Email</b> 50%', '<b>LinkedIn</b> 30%', '<b>Content</b> 20%',
         '<b style="color:#ff6b6b">Paid ads</b> refused', '<b>Human tasks</b> listed']
  },
  {
    kicker: 'Stage 05 · execution',
    ttl: 'We run it for you',
    hint: 'Metered to the penny',
    body: `Per channel, on a loop we manage for you: we source prospects showing a real buying signal, research each one, draft a first touch in your voice referencing that signal, deduplicate against everyone already contacted, and queue it.

Every action draws against a wallet funded by your budget. When the budget runs out, we stop. We built the wallet to rule out a failure mode we have seen too often: spending past the number, then explaining it afterwards.`,
    out: 'Metered',
    kv: ['<b>Source</b> → research → draft → queue', '<b>Dedupe</b> against all prior contact',
         '<b>Wallet</b> drawn per action', '<b>On exhaustion</b> halt']
  },
  {
    kicker: 'Stage 06 · the gate',
    ttl: 'Your call: approve or bin',
    hint: 'The one human stage',
    body: `Everything we produce lands in an approval queue: the prospect, the signal we sourced it from, and the message already written. You approve, edit, or bin each one, or hand that job back to us to run on your behalf.

Either way a person signs off. The system enforces it: nothing carries an approved or sent status without a recorded approver and a timestamp. Regulated claims demand a second sign-off, and opt-outs go to a suppression list we can't route around.`,
    out: 'Enforced',
    kv: ['<b>Send-gate</b> human-approved', '<b>Approver</b> + timestamp stamped',
         '<b>Regulated claims</b> second sign-off', '<b>Suppression</b> permanent']
  }
];

const listEl = document.getElementById('stageList');
const panelEl = document.getElementById('stagePanel');

listEl.innerHTML = STAGES.map((s, i) => `
  <button class="stage-btn${i === 0 ? ' on' : ''}" data-i="${i}" type="button">
    <span class="idx">0${i + 1}</span>
    <span><span class="ttl">${s.ttl}</span><span class="hint" style="display:block">${s.hint}</span></span>
  </button>`).join('');

function paint(i) {
  const s = STAGES[i];
  panelEl.innerHTML = `<div class="fade-swap">
      <div class="kicker">${s.kicker}</div>
      <h3>${s.ttl}</h3>
      <div class="body">${s.body.split('\n\n').map(p => `<p style="margin-bottom:14px">${p}</p>`).join('')}</div>
      <div class="out"><div class="lbl">${s.out}</div>
        <div class="kv">${s.kv.map(k => `<i>${k}</i>`).join('')}</div>
      </div>
    </div>`;
  listEl.querySelectorAll('.stage-btn').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  document.querySelectorAll('#rail .node').forEach((n, ni) => n.classList.toggle('hot', ni === i));
}
listEl.addEventListener('click', e => {
  const b = e.target.closest('.stage-btn');
  if (b) { autoStage = false; paint(+b.dataset.i); }
});
paint(0);

/* auto-advance the stage explorer until the visitor takes over */
let autoStage = true, stageI = 0;
const stageSection = document.getElementById('how');
const stageIO = new IntersectionObserver(entries => {
  entries.forEach(e => { stageSection.dataset.visible = e.isIntersecting ? '1' : '0'; });
}, { threshold: 0.25 });
stageIO.observe(stageSection);
setInterval(() => {
  if (!autoStage || stageSection.dataset.visible !== '1') return;
  stageI = (stageI + 1) % STAGES.length;
  paint(stageI);
}, 5200);

/* =========================================================================
   HERO — travelling pulse along the rail + streaming console
   ========================================================================= */
const nodes = [...document.querySelectorAll('#rail .node')];
const consoleEl = document.getElementById('console');

/* Every line is tagged AI or HUMAN, because a prospect should never have to
   guess which work a machine did and which a person did. Adam owns strategy,
   which is where the judgement calls live: what to spend, what to refuse.
   Zach runs the account, Eric owns the words and anything regulated. */
const LOG = [
  ['ai', 'a', 'intake',   'profile loaded · 4 metrics measured, 2 inferred, 1 unknown'],
  ['hu', 'h', 'Zach',     'chased the client for the missing lifetime-value figure'],
  ['ai', 'a', 'intake',   'wallet funded £2,000.00 · ledger opened'],
  ['ai', 'b', 'website',  'fetched primary domain + 3 social profiles'],
  ['ai', 'b', 'website',  'voice profile extracted · 4 verifiable proof points found'],
  ['hu', 'h', 'Eric',     'read the site and rewrote the voice brief before sourcing'],
  ['ai', 'b', 'intel',    'sweeping niche · news, communities, video'],
  ['ai', 'b', 'intel',    '7 UK companies surfaced with live buying signals'],
  ['hu', 'h', 'Zach',     'dropped 2 of the 7 · wrong size, would waste the budget'],
  ['ai', 'a', 'strategy', 'pricing channels against LTV:CAC floor of 3.0'],
  ['ai', 'd', 'strategy', 'paid_ads flagged · CAC £4,286 > affordable £1,320'],
  ['hu', 'h', 'Adam',     'reviewed the maths and refused paid ads on this account'],
  ['hu', 'h', 'Adam',     'called the client to explain the refusal before spending'],
  ['hu', 'h', 'Adam',     'set the split · email 50%, linkedin 30%, content 20%'],
  ['ai', 'a', 'execute',  'sourcing → researching → drafting in client voice'],
  ['ai', 'a', 'execute',  'dedupe pass · 2 already contacted, skipped'],
  ['hu', 'h', 'Eric',     'edited 3 openers · too familiar for this sector'],
  ['ai', 'd', 'execute',  'regulated claim detected · second sign-off required'],
  ['hu', 'h', 'Eric',     'cleared the regulated claim with the client in writing'],
  ['ai', 'c', 'queue',    '4 leads queued · status in_review · awaiting client approval'],
  ['ai', 'c', 'wallet',   '£184.20 drawn · £1,815.80 remaining · within budget'],
];

let li = 0;
function pushLog() {
  const [kind, cls, tag, msg] = LOG[li % LOG.length];
  const d = new Date();
  const ts = String(d.getHours()).padStart(2, '0') + ':' +
             String(d.getMinutes()).padStart(2, '0') + ':' +
             String(d.getSeconds()).padStart(2, '0');
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span class="ts">${ts}</span>` +
                  `<span class="who ${kind}">${kind === 'hu' ? 'HUMAN' : 'AI'}</span>` +
                  `<span class="tag ${cls}">${tag.padEnd(8, ' ')}</span>` +
                  `<span class="msg">${msg}</span>`;
  consoleEl.appendChild(row);
  while (consoleEl.children.length > 8) consoleEl.removeChild(consoleEl.firstChild);

  // fire the pulse on the matching rail node
  const map = { intake: 0, website: 1, intel: 2, strategy: 3, execute: 4, queue: 5, wallet: 5 };
  const n = nodes[map[tag]];
  if (n) {
    nodes.forEach(x => x.classList.remove('hot'));
    n.classList.add('hot');
    n.classList.remove('fire');
    void n.offsetWidth;
    const next = nodes[map[tag] + 1];
    if (next) {
      n.style.setProperty('--dx', (next.offsetLeft - n.offsetLeft) + 'px');
      n.classList.add('fire');
    }
  }
  li++;
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
for (let i = 0; i < 5; i++) pushLog();
if (!reduced) {
  let heroVisible = true;
  new IntersectionObserver(e => { heroVisible = e[0].isIntersecting; }, { threshold: 0 })
    .observe(document.getElementById('machine'));
  setInterval(() => { if (heroVisible && !document.hidden) pushLog(); }, 1750);
}

/* =========================================================================
   PILLAR I — PREDICT: size the embedded forecast iframe to its content.
   The widget (forecast-widget.html) is served from THIS origin, so the parent
   can read its document height and grow the frame — no inner scrollbar, no
   fixed guess. Falls back silently if the browser ever blocks the access.
   ========================================================================= */
(function () {
  const frame = document.getElementById('forecastFrame');
  if (!frame) return;

  // ── Engine selection ─────────────────────────────────────────────────
  // Same deployed folder works both places: on localhost the forecast talks to
  // the LOCAL Python engine (forecast_service.py on :8791); anywhere else it
  // talks to the deployed engine. ⚠️ Before launch, set PROD_ENGINE to the real
  // deployed URL (Render) and BOOKING_URL to the real scheduler link.
  const PROD_ENGINE = 'https://tma-forecast-engine.onrender.com'; // TODO: real URL
  const LOCAL_ENGINE = 'http://localhost:8791';
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const engine = isLocal ? LOCAL_ENGINE : PROD_ENGINE;
  const booking = frame.getAttribute('data-booking') || '';
  if (!frame.src) {
    frame.src = 'forecast-widget.html?api=' + encodeURIComponent(engine) +
      '&booking=' + encodeURIComponent(booking) + '&theme=dark&embed=1';
  }

  let last = 0;
  const fit = () => {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.body) return;
      const h = doc.body.scrollHeight;               // body has min-height:0 in embed mode
      if (h > 200 && Math.abs(h - last) > 3) { last = h; frame.style.height = (h + 8) + 'px'; }
    } catch (e) { /* cross-origin (e.g. if later hosted elsewhere) — leave CSS height */ }
  };
  frame.addEventListener('load', () => {
    fit();
    try {
      const win = frame.contentWindow;
      if (win && 'ResizeObserver' in win) new win.ResizeObserver(fit).observe(frame.contentDocument.body);
    } catch (e) {}
  });
  // Also accept an explicit height ping (works even if the widget is later
  // hosted cross-origin and posts its height).
  window.addEventListener('message', (ev) => {
    const d = ev && ev.data;
    if (d && d.type === 'tma-forecast-height' && typeof d.height === 'number' && d.height > 200) {
      frame.style.height = (d.height + 8) + 'px';
    }
  });
  let n = 0;
  const poll = setInterval(() => { fit(); if (++n > 20) clearInterval(poll); }, 500);
})();
