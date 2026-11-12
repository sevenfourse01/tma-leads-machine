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
if (typeof CONFIG.bookingUrl === 'string' && /^https:\/\/\S+$/.test(CONFIG.bookingUrl)) document.querySelectorAll('[data-book-link]').forEach((a) => { a.href = CONFIG.bookingUrl; });

// ---------- the walkthrough ----------

function newWorld(startIso) {
  const clock = fakeClock(startIso);
  const transports = memoryTransports();
  const system = createSystem({ config: clinic, messages, store: new MemoryStore(), clock, transports });
  return { system, clock, transports, enquiryId: null, steps: [] };
}

const STAGE_STEP = {
  new: 's1', acknowledged: 's2', 'with-responder': 'responder', 'awaiting-reply': 's2', 'booking-sent': 's4', booked: 's3', attended: 's5', 'no-show': 's4',
  'plan-accepted': 's5', invoiced: 's5', paid: 's6', lost: 's6', stopped: 's4', spam: 's1',
};

function advanceToOpen(w) {
  const info = nextOpenInfo(w.clock.now(), clinic.openingHours);
  if (!info.open) w.clock.set(new Date(info.instant.getTime() + 60000).toISOString());
}

const SCENARIOS = [
  {
    key: 'routine', label: 'Routine: Priya asks about Invisalign', start: '2026-11-16T09:12:00Z',
    steps: [
      { say: 'Monday 16 November, 09:12. <b>Priya</b> fills in the website form: how much is Invisalign, can she book, evenings are best.', highlight: 'sources',
        run: async (w) => { const r = await w.system.inbound({ source: 'form', name: 'Priya Nair', email: 'priya.nair@example.com', phone: '07700 900101', message: "Hi, how much is Invisalign roughly and can I book a consultation? I'm free most evenings. Thanks, Priya" }); w.enquiryId = r.enquiry.id; } },
      { say: '<b>S1.</b> One record, source stamped, owner named: Sarah Whitfield. <b>S2.</b> The approved acknowledgement goes in the same minute. It says nothing about treatment.', highlight: 's2' },
      { say: '<b>The sort.</b> No clinical words. Routine words: how much, Invisalign, book, consultation. Decided by the keyword list; no model was involved. The two fit answers were read from her message: Invisalign, evenings.', highlight: 'sort' },
      { say: 'The booking link goes, with the one fit question she did not answer. From here the record sits in <b>S4</b>, waiting a day.', highlight: 's4' },
      { say: 'Tuesday 09:43. No booking yet, so the first follow-up goes, inside opening hours.', highlight: 's4',
        run: async (w) => { w.clock.advance(24.5 * 3600000); advanceToOpen(w); await w.system.tick(); } },
      { say: 'Tuesday 10:05. Priya picks the first time that suits her. <b>S3.</b> The slot is claimed, the confirmation goes, two reminders are scheduled, and the follow-up stops.', highlight: 's3',
        run: async (w) => { w.clock.advance(22 * 60000); const slots = w.system.availableSlots({ limit: 12 }); const evening = slots.find((s) => new Date(s).getUTCHours() >= 16) || slots[0]; await w.system.book(w.enquiryId, evening, { by: 'patient' }); } },
      { say: 'A day before the appointment: the email reminder.', highlight: 's3',
        run: async (w) => { const a = w.system.appointments((x) => x.enquiryId === w.enquiryId)[0]; w.clock.set(new Date(Date.parse(a.startsAt) - 23 * 3600000).toISOString()); await w.system.tick(); } },
      { say: 'Two hours before: the text reminder.', highlight: 's3',
        run: async (w) => { const a = w.system.appointments((x) => x.enquiryId === w.enquiryId)[0]; w.clock.set(new Date(Date.parse(a.startsAt) - 90 * 60000).toISOString()); await w.system.tick(); } },
      { say: 'Priya attends. Sarah records it in twenty seconds. <b>S5</b> begins: the decision follow-up is armed, but a booking is not a paying patient and the count says so.', highlight: 's5',
        run: async (w) => { const a = w.system.appointments((x) => x.enquiryId === w.enquiryId)[0]; w.clock.set(new Date(Date.parse(a.startsAt) + 45 * 60000).toISOString()); await w.system.recordAttendance(a.id, { attended: true, by: 'Sarah Whitfield' }); } },
      { say: 'Two days later Sarah records the treatment plan accepted: TP-1042, £3,200. Still not a paying patient.', highlight: 's5',
        run: async (w) => { w.clock.advance(2 * 86400000); w.system.markPlanAccepted(w.enquiryId, { by: 'Sarah Whitfield', planRef: 'TP-1042', valueGBP: 3200 }); } },
      { say: 'Sarah tries to mark the deposit paid with just an amount. <b>Refused</b>: no reference, no evidence. The system will not count it.', highlight: 's5',
        run: async (w) => { w.lastPay = w.system.markPaid(w.enquiryId, { by: 'Sarah Whitfield', amountGBP: 500 }); } },
      { say: 'With the receipt reference and where it is recorded: <b>paid</b>. Now, and only now, Priya counts.', highlight: 's5',
        run: async (w) => { w.lastPay = w.system.markPaid(w.enquiryId, { by: 'Sarah Whitfield', amountGBP: 500, reference: 'R-5581', method: 'card', evidence: 'Deposit receipt R-5581 in the practice system' }); } },
      { say: '<b>S6.</b> Friday: one enquiry from the website form, acknowledged in 0 minutes, booked, attended, plan accepted, £500 paid with evidence. Handled by the template path; the model share is 0%.', highlight: 's6' },
    ],
  },
  {
    key: 'clinical', label: 'Clinical: Margaret, my implant is bleeding', start: '2026-11-16T09:50:00Z',
    steps: [
      { say: 'Monday 09:50. <b>Margaret</b> writes through the form: her implant is bleeding when she brushes and it is sore. What should she do?', highlight: 'sources',
        run: async (w) => { const r = await w.system.inbound({ source: 'form', name: 'Margaret Hill', email: 'margaret.hill@example.com', phone: '07700 900201', message: "My implant is bleeding when I brush and it's a bit sore. What should I do?" }); w.enquiryId = r.enquiry.id; } },
      { say: '<b>S2.</b> The acknowledgement goes at once, and it says only that Sarah has her message. Nothing about the implant, the bleeding or what to do.', highlight: 's2' },
      { say: '<b>The sort.</b> Clinical words found: my implant, bleeding, sore. Decided by the keyword list before any model could see it. <b>Straight to Sarah</b>: a task is created and Sarah is emailed. A task is not a message to Margaret.', highlight: 'responder' },
      { say: 'Two days pass. The tick runs every minute. <b>Nothing else goes to Margaret</b>: no booking link, no follow-up, no guess.', highlight: 'responder',
        run: async (w) => { w.clock.advance(2 * 86400000); advanceToOpen(w); await w.system.tick(); } },
      { say: 'In the real clinic Sarah rang Margaret within the hour and closed the task herself. The Friday count shows it as a substantive reply inside the staffed hour.', highlight: 's6',
        run: async (w) => { const t = w.system.tasks((x) => x.enquiryId === w.enquiryId && x.kind === 'clinical')[0]; w.clock.set(new Date(Date.parse(t.createdAt) + 38 * 60000).toISOString()); w.system.completeTask(t.id, { by: 'Sarah Whitfield', note: 'Rang Margaret; seen Tuesday 11:00' }); } },
    ],
  },
  {
    key: 'stop', label: 'Stop: Emma says stop mid-sequence', start: '2026-11-16T09:20:00Z',
    steps: [
      { say: 'Monday 09:20. <b>Emma</b> asks the price of whitening and whether she can book. Acknowledged, sorted routine, booking link sent.', highlight: 's2',
        run: async (w) => { const r = await w.system.inbound({ source: 'form', name: 'Emma Price', email: 'emma.price@example.com', message: 'How much is whitening and can I book?' }); w.enquiryId = r.enquiry.id; } },
      { say: 'Tuesday 09:51. No booking, so the first follow-up goes.', highlight: 's4',
        run: async (w) => { w.clock.advance(24.5 * 3600000); advanceToOpen(w); await w.system.tick(); } },
      { say: 'An hour later Emma replies: <b>please stop contacting me</b>. The sequence stops at once, her contact details are suppressed, and Sarah gets a task to note it in the practice system. Nothing is sent back.', highlight: 's4',
        run: async (w) => { w.clock.advance(3600000); await w.system.inbound({ source: 'inbox', fromName: 'Emma Price', from: 'emma.price@example.com', text: "Please stop contacting me, I've gone elsewhere." }); } },
      { say: 'Ten days later the remaining steps would have been due. The tick runs. <b>Nothing goes out.</b>', highlight: 's4',
        run: async (w) => { w.clock.advance(10 * 86400000); advanceToOpen(w); await w.system.tick(); } },
    ],
  },
  {
    key: 'missed', label: 'Missed call: a text-back, then a reply', start: '2026-11-16T10:05:00Z',
    steps: [
      { say: 'Monday 10:05. A call goes unanswered. <b>S1</b> captures the number; <b>S2</b> texts back inside the minute and asks what it is about. Sarah gets a call-back task.', highlight: 's2',
        run: async (w) => { const r = await w.system.inbound({ source: 'missed-call', from: '07700 900118' }); w.enquiryId = r.enquiry.id; } },
      { say: 'Seven minutes later the caller texts: whitening prices and a consultation. That reply <b>is</b> the enquiry, so it is sorted like one: routine, by the keyword list. The booking link goes by text.', highlight: 'sort',
        run: async (w) => { w.clock.advance(7 * 60000); await w.system.inbound({ source: 'missed-call', from: '07700 900118', text: 'Hi, it was about whitening prices and booking a consultation. Thanks', status: 'sms-reply' }); } },
    ],
  },
  {
    key: 'alarm', label: 'Breakage: the inbox login expires', start: '2026-11-16T09:00:00Z',
    steps: [
      { say: 'Monday 09:00. A routine enquiry comes in and is handled. The clinic is busy; nobody is watching the inbox connection.', highlight: 's2',
        run: async (w) => { const r = await w.system.inbound({ source: 'form', name: 'Nina Ross', email: 'nina.ross@example.com', message: 'How much is a check-up and can I book one?' }); w.enquiryId = r.enquiry.id; } },
      { say: '11:00. The mailbox password expires; the next poll is refused. The source goes red and the alarm fires <b>immediately</b>, to Zach, with counts and the source name. No patient names.', highlight: 's1',
        run: async (w) => { w.clock.advance(2 * 3600000); await w.system.sourceFailed('inbox', { code: 'AUTH', message: 'IMAP login rejected: password expired' }); } },
      { say: 'Tuesday 08:01. The daily check runs on schedule and says it again until someone repairs it. The battle plan rule: repair the same day and tell the clinic before they find it.', highlight: 's1',
        run: async (w) => { w.clock.set('2026-11-17T08:01:00Z'); await w.system.tick(); } },
    ],
  },
];

