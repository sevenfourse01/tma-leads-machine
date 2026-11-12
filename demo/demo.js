// The enquiry handling demo. Runs the real pipeline (./engine/core, copied from tma-enquiry/src/core by
// demo/build.mjs) in the browser with a memory store, memory transports and a clock we move by hand.

import { createSystem, memoryTransports, MemoryStore, fakeClock } from './engine/core/system.js';
import { runAcceptance } from './engine/core/acceptance.js';
import { renderReview } from './engine/core/review.js';
import { formatLondon, nextOpenInfo } from './engine/core/ukTime.js';
import { clinic, messages, cases, lastRun, built } from './engine/data.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CONFIG = window.TMA_CONFIG || {};
document.documentElement.classList.add('js');
if (typeof CONFIG.bookingUrl === 'string' && /^https:\/\/\S+$/.test(CONFIG.bookingUrl)) document.querySelectorAll('[data-book-link]').forEach((a) => { a.href = CONFIG.bookingUrl; });

// quiet entrances, on entering the viewport; the page reads fine without them
const reveal = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.rise').forEach((el) => reveal.observe(el));

// ---------- the walkthrough ----------

function newWorld(startIso) {
  const clock = fakeClock(startIso);
  const transports = memoryTransports();
  const system = createSystem({ config: clinic, messages, store: new MemoryStore(), clock, transports });
  return { system, clock, transports, enquiryId: null, lastPay: null };
}

function advanceToOpen(w) {
  const info = nextOpenInfo(w.clock.now(), clinic.openingHours);
  if (!info.open) w.clock.set(new Date(info.instant.getTime() + 60000).toISOString());
}

