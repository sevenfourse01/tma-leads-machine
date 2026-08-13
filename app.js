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
   Marks the section you are in and fills the progress line.

   Observer-driven, not scroll-driven. The previous version recomputed every
   section's offsetTop inside a scroll handler, which forces a synchronous
   layout on every frame of every scroll — the single most expensive thing a
   page like this can do. Here the dot positions are measured once, and the
   fill moves between them on a CSS transition, so scrolling costs nothing. */
(() => {
  const toc = document.getElementById('toc');
  if (!toc) return;
  const fill = document.getElementById('tocFill');
  const targets = [...toc.querySelectorAll('a[data-t]')]
    .map(a => ({ a, el: document.getElementById(a.dataset.t) }))
    .filter(t => t.el);
  if (!targets.length) return;

  /* Pin the line between the first and last dot centres, and remember where
     each dot sits along it. Measured, not assumed: the rail's padding and gap
     can change in CSS without this drifting out of alignment. */
  let dotY = [];
  const measure = () => {
    const top = toc.getBoundingClientRect().top;
    dotY = targets.map(t => {
      const d = t.a.querySelector('.tdot').getBoundingClientRect();
      return d.top - top + d.height / 2;
    });
    const line = toc.querySelector('.tocline');
    line.style.top = dotY[0] + 'px';
    line.style.height = (dotY[dotY.length - 1] - dotY[0]) + 'px';
  };

  let current = 0;
  const paintRail = () => {
    if (!dotY.length) return;
    fill.style.height = (dotY[current] - dotY[0]) + 'px';
    targets.forEach((t, i) => {
      t.a.classList.toggle('reached', i <= current);
      t.a.classList.toggle('on', i === current);
    });
  };

  /* The band is the upper third of the viewport. A section is "current" while
     it is crossing that band, which matches where a reader's eye actually
     sits — and because the sections are wildly different heights, the deepest
     one currently in the band wins. */
  const live = new Set();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const i = targets.findIndex(t => t.el === e.target);
      if (i < 0) return;
      e.isIntersecting ? live.add(i) : live.delete(i);
    });
    if (live.size) {
      const next = Math.max(...live);
      if (next !== current) { current = next; paintRail(); }
    }
  }, { rootMargin: '-30% 0px -62% 0px', threshold: 0 });

  targets.forEach(t => io.observe(t.el));
  measure();
  paintRail();
  addEventListener('resize', () => { measure(); paintRail(); });
})();

/* ---- sticky nav -------------------------------------------------------
   A 1px sentinel at the top of the document: while it is on screen we are at
   the top of the page and the bar stays transparent. Costs one observer
   callback per crossing instead of one handler call per scroll frame. */