let world = null;
let scenario = SCENARIOS[0];
let stepIndex = 0;
let playing = false;
let timer = null;

function setFlow(highlight, stage) {
  const lis = document.querySelectorAll('#flow li');
  const order = ['sources', 's1', 's2', 'sort', 's3', 's4', 's5', 's6'];
  const idx = order.indexOf(highlight);
  lis.forEach((li) => {
    const step = li.dataset.step;
    li.classList.toggle('on', step === highlight);
    li.classList.toggle('done', idx > 0 && order.indexOf(step) >= 0 && order.indexOf(step) < idx);
  });
}

function render(say) {
  const { system, clock, transports } = world;
  $('clock').textContent = formatLondon(clock.now());
  if (say != null) $('narr').innerHTML = say;
  const e = world.enquiryId ? system.enquiry(world.enquiryId) : null;

  if (e) {
    const ack = e.acknowledgement || {};
    const lat = ack.latencyMs == null ? null : Math.round(ack.latencyMs / 60000 * 10) / 10;
    $('record').innerHTML = `<h3>The record</h3><dl>
      <dt>Id</dt><dd>${esc(e.id)}</dd>
      <dt>Source</dt><dd>${esc(e.source)}</dd>
      <dt>Owner</dt><dd>${esc(e.owner ? e.owner.name : 'none')}</dd>
      <dt>Acknowledged</dt><dd>${ack.state === 'sent' ? `${lat} min after it arrived (target ${clinic.acknowledgementWindowMinutes})` : esc(ack.state || 'no')}</dd>
      <dt>Sorted</dt><dd>${e.sort ? `${esc(e.sort.label)}, by ${esc(e.sort.decidedBy)}` : 'not yet'}${e.sort && e.sort.reason ? `<br><span style="color:#8a93ab">${esc(e.sort.reason)}</span>` : ''}</dd>
      <dt>Handled by</dt><dd>${esc(e.handledBy || 'pending')}</dd>
      <dt>Stage</dt><dd>${esc(e.stage)}</dd>
      <dt>Follow-up</dt><dd>${e.followUp ? `${esc(e.followUp.name)}: ${esc(e.followUp.state)}${e.followUp.stopReason ? ` (${esc(e.followUp.stopReason)})` : ''}` : 'none'}</dd>
      ${e.outcome && e.outcome.paid ? `<dt>Paid</dt><dd>£${e.outcome.paid.amountGBP} ref ${esc(e.outcome.paid.reference)}<br><span style="color:#8a93ab">${esc(e.outcome.paid.evidence)}</span></dd>` : ''}
      ${world.lastPay && world.lastPay.ok === false ? `<dt>Last payment</dt><dd style="color:var(--amber)">refused: ${esc(world.lastPay.refused)}</dd>` : ''}
    </dl>`;

    const inbound = (e.messages || []).filter((m) => m.direction === 'in');
    const out = system.outbox((r) => r.enquiryId === e.id && r.audience === 'patient');
    const items = [...inbound.map((m) => ({ at: m.at, html: `<div class="msg in"><div class="who">${esc(formatLondon(new Date(m.at)))} · ${esc(e.contact.name || e.contact.phone)} via ${esc(m.source)}</div><div class="body">${esc(m.text || '(a missed call, no message)')}</div></div>` })),
      ...out.map((r) => ({ at: r.createdAt, html: `<div class="msg ${r.state === 'sent' ? '' : 'quiet'}"><div class="who">${esc(formatLondon(new Date(r.createdAt)))} · ${esc(r.channel)} · ${esc(r.templateId)} · <b>${esc(r.state)}</b></div>${r.subject ? `<div><b>${esc(r.subject)}</b></div>` : ''}<div class="body">${esc(r.body)}</div></div>` }))]
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    $('patient').innerHTML = `<h3>What the patient sees</h3>${items.map((i) => i.html).join('') || '<p class="empty">Nothing yet.</p>'}`;

    const tasks = system.tasks((t) => t.enquiryId === e.id);
    const internal = system.outbox((r) => r.enquiryId === e.id && r.audience === 'internal');
    $('clinic').innerHTML = `<h3>Sarah's tasks (the responder)</h3>${tasks.map((t) => `<div class="task"><b>${esc(t.kind)}</b> · ${esc(t.state)}${t.state === 'done' ? ` by ${esc(t.doneBy)}` : ''}<br>${esc(t.title)}<br><i>created ${esc(formatLondon(new Date(t.createdAt)))}, due ${esc(formatLondon(new Date(t.dueAt)))}${t.note ? `; ${esc(t.note)}` : ''}</i></div>`).join('') || '<p class="empty">No task. The template path is handling it.</p>'}${internal.length ? `<p class="fine" style="margin-top:10px">${internal.length} handover email${internal.length === 1 ? '' : 's'} to Sarah (internal, not to the patient).</p>` : ''}`;
  }

  const alarms = system.alarms();
  $('telegram').innerHTML = `<h3>Zach's Telegram</h3>${alarms.length ? alarms.map((a) => `<div class="tg">${esc(formatLondon(new Date(a.at)))} · ${esc(a.trigger)} · ${esc(a.state)}\n${esc(a.text)}</div>`).join('<hr style="border:0;border-top:1px solid #2d3a5c">') : '<p class="empty">Quiet.</p>'}`;

  const review = system.review({ from: '2026-11-01T00:00:00Z', to: new Date(clock.now().getTime() + 1000).toISOString() });
  const t = review.total;
  $('friday').innerHTML = `<h3>Friday count so far</h3><p class="count">Eligible <b>${t.eligible}</b> · acknowledged inside ${t.windowMinutes} min <b>${t.ackWithinWindow}</b> · to responder <b>${t.toResponder}</b> · booking links <b>${t.bookingLinkSent}</b> · booked <b>${t.booked}</b> · attended <b>${t.attended}</b> · plans accepted <b>${t.planAccepted}</b> · invoiced <b>${t.invoiced}</b> · <b>paid ${t.paid}</b> (£${t.paidGBP}) · stopped <b>${t.stopped}</b><br>Decided by: rules ${review.decidedBy.rules}, keywords ${review.decidedBy.keywords}, model ${review.decidedBy.model}. Substantive replies inside the staffed hour: ${review.substantive.withinTarget} of ${review.substantive.tasks}.${review.exceptions.length ? `<br>Exceptions: ${review.exceptions.map((x) => esc(x.what)).join('; ')}` : ''}</p>`;

  const events = system.events(world.enquiryId).slice(-8).reverse();
  $('log').innerHTML = `<h3>What the system logged</h3>${events.map((ev) => `<div class="msg quiet"><div class="who">${esc(formatLondon(new Date(ev.at)))} · ${esc(ev.type)}</div><div class="body">${esc(ev.detail)}</div></div>`).join('') || '<p class="empty">Nothing yet.</p>'}`;
}