const SCENARIOS = [
  {
    key: 'routine', label: 'Routine: Priya asks about Invisalign', start: '2026-11-16T09:12:00Z',
    steps: [
      { say: 'Monday, 09:12. <b>Priya</b> fills in the website form. How much is Invisalign, can she book, evenings are best.', highlight: 'sources',
        run: async (w) => { const r = await w.system.inbound({ source: 'form', name: 'Priya Nair', email: 'priya.nair@example.com', phone: '07700 900101', message: "Hi, how much is Invisalign roughly and can I book a consultation? I'm free most evenings. Thanks, Priya" }); w.enquiryId = r.enquiry.id; } },
      { say: 'One record. Source stamped, owner named: Sarah. The approved acknowledgement goes in the same minute, and it says <b>nothing about treatment</b>.', highlight: 's2' },
      { say: 'The sort. No clinical words. Routine words: how much, Invisalign, book, consultation. Decided by the <b>keyword list</b>; no model was involved.', highlight: 'sort' },
      { say: 'The booking link goes, with the one fit question she did not answer. The record now waits a day in <b>follow-up</b>.', highlight: 's4' },
      { say: 'Tuesday, 09:43. No booking yet, so the first follow-up goes. Inside opening hours, never at two in the morning.', highlight: 's4',
        run: async (w) => { w.clock.advance(24.5 * 3600000); advanceToOpen(w); await w.system.tick(); } },
      { say: 'Tuesday, 10:05. Priya picks the first time that suits her. The slot is claimed, the confirmation goes, two reminders are scheduled and the <b>follow-up stops</b>.', highlight: 's3',
        run: async (w) => { w.clock.advance(22 * 60000); const slots = w.system.availableSlots({ limit: 12 }); const evening = slots.find((s) => new Date(s).getUTCHours() >= 16) || slots[0]; await w.system.book(w.enquiryId, evening, { by: 'patient' }); } },
      { say: 'The day before: a reminder by email.', highlight: 's3',
        run: async (w) => { const a = w.system.appointments((x) => x.enquiryId === w.enquiryId)[0]; w.clock.set(new Date(Date.parse(a.startsAt) - 23 * 3600000).toISOString()); await w.system.tick(); } },
      { say: 'Two hours before: a reminder by text.', highlight: 's3',
        run: async (w) => { const a = w.system.appointments((x) => x.enquiryId === w.enquiryId)[0]; w.clock.set(new Date(Date.parse(a.startsAt) - 90 * 60000).toISOString()); await w.system.tick(); } },
      { say: 'Priya attends. Sarah records it in twenty seconds. A booking is <b>not a paying patient</b>, and the count says so.', highlight: 's5',
        run: async (w) => { const a = w.system.appointments((x) => x.enquiryId === w.enquiryId)[0]; w.clock.set(new Date(Date.parse(a.startsAt) + 45 * 60000).toISOString()); await w.system.recordAttendance(a.id, { attended: true, by: 'Sarah Whitfield' }); } },
      { say: 'Two days later Sarah records the plan accepted: TP-1042, £3,200. Still not a paying patient.', highlight: 's5',
        run: async (w) => { w.clock.advance(2 * 86400000); w.system.markPlanAccepted(w.enquiryId, { by: 'Sarah Whitfield', planRef: 'TP-1042', valueGBP: 3200 }); } },
      { say: 'Sarah tries to mark the deposit paid with just an amount. <b>Refused.</b> No reference, no evidence, so it does not count.', highlight: 's5',
        run: async (w) => { w.lastPay = w.system.markPaid(w.enquiryId, { by: 'Sarah Whitfield', amountGBP: 500 }); } },
      { say: 'With the receipt reference and where it is recorded: <b>paid</b>. Now Priya counts.', highlight: 's5',
        run: async (w) => { w.lastPay = w.system.markPaid(w.enquiryId, { by: 'Sarah Whitfield', amountGBP: 500, reference: 'R-5581', method: 'card', evidence: 'Deposit receipt R-5581 in the practice system' }); } },
      { say: 'Friday. One enquiry from the website form, acknowledged in under a minute, booked, attended, plan accepted, £500 paid with evidence. Handled by the template path. <b>Model share: nil.</b>', highlight: 's6' },
    ],
  },
  {
    key: 'clinical', label: 'Clinical: Margaret, my implant is bleeding', start: '2026-11-16T09:50:00Z',
    steps: [
      { say: 'Monday, 09:50. <b>Margaret</b> writes through the form. Her implant is bleeding when she brushes and it is sore. What should she do?', highlight: 'sources',
        run: async (w) => { const r = await w.system.inbound({ source: 'form', name: 'Margaret Hill', email: 'margaret.hill@example.com', phone: '07700 900201', message: "My implant is bleeding when I brush and it's a bit sore. What should I do?" }); w.enquiryId = r.enquiry.id; } },
      { say: 'The acknowledgement goes at once. It says only that Sarah has her message. <b>Nothing</b> about the implant, the bleeding or what to do.', highlight: 's2' },
      { say: 'The sort finds clinical words: my implant, bleeding, sore. Decided by the keyword list before any model could see it. <b>Straight to Sarah.</b> A task is created and she is emailed. A task is not a message to Margaret.', highlight: 'responder' },
      { say: 'Two days pass. The system wakes every minute. <b>Nothing else goes to Margaret.</b> No booking link, no follow-up, no guess.', highlight: 'responder',
        run: async (w) => { w.clock.advance(2 * 86400000); advanceToOpen(w); await w.system.tick(); } },
      { say: 'In the clinic, Sarah rang Margaret within the hour and closed the task herself. Friday shows it as a substantive reply inside the <b>staffed hour</b>.', highlight: 's6',
        run: async (w) => { const t = w.system.tasks((x) => x.enquiryId === w.enquiryId && x.kind === 'clinical')[0]; w.clock.set(new Date(Date.parse(t.createdAt) + 38 * 60000).toISOString()); w.system.completeTask(t.id, { by: 'Sarah Whitfield', note: 'Rang Margaret; seen Tuesday 11:00' }); } },
    ],
  },
  {
    key: 'stop', label: 'Stop: Emma says stop mid-sequence', start: '2026-11-16T09:20:00Z',
    steps: [
      { say: 'Monday, 09:20. <b>Emma</b> asks the price of whitening and whether she can book. Acknowledged, sorted routine, booking link sent.', highlight: 's2',
        run: async (w) => { const r = await w.system.inbound({ source: 'form', name: 'Emma Price', email: 'emma.price@example.com', message: 'How much is whitening and can I book?' }); w.enquiryId = r.enquiry.id; } },
      { say: 'Tuesday, 09:51. No booking, so the first follow-up goes.', highlight: 's4',
        run: async (w) => { w.clock.advance(24.5 * 3600000); advanceToOpen(w); await w.system.tick(); } },
      { say: 'An hour later Emma replies: <b>please stop contacting me</b>. The sequence stops at once, her details are suppressed, Sarah gets a task to note it. Nothing is sent back.', highlight: 's4',
        run: async (w) => { w.clock.advance(3600000); await w.system.inbound({ source: 'inbox', fromName: 'Emma Price', from: 'emma.price@example.com', text: "Please stop contacting me, I've gone elsewhere." }); } },
      { say: 'Ten days later the remaining steps would have been due. The system wakes. <b>Nothing goes out.</b>', highlight: 's4',
        run: async (w) => { w.clock.advance(10 * 86400000); advanceToOpen(w); await w.system.tick(); } },
    ],
  },
  {
    key: 'missed', label: 'Missed call: a text-back, then a reply', start: '2026-11-16T10:05:00Z',
    steps: [
      { say: 'Monday, 10:05. A call goes unanswered. The number is captured and a <b>text-back</b> goes inside the minute, asking what it is about. Sarah gets a call-back task.', highlight: 's2',
        run: async (w) => { const r = await w.system.inbound({ source: 'missed-call', from: '07700 900118' }); w.enquiryId = r.enquiry.id; } },
      { say: 'Seven minutes later the caller texts: whitening prices and a consultation. That reply <b>is</b> the enquiry, so it is sorted like one. Routine, by the keyword list. The booking link goes by text.', highlight: 'sort',
        run: async (w) => { w.clock.advance(7 * 60000); await w.system.inbound({ source: 'missed-call', from: '07700 900118', text: 'Hi, it was about whitening prices and booking a consultation. Thanks', status: 'sms-reply' }); } },
    ],
  },
  {
    key: 'alarm', label: 'Breakage: the inbox login expires', start: '2026-11-16T09:00:00Z',
    steps: [
      { say: 'Monday, 09:00. A routine enquiry comes in and is handled. The clinic is busy and nobody is watching the inbox connection.', highlight: 's2',
        run: async (w) => { const r = await w.system.inbound({ source: 'form', name: 'Nina Ross', email: 'nina.ross@example.com', message: 'How much is a check-up and can I book one?' }); w.enquiryId = r.enquiry.id; } },
      { say: '11:00. The mailbox password expires and the next poll is refused. The source goes red and the alarm fires <b>at once</b>: to Zach, with counts and the source name. No patient names.', highlight: 's1',
        run: async (w) => { w.clock.advance(2 * 3600000); await w.system.sourceFailed('inbox', { code: 'AUTH', message: 'IMAP login rejected: password expired' }); } },
      { say: 'Tuesday, 08:01. The daily check runs on schedule and says it again, until someone repairs it. The rule: <b>repair the same day</b> and tell the clinic before they find it.', highlight: 's1',
        run: async (w) => { w.clock.set('2026-11-17T08:01:00Z'); await w.system.tick(); } },
    ],
  },
];

