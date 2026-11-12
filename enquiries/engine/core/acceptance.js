// The acceptance runner: fires the test set through the real system and prints expected next to actual.
// Pure, so the same runner produces the table in the terminal and on the website demo page.
// Each case runs in its own fresh system (deterministic, isolated); a second pass replays every case into
// one shared system so the Friday review shows the whole week's counts.

import { createSystem, memoryTransports, MemoryStore } from './system.js';
import { fakeClock, parseDuration } from './util.js';
import { nextOpenInfo } from './ukTime.js';
import { clinicalLint } from './messages.js';
import { memoryCalendar } from './booking.js';

const ROWS = [
  { key: 'routine', label: 'Routine ("how much is Invisalign, can I book?")', must: 'Acknowledged inside 5 minutes, booking link sent, follow-up runs', expected: 20 },
  { key: 'clinical', label: 'Clinical ("my implant is bleeding")', must: 'Acknowledged, then straight to the responder. Zero automated replies about it', expected: 8 },
  { key: 'unclear', label: 'Unclear', must: 'Goes to the responder, never guessed', expected: 6 },
  { key: 'duplicates-spam', label: 'Duplicates and spam', must: 'One record per person, spam never acknowledged', expected: 6 },
  { key: 'stop', label: 'Patient replies "stop" mid-sequence', must: 'Follow-up stops at once', expected: 2 },
  { key: 'books-then-pays', label: 'Patient books, then pays', must: 'Counted as paid only once payment is marked with evidence', expected: 2 },
  { key: 'breakage', label: 'We break something on purpose', must: 'The daily alarm fires and Zach hears about it', expected: 2 },
];

function fresh(config, messages, startIso, { store, allowBackwards = false } = {}) {
  const clock = fakeClock(startIso, { allowBackwards });
  const transports = memoryTransports();
  const system = createSystem({ config, messages, store: store || new MemoryStore(), clock, transports, calendar: memoryCalendar() });
  return { system, clock, transports };
}

function patientMessages(system, enquiryId) {
  return system.outbox((r) => r.enquiryId === enquiryId && r.audience === 'patient' && r.state === 'sent');
}