async function doStep() {
  if (stepIndex >= scenario.steps.length) {
    stop();
    $('play').textContent = 'Play again';
    return false;
  }
  const s = scenario.steps[stepIndex];
  stepIndex += 1;
  try {
    if (s.run) await s.run(world);
  } catch (err) {
    $('narr').innerHTML = `<b>Error:</b> ${esc(err.message)}`;
    stop();
    return false;
  }
  const e = world.enquiryId ? world.system.enquiry(world.enquiryId) : null;
  setFlow(s.highlight, e ? e.stage : null);
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
  timer = setTimeout(async () => {
    const more = await doStep();
    if (more && playing) schedule();
  }, 4200);
}

function restart(which) {
  stop();
  if (which) scenario = which;
  world = newWorld(scenario.start);
  stepIndex = 0;
  setFlow(null, null);
  render('Press Play, or step through with Next.');
  $('record').innerHTML = '<h3>The record</h3><p class="empty">Nothing yet.</p>';
  $('patient').innerHTML = '<h3>What the patient sees</h3><p class="empty">Nothing yet.</p>';
  $('clinic').innerHTML = "<h3>Sarah's tasks (the responder)</h3><p class=\"empty\">Nothing yet.</p>";
  $('log').innerHTML = '<h3>What the system logged</h3><p class="empty">Nothing yet.</p>';
  document.querySelectorAll('#scenarios button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === scenario.key)));
  $('play').textContent = 'Play';
}

function buildScenarioButtons() {
  $('scenarios').innerHTML = SCENARIOS.map((s) => `<button type="button" role="tab" data-key="${s.key}" aria-pressed="${s.key === scenario.key}">${esc(s.label)}</button>`).join('');
  $('scenarios').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-key]');
    if (!b) return;
    restart(SCENARIOS.find((s) => s.key === b.dataset.key));
  });
}