let world = null;
let scenario = SCENARIOS[0];
let stepIndex = 0;
let playing = false;
let timer = null;
const FLOW_ORDER = ['sources', 's1', 's2', 'sort', 's3', 's4', 's5', 's6'];

function setFlow(highlight) {
  const idx = FLOW_ORDER.indexOf(highlight);
  document.querySelectorAll('#flow li').forEach((li) => {
    const step = li.dataset.step;
    li.classList.toggle('on', step === highlight);
    li.classList.toggle('done', idx > 0 && FLOW_ORDER.indexOf(step) >= 0 && FLOW_ORDER.indexOf(step) < idx);
  });
}

function stateClass(s) {
  return s === 'sent' ? 'sent' : s === 'failed' || s === 'blocked' || s === 'gave-up' ? 'failed' : '';
}

function render(say) {
  const { system, clock } = world;
  $('clock').textContent = formatLondon(clock.now());
  $('stepcount').textContent = `${Math.min(stepIndex, scenario.steps.length)} of ${scenario.steps.length}`;
  $('bar').style.width = `${(Math.min(stepIndex, scenario.steps.length) / scenario.steps.length) * 100}%`;
  if (say != null) $('narr').innerHTML = say;
  const e = world.enquiryId ? system.enquiry(world.enquiryId) : null;
  if (!e) return;

  const who = e.contact.name || e.contact.phone;
  $('patient-who').textContent = who;
  const inbound = (e.messages || []).filter((m) => m.direction === 'in');
  const out = system.outbox((r) => r.enquiryId === e.id && r.audience === 'patient');
  const items = [
    ...inbound.map((m) => ({ at: m.at, html: `<div class="msg in"><div class="who">${esc(who)} · ${esc(m.source === 'missed-call' && !m.text ? 'rang, no answer' : m.source)} · ${esc(formatLondon(new Date(m.at), { withDay: false }))}</div><div class="bubble">${esc(m.text || 'Missed call')}</div></div>` })),
    ...out.map((r) => ({ at: r.createdAt, html: `<div class="msg ${r.state === 'sent' ? '' : 'quiet'}"><div class="who">${esc(clinic.name)} · ${esc(r.channel)} · ${esc(formatLondon(new Date(r.createdAt), { withDay: false }))}</div><div class="bubble">${r.subject ? `<b class="subj">${esc(r.subject)}</b>` : ''}${esc(r.body)}</div><div class="state ${stateClass(r.state)}">${esc(r.state)}${r.state !== 'sent' && r.error ? `: ${esc(r.error)}` : ''}</div></div>` })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const screen = $('patient');
  screen.innerHTML = `<div class="bar"><span>What the patient sees</span><span id="patient-who">${esc(who)}</span></div>${items.map((i) => i.html).join('') || '<p class="empty">Nothing yet.</p>'}`;
  screen.scrollTop = screen.scrollHeight;

  const ack = e.acknowledgement || {};
  const lat = ack.latencyMs == null ? null : Math.round((ack.latencyMs / 60000) * 10) / 10;
  $('record').innerHTML = `<h3>The record</h3><dl class="kv">
    <dt>Id</dt><dd>${esc(e.id)}</dd>
    <dt>Source</dt><dd>${esc(e.source)}</dd>
    <dt>Owner</dt><dd>${esc(e.owner ? e.owner.name : 'none')}</dd>
    <dt>Acknowledged</dt><dd>${ack.state === 'sent' ? `${lat} min after arrival` : esc(ack.state || 'no')}</dd>
    <dt>Sorted</dt><dd>${e.sort ? `${esc(e.sort.label)}, by ${esc(e.sort.decidedBy)}` : 'not yet'}</dd>
    <dt>Handled by</dt><dd>${esc(e.handledBy || 'pending')}</dd>
    <dt>Stage</dt><dd>${esc(e.stage)}</dd>
    <dt>Follow-up</dt><dd>${e.followUp ? `${esc(e.followUp.name)}: ${esc(e.followUp.state)}${e.followUp.stopReason ? ` (${esc(e.followUp.stopReason)})` : ''}` : 'none'}</dd>
    ${e.outcome && e.outcome.paid ? `<dt>Paid</dt><dd>£${e.outcome.paid.amountGBP}, ref ${esc(e.outcome.paid.reference)}</dd>` : ''}
    ${world.lastPay && world.lastPay.ok === false ? `<dt>Payment</dt><dd class="warn">refused: ${esc(world.lastPay.refused)}</dd>` : ''}
  </dl>`;

  const tasks = system.tasks((t) => t.enquiryId === e.id);
  const internal = system.outbox((r) => r.enquiryId === e.id && r.audience === 'internal').length;
  $('clinic').innerHTML = `<h3>On Sarah's list</h3>${tasks.map((t) => `<div class="task"><span class="kind">${esc(t.kind)}</span> · ${esc(t.state)}${t.state === 'done' ? ` by ${esc(t.doneBy)}` : ''}<div>${esc(t.title)}</div><div class="meta">Due ${esc(formatLondon(new Date(t.dueAt)))}${t.note ? `. ${esc(t.note)}` : ''}</div></div>`).join('') || '<p class="empty">No task. The template path is handling it.</p>'}${internal ? `<p class="small" style="margin-top:12px">${internal} handover email${internal === 1 ? '' : 's'} to Sarah. Internal, not to the patient.</p>` : ''}`;

  const alarms = system.alarms();
  $('telegram').innerHTML = alarms.length ? alarms.map((a) => `<div class="tg">${esc(formatLondon(new Date(a.at)))} · ${esc(a.trigger)} · ${esc(a.state)}\n${esc(a.text)}</div>`).join('<hr style="border:0;border-top:1px solid var(--hair-dark);margin:12px 0">') : '<p class="empty">Quiet.</p>';

  const review = system.review({ from: '2026-11-01T00:00:00Z', to: new Date(clock.now().getTime() + 1000).toISOString() });
  const t = review.total;
  $('friday').innerHTML = `<p class="count">Eligible <b>${t.eligible}</b> · acknowledged inside ${t.windowMinutes} min <b>${t.ackWithinWindow}</b> · to responder <b>${t.toResponder}</b> · booking links <b>${t.bookingLinkSent}</b> · booked <b>${t.booked}</b> · attended <b>${t.attended}</b> · plans accepted <b>${t.planAccepted}</b> · invoiced <b>${t.invoiced}</b> · <b>paid ${t.paid}</b> (£${t.paidGBP}) · stopped <b>${t.stopped}</b></p><p class="small" style="margin-top:10px">Decided by rules ${review.decidedBy.rules}, keywords ${review.decidedBy.keywords}, model ${review.decidedBy.model}. Substantive replies inside the staffed hour: ${review.substantive.withinTarget} of ${review.substantive.tasks}.${review.exceptions.length ? ` Exceptions: ${review.exceptions.map((x) => esc(x.what)).join('; ')}.` : ''}</p>`;

  const events = system.events(world.enquiryId).slice(-8).reverse();
  $('log').innerHTML = events.map((ev) => `<div class="logline">${esc(formatLondon(new Date(ev.at), { withDay: false }))} · <span>${esc(ev.type)}</span> · ${esc(ev.detail)}</div>`).join('') || '<p class="empty">Nothing yet.</p>';
}

async function doStep() {
  if (stepIndex >= scenario.steps.length) { stop(); $('play').textContent = 'Play again'; return false; }
  const s = scenario.steps[stepIndex];
  stepIndex += 1;
  try { if (s.run) await s.run(world); } catch (err) { $('narr').innerHTML = `Error: ${esc(err.message)}`; stop(); return false; }
  setFlow(s.highlight);
  render(s.say);
  return true;
}

function stop() {
  playing = false;
  clearTimeout(timer);
  $('play').textContent = stepIndex >= scenario.steps.length ? 'Play again' : 'Play';
}

function schedule() {
  if (!playing) return;
  timer = setTimeout(async () => { const more = await doStep(); if (more && playing) schedule(); }, 4600);
}

function restart(which) {
  stop();
  if (which) scenario = which;
  world = newWorld(scenario.start);
  stepIndex = 0;
  setFlow(null);
  $('clock').textContent = formatLondon(world.clock.now());
  $('stepcount').textContent = `0 of ${scenario.steps.length}`;
  $('bar').style.width = '0%';
  $('narr').textContent = 'Press play, or step through.';
  $('patient').innerHTML = '<div class="bar"><span>What the patient sees</span><span id="patient-who"></span></div><p class="empty">Nothing yet.</p>';
  $('record').innerHTML = '<h3>The record</h3><p class="empty">Nothing yet.</p>';
  $('clinic').innerHTML = "<h3>On Sarah's list</h3><p class=\"empty\">Nothing yet.</p>";
  $('friday').innerHTML = '<p class="empty">Nothing yet.</p>';
  $('telegram').innerHTML = '<p class="empty">Quiet.</p>';
  $('log').innerHTML = '<p class="empty">Nothing yet.</p>';
  document.querySelectorAll('#scenarios button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === scenario.key)));
  $('play').textContent = 'Play';
}

$('scenarios').innerHTML = SCENARIOS.map((s) => `<button type="button" role="tab" data-key="${s.key}" aria-pressed="${s.key === scenario.key}">${esc(s.label)}</button>`).join('');
$('scenarios').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-key]'); if (b) restart(SCENARIOS.find((s) => s.key === b.dataset.key)); });
$('behind').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-tab]');
  if (!b) return;
  document.querySelectorAll('#behind .tabs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  for (const id of ['friday', 'telegram', 'log']) $(id).hidden = id !== b.dataset.tab;
});
$('play').addEventListener('click', async () => {
  if (playing) { stop(); return; }
  if (stepIndex >= scenario.steps.length) restart();
  playing = true;
  $('play').textContent = 'Pause';
  await doStep();
  schedule();
});
$('next').addEventListener('click', async () => { stop(); if (stepIndex >= scenario.steps.length) restart(); await doStep(); });
$('restart').addEventListener('click', () => restart());