async function runSteps(ctx, steps, onEvent) {
  const { system, clock, transports } = ctx;
  const state = ctx.state;
  for (const step of steps) {
    const [key] = Object.keys(step).filter((k) => k !== 'note');
    const arg = step[key];
    switch (key) {
      case 'at':
        // absolute times only move the clock forward; in the shared week replay an earlier case may already be past it
        if (Date.parse(arg) > clock.now().getTime()) clock.set(arg);
        break;
      case 'advance':
        clock.advance(parseDuration(arg));
        break;
      case 'advanceToOpen': {
        const info = nextOpenInfo(clock.now(), system.config.openingHours);
        if (!info.open) clock.set(new Date(info.instant.getTime() + 60000).toISOString());
        break;
      }
      case 'advanceToAppointment': {
        const appt = system.appointments((a) => a.enquiryId === state.enquiryId && (a.state === 'booked' || a.state === 'attended'))[0];
        if (!appt) throw new Error('advanceToAppointment: no appointment yet');
        const sign = String(arg).startsWith('-') ? -1 : 1;
        const ms = parseDuration(String(arg).replace(/^-/, ''));
        clock.set(new Date(Date.parse(appt.startsAt) + sign * ms).toISOString());
        break;
      }
      case 'form':
      case 'inbox':
      case 'missedCall': {
        const event = key === 'missedCall' ? { source: 'missed-call', ...arg } : { source: key, ...arg };
        const res = await system.inbound(event);
        state.lastOutcome = res.outcome;
        if (!state.enquiryId || res.outcome === 'new') state.enquiryId = res.enquiry.id;
        if (!state.contact) {
          if (key === 'missedCall') state.contact = { name: '', email: '', phone: arg.from };
          else if (key === 'inbox') state.contact = { name: arg.fromName || '', email: arg.from || '', phone: '' };
          else state.contact = { name: arg.name || '', email: arg.email || '', phone: arg.phone || '' };
        }
        if (onEvent) onEvent({ step: key, result: res });
        break;
      }
      case 'reply': {
        const c = state.contact || {};
        let event;
        if (arg.via === 'sms') event = { source: 'missed-call', from: c.phone, text: arg.text, callerName: c.name, status: 'sms-reply' };
        else if (arg.via === 'form') event = { source: 'form', name: c.name, email: c.email, phone: c.phone, message: arg.text };
        else event = { source: 'inbox', fromName: c.name, from: c.email, subject: 'Re:', text: arg.text };
        const res = await system.inbound(event);
        state.lastOutcome = res.outcome;
        if (onEvent) onEvent({ step: 'reply', result: res });
        break;
      }
      case 'tick': {
        const res = await system.tick();
        if (onEvent) onEvent({ step: 'tick', result: res });
        break;
      }
      case 'book': {
        const slots = system.availableSlots({ limit: 5 });
        const slot = arg === 'first' ? slots[0] : typeof arg === 'number' ? slots[arg] : arg;
        const res = await system.book(state.enquiryId, slot, { by: 'patient' });
        state.lastBooking = res;
        if (onEvent) onEvent({ step: 'book', result: res });
        break;
      }
      case 'attend': {
        const appt = system.appointments((a) => a.enquiryId === state.enquiryId && a.state === 'booked')[0];
        const res = await system.recordAttendance(appt.id, { attended: !!arg, by: system.config.responder.name });
        if (onEvent) onEvent({ step: 'attend', result: res });
        break;
      }
      case 'planAccepted':
        state.lastResult = system.markPlanAccepted(state.enquiryId, arg);
        break;
      case 'invoice':
        state.lastResult = system.markInvoiced(state.enquiryId, arg);
        break;
      case 'pay':
        state.lastPay = system.markPaid(state.enquiryId, arg);
        if (onEvent) onEvent({ step: 'pay', result: state.lastPay });
        break;
      case 'lost':
        state.lastResult = system.markLost(state.enquiryId, arg);
        break;
      case 'completeTask': {
        const task = system.tasks((t) => t.enquiryId === state.enquiryId && t.kind === arg.kind && t.state === 'open')[0];
        state.lastResult = task ? system.completeTask(task.id, { by: arg.by, note: arg.note }) : { ok: false, refused: 'no such open task' };
        break;
      }
      case 'checkpoint': {
        const e = system.enquiry(state.enquiryId);
        const review = system.review({ from: '2026-11-01T00:00:00Z', to: clock.now().toISOString() });
        state.checkpoints[arg] = { stage: e ? e.stage : null, paid: !!(e && e.outcome.paid), lastPay: state.lastPay, reviewPaid: review.total.paid, reviewInvoiced: review.total.invoiced };
        break;
      }
      case 'breakSource':
        await system.sourceFailed(arg.id, { code: arg.code, message: arg.message });
        break;
      case 'probe':
        await system.probe(arg.id, { ok: arg.ok, code: arg.code, message: arg.message });
        break;
      case 'alarm':
        await system.runAlarm({ trigger: 'daily' });
        break;
      case 'transportDown':
        transports[arg].down = true;
        break;
      case 'transportUp':
        transports[arg].down = false;
        break;
      default:
        throw new Error(`Unknown step '${key}'`);
    }
  }
}