(() => {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none';
  document.body.prepend(sentinel);
  new IntersectionObserver(
    ([e]) => nav.classList.toggle('stuck', !e.isIntersecting)
  ).observe(sentinel);
})();

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
    ttl: 'We build your profile together',
    hint: 'The deep profile',
    body: `On the diagnosis call we go through what you know: what you do, who you sell to, ticket size, margin, what a customer is worth over their lifetime, your monthly budget, your website and platforms, and whatever funnel numbers exist.

We store every metric with its provenance: measured, inferred, or unknown. That tag follows the number through every decision downstream, so nothing we recommend later rests on a number nobody measured.`,
    out: 'Captured',
    kv: ['<b>Ticket</b> £4,400', '<b>Margin</b> 62%', '<b>LTV</b> ×3.4', '<b>Budget</b> £2,000/mo',
         '<b>Cost per lead</b> unknown', '<b>Call→close</b> inferred']
  },
  {
    kicker: 'Stage 02 · website research',
    ttl: 'We read your business',
    hint: 'Site, socials, voice',
    body: `Before we write a word on your behalf, we read your website and your public profiles. We pull out three things: what you offer, what proof you can point to, and how you sound in writing.

This constraint keeps everything we send honest: every later draft is built from claims your own material already supports, and a person checks it against that source before it can be approved.`,
    out: 'Extracted',
    kv: ['<b>Offer</b> parsed', '<b>Real proof</b> 4 items', '<b>Tone</b> direct, plain-English',
         '<b>Claim source</b> required']
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

Paid channels are gated on what a customer is worth against what one costs to win. If a channel can't hit the return you're aiming for, we won't spend your money there, and you get the arithmetic behind that decision in writing. We also name the human tasks: the parts a person handles.`,
    out: 'Decided',
    kv: ['<b>Email</b> 51%', '<b>LinkedIn</b> 31%', '<b>Content</b> 18%',
         '<b style="color:#ff6b6b">Paid ads</b> declined', '<b>Human tasks</b> listed']
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

/* /contact/ loads this same file and has no stage explorer. Unguarded, the
   innerHTML below threw there and killed every block after it — the same trap
   the year-stamp lookup hit at the top of this file. */
if (listEl && panelEl) {

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

}   /* end stage-explorer guard */

/* =========================================================================
   THE ACCOUNT VIEW — travelling pulse along the rail + the event feed
   ========================================================================= */
const nodes = [...document.querySelectorAll('#rail .node')];
const consoleEl = document.getElementById('console');

/* Every line is tagged AI or HUMAN, because a prospect should never have to
   guess which work a machine did and which a person did. Adam owns strategy,
   which is where the judgement calls live: what to spend, what to decline.
   Zach runs the account, Eric owns the words and anything regulated. */
/* Timestamps are FIXED, not generated from new Date(). The panel is a worked
   example of one week, and stamping it with the visitor's clock made a scripted
   loop read as live client activity — a claim the page cannot support. */
const LOG = [
  ['ai', 'a', 'intake',   'profile loaded · 4 metrics measured, 1 inferred, 1 unknown', 'Mon 09:04'],
  ['hu', 'h', 'Zach',     'chased the client for the missing lifetime-value figure',    'Mon 09:31'],
  ['ai', 'a', 'intake',   'wallet funded £2,000.00 · ledger opened',                    'Mon 10:02'],
  ['ai', 'b', 'website',  'fetched primary domain + 3 social profiles',                 'Mon 10:15'],
  ['ai', 'b', 'website',  'voice profile extracted · 4 verifiable proof points found',  'Mon 10:44'],
  ['hu', 'h', 'Eric',     'read the site and rewrote the voice brief before sourcing',  'Mon 14:20'],
  ['ai', 'b', 'intel',    'sweeping niche · news, communities, video',                  'Tue 08:12'],
  ['ai', 'b', 'intel',    '8 UK companies surfaced with live buying signals',           'Tue 08:47'],
  ['hu', 'h', 'Zach',     'dropped 2 of the 8 · wrong size, would waste the budget',    'Tue 11:05'],
  ['ai', 'a', 'strategy', 'pricing channels against the client target return',          'Tue 15:38'],
  ['ai', 'd', 'strategy', 'paid ads flagged · cost per customer £4,286 vs £1,320 affordable', 'Tue 15:39'],
  ['hu', 'h', 'Adam',     'showed the client why paid could not hit their target',      'Wed 09:50'],
  ['hu', 'h', 'Adam',     'called the client before any budget moved',                  'Wed 10:10'],
  ['hu', 'h', 'Adam',     'set the split · email 51%, linkedin 31%, content 18%',       'Wed 11:26'],
  ['ai', 'a', 'execute',  'sourcing → researching → drafting in client voice',          'Wed 13:02'],
  ['ai', 'a', 'execute',  'duplicate check · 2 already contacted, skipped',             'Wed 13:44'],
  ['hu', 'h', 'Eric',     'edited 3 openers · too familiar for this sector',            'Thu 09:18'],
  ['ai', 'd', 'execute',  'regulated claim detected · second sign-off required',        'Thu 10:03'],
  ['hu', 'h', 'Eric',     'cleared the regulated claim with the client in writing',     'Thu 16:41'],
  ['ai', 'c', 'queue',    '4 leads queued · status in review · awaiting sign-off',      'Fri 08:30'],
  ['ai', 'c', 'wallet',   '£184.20 drawn · £1,815.80 remaining · within budget',        'Fri 08:31'],
];

let li = 0;
function pushLog() {
  const [kind, cls, tag, msg, ts] = LOG[li % LOG.length];
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span class="ts">${ts}</span>` +
                  `<span class="who ${kind}">${kind === 'hu' ? 'HUMAN' : 'AI'}</span>` +
                  `<span class="tag ${cls}">${tag.padEnd(8, ' ')}</span>` +
                  `<span class="msg">${msg}</span>`;
  consoleEl.appendChild(row);
  /* the box fits five rows; keeping eight pushed the newest event out of sight */
  while (consoleEl.children.length > 5) consoleEl.removeChild(consoleEl.firstChild);

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

/* Pacing: a tracker, not an animation. Events land at a human interval and vary
   slightly rather than ticking like a clock. It behaved like a GIF at 1.75s. */
const machineEl = document.getElementById('machine');
if (consoleEl && machineEl) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let i = 0; i < 5; i++) pushLog();
  if (!reduced) {
    let machineVisible = true;
    new IntersectionObserver(e => { machineVisible = e[0].isIntersecting; }, { threshold: 0 })
      .observe(machineEl);
    const tick = () => {
      if (machineVisible && !document.hidden) pushLog();
      setTimeout(tick, 5200 + Math.random() * 2600);
    };
    setTimeout(tick, 5200);
  }
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
  /* one booking link sitewide: the widget used to carry its own stale cal.com
     URL in a data-booking attribute, which sent prospects somewhere else */
  const booking = frame.getAttribute('data-booking') || BOOKING_URL || '';
  if (!frame.src) {
    frame.src = 'forecast-widget.html?api=' + encodeURIComponent(engine) +
      '&booking=' + encodeURIComponent(booking) + '&theme=dark&embed=1';
  }

  /* The frame grows to fit its content shortly after load, which pushes
     everything below it down the page. A browser resolves a hash exactly once,
     using the placeholder height, so deep-linking to #pricing landed about
     220px short of the heading and was never corrected. Re-anchor whenever the
     frame's height changes, and stop the moment the visitor takes over the
     scroll themselves so we can never fight them for it. */
  let owned = false;
  const release = () => { owned = true; };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev =>
    addEventListener(ev, release, { passive: true, once: true }));

  const reanchor = () => {
    if (owned || !location.hash) return;
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    /* 'auto', not the page's smooth default: this is a correction to a position
       the visitor already asked for, not a journey they should watch. */
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  };

  let last = 0;
  const fit = () => {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.body) return;
      const h = doc.body.scrollHeight;               // body has min-height:0 in embed mode
      if (h > 200 && Math.abs(h - last) > 3) {
        last = h;
        frame.style.height = (h + 8) + 'px';
        reanchor();
      }
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