// ---------- the test set ----------

let running = false;
$('run').addEventListener('click', async () => {
  if (running) return;
  running = true;
  $('run').setAttribute('disabled', 'true');
  $('results').innerHTML = '';
  let done = 0;
  const t0 = performance.now();
  const run = await runAcceptance({ cases, config: clinic, messages, onCase: (row) => { done += 1; $('progress').textContent = `${done} of ${cases.length}: ${row.id} ${row.pass ? 'pass' : 'fail'}`; } });
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  $('progress').textContent = `Ran ${cases.length} cases in ${secs}s in this browser, ${formatLondon(new Date())}.`;
  const sum = `<table class="sum"><thead><tr><th>Test case</th><th>Must happen</th><th>Cases</th><th>Passed</th><th>Result</th></tr></thead><tbody>${run.byRow.map((r) => `<tr><td>${esc(r.label)}</td><td class="must">${esc(r.must)}</td><td class="n">${r.count}</td><td class="n">${r.passed}</td><td class="${r.pass ? 'pass' : 'fail'}">${r.pass ? 'Pass' : 'Fail'}</td></tr>`).join('')}</tbody></table>`;
  const verdict = `<div class="verdict"><span class="big">${run.overall ? 'Every row passes.' : 'Not every row passes.'}</span><p class="small">Clinical row, zero tolerance: <span class="${run.clinical.pass ? 'pass' : 'fail'}">${run.clinical.pass ? 'pass' : 'fail'}</span>. Of ${run.library.sentPatientMessages} messages sent to patients across the week, ${run.library.notFromLibrary === 0 ? 'every one' : `${run.library.sentPatientMessages - run.library.notFromLibrary}`} came from the approved library and ${run.library.lintHits.length === 0 ? 'none' : run.library.lintHits.length} tripped the clinical lint.</p></div>`;
  const checks = `<details><summary>Every check, expected next to actual (${run.results.reduce((n, r) => n + r.checks.length, 0)})</summary><table class="checks"><thead><tr><th>Case</th><th>Check</th><th>Expected</th><th>Actual</th><th></th></tr></thead><tbody>${run.results.map((r) => r.checks.map((c) => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(c.name)}</td><td class="mono">${esc(c.expected)}</td><td class="mono">${esc(c.actual)}</td><td class="${c.pass ? 'pass' : 'fail'}">${c.pass ? 'pass' : 'fail'}</td></tr>`).join('')).join('')}</tbody></table></details>`;
  const week = `<details><summary>The Friday review for the test fortnight, every case replayed into one clinic</summary><pre class="review">${esc(renderReview(run.weekReview))}</pre></details>`;
  $('results').innerHTML = sum + verdict + checks + week;
  running = false;
  $('run').removeAttribute('disabled');
});

$('lastrun').textContent = lastRun
  ? `Last terminal run ${lastRun.overall ? 'passed' : 'failed'} at ${formatLondon(new Date(lastRun.ranAt))}. Engine built ${formatLondon(new Date(built.at))} from ${built.commit}.`
  : `Engine built ${formatLondon(new Date(built.at))} from ${built.commit}.`;

restart(SCENARIOS[0]);