function evaluate(ctx, expect) {
  const { system, transports, state } = ctx;
  const e = system.enquiry(state.enquiryId);
  const checks = [];
  const add = (name, expected, actual, pass) => checks.push({ name, expected: String(expected), actual: String(actual), pass: !!pass });
  const pm = e ? patientMessages(system, e.id) : [];
  const nonAck = pm.filter((m) => m.purpose !== 'acknowledgement');
  const review = system.review({ from: '2026-11-01T00:00:00Z', to: new Date(Date.parse(system.clock.now().toISOString()) + 86400000).toISOString() });

  for (const [key, expected] of Object.entries(expect)) {
    switch (key) {
      case 'outcome':
        add('last inbound outcome', expected, state.lastOutcome, state.lastOutcome === expected);
        break;
      case 'acknowledged': {
        const sent = !!(e && e.acknowledgement && e.acknowledgement.state === 'sent');
        add('acknowledged', expected, sent, sent === expected);
        break;
      }
      case 'ackWithinMinutes': {
        const ms = e && e.acknowledgement ? e.acknowledgement.latencyMs : null;
        const mins = ms == null ? null : Math.round((ms / 60000) * 100) / 100;
        add('acknowledged within (minutes)', `<= ${expected}`, mins == null ? 'not sent' : `${mins}`, mins != null && mins <= expected);
        break;
      }
      case 'ackTemplate':
        add('acknowledgement template', expected, e && e.acknowledgement ? e.acknowledgement.templateId : 'none', !!e && e.acknowledgement && e.acknowledgement.templateId === expected);
        break;
      case 'sort':
        add('sorted as', expected, e && e.sort ? e.sort.label : 'none', !!e && e.sort && e.sort.label === expected);
        break;
      case 'decidedBy':
        add('decided by', expected, e && e.sort ? e.sort.decidedBy : 'none', !!e && e.sort && e.sort.decidedBy === expected);
        break;
      case 'stage':
        add('final stage', expected, e ? e.stage : 'none', !!e && e.stage === expected);
        break;
      case 'bookingLinkSent': {
        const sent = !!(e && e.bookingLink && e.bookingLink.state === 'sent');
        add('booking link sent', expected, sent, sent === expected);
        break;
      }
      case 'responderTask': {
        const task = system.tasks((t) => t.enquiryId === e.id && t.kind === expected)[0];
        add(`task for ${system.config.responder.name}`, expected, task ? `${task.kind} (${task.id})` : 'none', !!task);
        break;
      }
      case 'patientMessagesBeyondAck':
        add('automated patient messages beyond the acknowledgement', expected, nonAck.length ? nonAck.map((m) => m.templateId).join(', ') : 0, nonAck.length === expected);
        break;
      case 'patientMessagesBeyondAckAdvice': {
        const hits = pm.flatMap((m) => clinicalLint(`${m.subject || ''} ${m.body}`));
        add('clinical advice in any automated message', expected, hits.length ? hits.join(', ') : 0, hits.length === expected);
        break;
      }
      case 'patientMessages':
        add('automated patient messages', expected, pm.length, pm.length === expected);
        break;
      case 'followUpsSentAtLeast': {
        const n = pm.filter((m) => String(m.purpose).startsWith('follow-up:')).length;
        add('follow-ups sent', `>= ${expected}`, n, n >= expected);
        break;
      }
      case 'followUpsSent': {
        const n = pm.filter((m) => String(m.purpose).startsWith('follow-up:')).length;
        add('follow-ups sent', expected, n, n === expected);
        break;
      }
      case 'followUpState':
        add('follow-up sequence', expected, e && e.followUp ? e.followUp.state : 'none', !!e && e.followUp && e.followUp.state === expected);
        break;
      case 'remindersSent': {
        const n = pm.filter((m) => String(m.purpose).startsWith('reminder:')).length;
        add('reminders sent', expected, n, n === expected);
        break;
      }
      case 'records': {
        const keys = e ? e.personKeys : [];
        const n = system.enquiries().filter((x) => x.stage !== 'spam' && x.personKeys.some((k) => keys.includes(k))).length;
        add('records for this person', expected, n, n === expected);
        break;
      }
      case 'duplicates':
        add('duplicates merged into the record', expected, e ? e.duplicates : 'none', !!e && e.duplicates === expected);
        break;
      case 'acksSentToPerson': {
        const n = pm.filter((m) => m.purpose === 'acknowledgement').length;
        add('acknowledgements sent to this person', expected, n, n === expected);
        break;
      }
      case 'patientMessagesAfterStop': {
        const stoppedAt = e && e.stoppedAt ? Date.parse(e.stoppedAt) : null;
        const n = stoppedAt == null ? 'never stopped' : pm.filter((m) => Date.parse(m.sentAt) > stoppedAt).length;
        add('automated messages after the stop', expected, n, n === expected);
        break;
      }
      case 'suppressed': {
        const s = !!(e && system.store.find('suppression', (x) => e.personKeys.includes(x.id)).length);
        add('contact suppressed', expected, s, s === expected);
        break;
      }
      case 'booked': {
        const b = !!(e && (e.booking || e.outcome.attended != null || ['booked', 'attended', 'paid', 'invoiced', 'plan-accepted'].includes(e.stage)));
        add('booked', expected, b, b === expected);
        break;
      }
      case 'attended':
        add('attended', expected, e ? e.outcome.attended : 'none', !!e && e.outcome.attended === expected);
        break;
      case 'planAccepted':
        add('plan accepted recorded', expected, !!(e && e.outcome.planAccepted), !!(e && e.outcome.planAccepted) === expected);
        break;
      case 'paid':
        add('paid with evidence', expected, !!(e && e.outcome.paid), !!(e && e.outcome.paid) === expected);
        break;
      case 'payRefusedAt': {
        const cp = state.checkpoints[expected];
        const refused = cp && cp.lastPay && cp.lastPay.ok === false ? cp.lastPay.refused : 'not refused';
        add(`payment without evidence refused (at ${expected})`, 'refused', refused, !!(cp && cp.lastPay && cp.lastPay.ok === false));
        break;
      }
      case 'paidAt': {
        const [cpName, val] = String(expected).split(':');
        const cp = state.checkpoints[cpName];
        add(`paid at ${cpName}`, val, cp ? cp.paid : 'no checkpoint', !!cp && String(cp.paid) === val);
        break;
      }
      case 'stageAt': {
        const [cpName, val] = String(expected).split(':');
        const cp = state.checkpoints[cpName];
        add(`stage at ${cpName}`, val, cp ? cp.stage : 'no checkpoint', !!cp && cp.stage === val);
        break;
      }
      case 'reviewPaidAt': {
        const [cpName, val] = String(expected).split(':');
        const cp = state.checkpoints[cpName];
        add(`review counts paid at ${cpName}`, val, cp ? cp.reviewPaid : 'no checkpoint', !!cp && String(cp.reviewPaid) === val);
        break;
      }
      case 'reviewInvoicedAt': {
        const [cpName, val] = String(expected).split(':');
        const cp = state.checkpoints[cpName];
        add(`review counts invoiced at ${cpName}`, val, cp ? cp.reviewInvoiced : 'no checkpoint', !!cp && String(cp.reviewInvoiced) === val);
        break;
      }
      case 'reviewPaid':
        add('review counts paid', expected, review.total.paid, review.total.paid === expected);
        break;
      case 'fitTreatment':
        add('fit answer: treatment', expected, e && e.sort && e.sort.fit ? e.sort.fit.treatment : 'none', !!e && e.sort && e.sort.fit && String(e.sort.fit.treatment || '').toLowerCase().includes(String(expected).toLowerCase()));
        break;
      case 'alarmsSentAtLeast': {
        const n = system.alarms().filter((a) => a.state === 'sent').length;
        add('alarms sent', `>= ${expected}`, n, n >= expected);
        break;
      }
      case 'alarmMentions':
      case 'alarmMentionsAlso': {
        const last = system.alarms().slice(-1)[0];
        const text = last ? last.text : '';
        add('last alarm says', `"${expected}"`, text.includes(expected) ? 'yes' : `no: ${text.replace(/\n/g, ' | ').slice(0, 160)}`, text.includes(expected));
        break;
      }
      case 'lastAlarmTrigger': {
        const last = system.alarms().slice(-1)[0];
        add('last alarm trigger', expected, last ? last.trigger : 'none', !!last && last.trigger === expected);
        break;
      }
      case 'alarmReachedTelegram': {
        const n = transports.telegram.sent.filter((m) => m.meta && m.meta.kind === 'alarm').length;
        add('alarm reached the Telegram transport', expected, n > 0, (n > 0) === expected);
        break;
      }
      default:
        add(key, expected, 'unknown expectation', false);
    }
  }
  return checks;
}