$('play').addEventListener('click', async () => {
  if (playing) {
    stop();
    return;
  }
  if (stepIndex >= scenario.steps.length) restart();
  playing = true;
  $('play').textContent = 'Pause';
  await doStep();
  schedule();
});
$('next').addEventListener('click', async () => {
  stop();
  if (stepIndex >= scenario.steps.length) restart();
  await doStep();
});
$('restart').addEventListener('click', () => restart());

// ---------- the test set ----------

let running = false;
$('run').addEventListener('click', async () => {
  if (running) return;
  running = true;
  $('run').setAttribute('disabled', 'true');
  $('results').innerHTML = '';
  const done = [];
  const t0 = performance.now();
  const run = await runAcceptance({ cases, config: clinic, messages, onCase: (row) => {
    done.push(row);
    $('progress').textContent = `${done.length} of ${cases.length}: ${row.id} ${row.pass ? 'pass' : 'FAIL'}`;
  } });
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  $('progress').textContent = `Ran ${cases.length} cases in ${secs}s in this browser, ${formatLondon(new Date())}.`;
  const sum = `<table class="sumtable"><thead><tr><th>Test case (brief, section 5)</th><th>Must happen</th><th>Cases</th><th>Passed</th><th>Result</th></tr></thead><tbody>${run.byRow.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.must)}</td><td>${r.count}</td><td>${r.passed}</td><td class="${r.pass ? 'pass' : 'fail'}">${r.pass ? 'PASS' : 'FAIL'}</td></tr>`).join('')}</tbody></table>
    <p class="fine" style="margin-top:14px">Clinical row, zero tolerance: <span class="${run.clinical.pass ? 'pass' : 'fail'}">${run.clinical.pass ? 'PASS' : 'FAIL'}</span>. Every sent patient message came from the approved library: ${run.library.notFromLibrary === 0 ? 'yes' : 'no'}; clinical-lint hits across ${run.library.sentPatientMessages} sent messages: ${run.library.lintHits.length}. Overall: <span class="${run.overall ? 'pass' : 'fail'}">${run.overall ? 'PASS' : 'FAIL'}</span>.</p>`;
  const details = `<details><summary>Every check, expected next to actual (${run.results.reduce((n, r) => n + r.checks.length, 0)} checks)</summary><table class="checks"><thead><tr><th>Case</th><th>Row</th><th>Check</th><th>Expected</th><th>Actual</th><th></th></tr></thead><tbody>${run.results.map((r) => r.checks.map((c) => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(r.row)}</td><td>${esc(c.name)}</td><td class="mono">${esc(c.expected)}</td><td class="mono">${esc(c.actual)}</td><td class="${c.pass ? 'pass' : 'fail'}">${c.pass ? 'pass' : 'FAIL'}</td></tr>`).join('')).join('')}</tbody></table></details>`;
  const week = `<details open><summary>The Friday review for the test week (every case replayed into one clinic)</summary><pre class="review">${esc(renderReview(run.weekReview))}</pre></details>`;
  $('results').innerHTML = sum + details + week;
  running = false;
  $('run').removeAttribute('disabled');
});

if (lastRun) {
  $('lastrun').textContent = `Last terminal run: ${lastRun.overall ? 'PASS' : 'FAIL'} at ${formatLondon(new Date(lastRun.ranAt))}, engine built ${formatLondon(new Date(built.at))} (${built.commit}).`;
} else {
  $('lastrun').textContent = `Engine built ${formatLondon(new Date(built.at))} (${built.commit}).`;
}

buildScenarioButtons();
restart(SCENARIOS[0]);