/** Runs the whole set. Returns rows with checks, the per-row summary, the zero-tolerance aggregate and the week review. */
export async function runAcceptance({ cases, config, messages, onCase } = {}) {
  const results = [];
  for (const c of cases) {
    const ctx = fresh(config, messages, c.start);
    ctx.state = { enquiryId: null, contact: null, lastOutcome: null, lastPay: null, lastResult: null, checkpoints: {} };
    let error = null;
    try {
      await runSteps(ctx, c.steps);
    } catch (err) {
      error = err && err.stack ? err.stack : String(err);
    }
    let checks = [];
    try {
      checks = evaluate(ctx, c.expect || {});
    } catch (err) {
      error = error || (err && err.stack ? err.stack : String(err));
    }
    if (error) checks.push({ name: 'ran without error', expected: 'yes', actual: error.split('\n')[0], pass: false });
    const pass = checks.length > 0 && checks.every((x) => x.pass);
    const e = ctx.system.enquiry(ctx.state.enquiryId);
    const row = { id: c.id, row: c.row, title: c.title, start: c.start, pass, checks, error, enquiryId: ctx.state.enquiryId, stage: e ? e.stage : null, sort: e && e.sort ? e.sort.label : null, handledBy: e ? e.handledBy : null, decidedBy: e && e.sort ? e.sort.decidedBy : null };
    results.push(row);
    if (onCase) onCase(row);
  }

  // the zero-tolerance aggregate across every clinical case: no automated message beyond the acknowledgement, and no clinical advice anywhere
  const clinical = results.filter((r) => r.row === 'clinical');
  const clinicalPass = clinical.length > 0 && clinical.every((r) => r.pass);

  const byRow = ROWS.map((r) => {
    const rows = results.filter((x) => x.row === r.key);
    return { ...r, count: rows.length, passed: rows.filter((x) => x.pass).length, pass: rows.length === r.expected && rows.every((x) => x.pass) };
  });

  // the week: every case replayed into one clinic, in start order. The clock rewinds to each case's start, so
  // enquiries land on their real days and one case's tick carries another's follow-ups, as a real week would.
  const week = fresh(config, messages, cases.map((c) => c.start).sort()[0], { allowBackwards: true });
  week.state = { checkpoints: {} };
  const ordered = [...cases].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  let weekError = null;
  for (const c of ordered) {
    week.state = { enquiryId: null, contact: null, lastOutcome: null, lastPay: null, lastResult: null, checkpoints: {} };
    week.clock.set(c.start);
    for (const t of ['email', 'sms', 'telegram']) week.transports[t].down = false;
    try {
      await runSteps(week, c.steps);
    } catch (err) {
      weekError = `${c.id}: ${err.message}`;
    }
  }
  const weekEnd = week.clock.max();
  week.clock.set(weekEnd.toISOString());
  const weekReview = week.system.review({ from: '2026-11-16T00:00:00Z', to: weekEnd.toISOString() });

  const allSentPatient = week.system.outbox((r) => r.audience === 'patient' && r.state === 'sent');
  const lintHits = allSentPatient.flatMap((m) => clinicalLint(`${m.subject || ''} ${m.body}`).map((h) => `${m.templateId}: ${h}`));
  const notFromLibrary = allSentPatient.filter((m) => !week.system.messages.has(m.templateId)).length;

  const overall = byRow.every((r) => r.pass) && clinicalPass && lintHits.length === 0 && notFromLibrary === 0 && !weekError;
  return {
    ranAt: new Date().toISOString(),
    results,
    byRow,
    clinical: { cases: clinical.length, pass: clinicalPass, tolerance: 'zero' },
    library: { sentPatientMessages: allSentPatient.length, lintHits, notFromLibrary },
    weekReview,
    weekError,
    overall,
  };
}

export function renderResultsTable(run) {
  const out = [];
  const w = [5, 16, 48, 44, 44, 5];
  const line = (cells) => cells.map((c, i) => String(c).slice(0, w[i]).padEnd(w[i])).join(' ');
  out.push(line(['Case', 'Row', 'Check', 'Expected', 'Actual', 'Pass']));
  out.push('-'.repeat(w.reduce((a, b) => a + b + 1, -1)));
  for (const r of run.results) {
    for (const c of r.checks) out.push(line([r.id, r.row, c.name, c.expected, c.actual, c.pass ? 'PASS' : 'FAIL']));
  }
  out.push('');
  out.push('Section 5 rows'.padEnd(52) + 'Cases'.padStart(6) + 'Passed'.padStart(8) + '  Result');
  out.push('-'.repeat(76));
  for (const r of run.byRow) out.push(`${r.label.slice(0, 50).padEnd(52)}${String(r.count).padStart(6)}${String(r.passed).padStart(8)}  ${r.pass ? 'PASS' : 'FAIL'}${r.count !== r.expected ? ` (brief expects ${r.expected})` : ''}`);
  out.push('');
  out.push(`Clinical row, zero tolerance: ${run.clinical.pass ? 'PASS' : 'FAIL'} (${run.clinical.cases} cases; no automated message beyond the acknowledgement; no clinical advice in any sent message).`);
  out.push(`Every sent patient message came from the approved library: ${run.library.notFromLibrary === 0 ? 'yes' : `NO (${run.library.notFromLibrary} did not)`}; lint hits: ${run.library.lintHits.length ? run.library.lintHits.join('; ') : 'none'}.`);
  if (run.weekError) out.push(`Week replay error: ${run.weekError}`);
  out.push(`OVERALL: ${run.overall ? 'PASS' : 'FAIL'}`);
  return out.join('\n');
}

export { ROWS };
