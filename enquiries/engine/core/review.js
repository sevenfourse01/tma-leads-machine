// S6 review: the Friday counts. Everything here is a count or a minute; no name, address or message
// text, so the same object can leave the clinic for TMA's internal OS.

import { median, pct } from './util.js';
import { openMinutesBetween } from './ukTime.js';
import { SOURCE_LABELS } from './pipeline.js';
import { sourceStates } from './alarm.js';

const SOURCES = ['form', 'inbox', 'missed-call'];

function emptyCounts() {
  return {
    received: 0,
    spam: 0,
    duplicates: 0,
    eligible: 0,
    acknowledged: 0,
    ackWithinWindow: 0,
    ackMinutes: [],
    routine: 0,
    clinical: 0,
    unclear: 0,
    callback: 0,
    toResponder: 0,
    bookingLinkSent: 0,
    booked: 0,
    attended: 0,
    noShow: 0,
    planAccepted: 0,
    invoiced: 0,
    paid: 0,
    paidGBP: 0,
    stopped: 0,
    lost: 0,
    followUpsSent: 0,
    remindersSent: 0,
  };
}

function finish(c, windowMinutes) {
  const ackMedian = median(c.ackMinutes);
  return {
    ...c,
    ackMinutes: undefined,
    ackMedianMinutes: ackMedian == null ? null : Math.round(ackMedian * 10) / 10,
    ackWithinWindowPct: pct(c.ackWithinWindow, c.eligible),
    bookedPctOfRoutine: pct(c.booked, c.routine),
    windowMinutes,
  };
}

/**
 * The review for a window [from, to]. Defaults to the seven days ending now.
 */
export function buildReview(sys, { from, to, now } = {}) {
  const end = to ? new Date(to) : sys.clock.now();
  const start = from ? new Date(from) : new Date(end.getTime() - 7 * 86400000);
  const asOf = now ? new Date(now) : sys.clock.now();
  const windowMinutes = sys.config.acknowledgementWindowMinutes;
  const inWindow = (iso) => iso && Date.parse(iso) >= start.getTime() && Date.parse(iso) <= end.getTime();

  const bySource = Object.fromEntries(SOURCES.map((s) => [s, emptyCounts()]));
  const total = emptyCounts();
  const handledBy = { rules: 0, template: 0, keywords: 0, model: 0, people: 0 };
  const decidedBy = { rules: 0, keywords: 0, model: 0 };
  const lostReasons = {};
  const enquiries = sys.store.find('enquiries', (e) => inWindow(e.receivedAt));
  const outbox = sys.store.all('outbox');

  for (const e of enquiries) {
    const buckets = [bySource[e.source], total];
    for (const c of buckets) {
      c.received += 1;
      if (e.stage === 'spam') {
        c.spam += 1;
        continue;
      }
      c.eligible += 1;
      c.duplicates += e.duplicates || 0;
      if (e.acknowledgement && e.acknowledgement.state === 'sent') {
        c.acknowledged += 1;
        const mins = (e.acknowledgement.latencyMs || 0) / 60000;
        c.ackMinutes.push(mins);
        if (mins <= windowMinutes) c.ackWithinWindow += 1;
      }
      const label = e.sort && e.sort.label;
      if (label === 'routine') c.routine += 1;
      if (label === 'clinical') c.clinical += 1;
      if (label === 'unclear') c.unclear += 1;
      if (label === 'callback') c.callback += 1;
      if (e.handledBy === 'people') c.toResponder += 1;
      if (e.bookingLink && e.bookingLink.state === 'sent') c.bookingLinkSent += 1;
      if (e.booking || ['booked', 'attended', 'no-show', 'plan-accepted', 'invoiced', 'paid'].includes(e.stage) || e.outcome.attended != null) c.booked += 1;
      if (e.outcome.attended === true) c.attended += 1;
      if (e.outcome.attended === false) c.noShow += 1;
      if (e.outcome.planAccepted) c.planAccepted += 1;
      if (e.outcome.invoiced) c.invoiced += 1;
      if (e.outcome.paid) {
        c.paid += 1;
        c.paidGBP += e.outcome.paid.amountGBP || 0;
      }
      if (e.stage === 'stopped') c.stopped += 1;
      if (e.outcome.lost) c.lost += 1;
    }
    if (e.stage === 'spam') {
      decidedBy.rules += 1;
      handledBy.rules += 1;
      continue;
    }
    if (e.sort && e.sort.decidedBy) decidedBy[e.sort.decidedBy] = (decidedBy[e.sort.decidedBy] || 0) + 1;
    if (e.handledBy) handledBy[e.handledBy] = (handledBy[e.handledBy] || 0) + 1;
    if (e.outcome.lost) lostReasons[e.outcome.lost.reason] = (lostReasons[e.outcome.lost.reason] || 0) + 1;
  }

  for (const row of outbox) {
    if (!inWindow(row.createdAt) || row.state !== 'sent') continue;
    const e = row.enquiryId ? sys.store.get('enquiries', row.enquiryId) : null;
    const buckets = e ? [bySource[e.source], total] : [total];
    if (String(row.purpose).startsWith('follow-up:')) for (const c of buckets) c.followUpsSent += 1;
    if (String(row.purpose).startsWith('reminder:')) for (const c of buckets) c.remindersSent += 1;
  }

  // substantive replies: responder tasks of the conversational kinds, measured in staffed minutes
  const target = sys.config.responder.substantiveReplyMinutes || 60;
  const convKinds = ['clinical', 'unclear', 'reply', 'callback'];
  const tasks = sys.store.find('tasks', (t) => convKinds.includes(t.kind) && inWindow(t.createdAt));
  let withinTarget = 0;
  let overdueOpen = 0;
  const staffedMinutes = [];
  for (const t of tasks) {
    if (t.doneAt) {
      const mins = openMinutesBetween(new Date(t.createdAt), new Date(t.doneAt), sys.config.openingHours);
      staffedMinutes.push(mins);
      if (mins <= target) withinTarget += 1;
    } else if (t.state === 'open' && Date.parse(t.dueAt) < asOf.getTime()) {
      overdueOpen += 1;
    }
  }

  // exceptions: the list the Friday review walks through
  const exceptions = [];
  for (const e of enquiries) {
    if (e.stage === 'spam') continue;
    if (!e.owner || !e.owner.name) exceptions.push({ enquiryId: e.id, what: 'no owner' });
    if (!e.acknowledgement || e.acknowledgement.state !== 'sent') exceptions.push({ enquiryId: e.id, what: `acknowledgement ${e.acknowledgement ? e.acknowledgement.state : 'missing'}` });
  }
  for (const t of tasks) if (t.state === 'open' && Date.parse(t.dueAt) < asOf.getTime()) exceptions.push({ enquiryId: t.enquiryId, what: `${t.kind} task past the staffed-hour target` });
  for (const row of outbox) if (inWindow(row.createdAt) && (row.state === 'failed' || row.state === 'gave-up')) exceptions.push({ enquiryId: row.enquiryId, what: `message ${row.state}: ${row.templateId}` });
  for (const s of sourceStates(sys, asOf)) if (s.state !== 'ok') exceptions.push({ enquiryId: null, what: `${s.label} ${s.state}${s.note ? ` (${s.note})` : ''}` });

  const alarms = sys.store.find('alarms', (a) => inWindow(a.at));

  return {
    clinic: sys.config.name,
    clinicId: sys.config.id,
    from: start.toISOString(),
    to: end.toISOString(),
    asOf: asOf.toISOString(),
    total: finish(total, windowMinutes),
    bySource: Object.fromEntries(SOURCES.map((s) => [s, { label: SOURCE_LABELS[s], ...finish(bySource[s], windowMinutes) }])),
    substantive: { tasks: tasks.length, withinTarget, withinTargetPct: pct(withinTarget, tasks.length), overdueOpen, medianStaffedMinutes: median(staffedMinutes), targetMinutes: target },
    handledBy,
    decidedBy,
    modelShare: pct(decidedBy.model, total.eligible),
    lostReasons,
    exceptions,
    alarms: { sent: alarms.filter((a) => a.state === 'sent').length, failed: alarms.filter((a) => a.state !== 'sent').length, lastAt: alarms.length ? alarms[alarms.length - 1].at : null },
    tmaHours: (sys.config.review && sys.config.review.tmaHoursThisWeek) ?? null,
    improvement: (sys.config.review && sys.config.review.improvement) || null,
    honesty: 'booked, plan accepted and invoiced are shown apart from paid; paid counts only payments marked with evidence',
  };
}

function cell(v) {
  if (v == null) return '-';
  return String(v);
}

export function renderReview(review) {
  const rows = [
    ['Received', 'received'],
    ['Spam dropped', 'spam'],
    ['Duplicates merged', 'duplicates'],
    ['Eligible', 'eligible'],
    ['Acknowledged', 'acknowledged'],
    [`Acknowledged within ${review.total.windowMinutes} min`, 'ackWithinWindow'],
    ['Median minutes to acknowledge', 'ackMedianMinutes'],
    ['Routine (automated path)', 'routine'],
    ['Clinical (to responder)', 'clinical'],
    ['Unclear (to responder)', 'unclear'],
    ['Missed calls (call back)', 'callback'],
    ['Booking links sent', 'bookingLinkSent'],
    ['Booked', 'booked'],
    ['Attended', 'attended'],
    ['No-shows', 'noShow'],
    ['Plans accepted', 'planAccepted'],
    ['Invoiced (not paid)', 'invoiced'],
    ['Paid with evidence', 'paid'],
    ['Paid £', 'paidGBP'],
    ['Stopped at request', 'stopped'],
    ['Lost', 'lost'],
    ['Follow-ups sent', 'followUpsSent'],
    ['Reminders sent', 'remindersSent'],
  ];
  const cols = ['Website form', 'Practice inbox', 'Missed call', 'All'];
  const w0 = 34;
  const w = 15;
  const line = (cells) => cells.map((c, i) => (i === 0 ? String(c).padEnd(w0) : String(c).padStart(w))).join('');
  const out = [];
  const days = Math.round((Date.parse(review.to) - Date.parse(review.from)) / 86400000);
  out.push(`${review.clinic}: ${days <= 8 ? 'week' : `${days} days`} ${review.from.slice(0, 10)} to ${review.to.slice(0, 10)}`);
  out.push(line(['', ...cols]));
  out.push('-'.repeat(w0 + w * cols.length));
  for (const [label, key] of rows) {
    out.push(line([label, cell(review.bySource.form[key]), cell(review.bySource.inbox[key]), cell(review.bySource['missed-call'][key]), cell(review.total[key])]));
  }
  out.push('');
  out.push(`Substantive replies inside ${review.substantive.targetMinutes} staffed minutes: ${review.substantive.withinTarget} of ${review.substantive.tasks} (${cell(review.substantive.withinTargetPct)}%); ${review.substantive.overdueOpen} open past target.`);
  out.push(`Who decided: rules ${review.decidedBy.rules}, keywords ${review.decidedBy.keywords}, model ${review.decidedBy.model} (model share ${cell(review.modelShare)}%).`);
  out.push(`Who handled: rules ${review.handledBy.rules}, template ${review.handledBy.template}, people ${review.handledBy.people}.`);
  out.push(`Alarms sent this week: ${review.alarms.sent}${review.alarms.failed ? `, ${review.alarms.failed} failed to send` : ''}.`);
  out.push(`TMA hours this week: ${cell(review.tmaHours)}.`);
  out.push(`Exceptions (${review.exceptions.length}):${review.exceptions.length ? '' : ' none'}`);
  for (const x of review.exceptions) out.push(`  ${x.enquiryId || '-'}  ${x.what}`);
  out.push(review.honesty);
  return out.join('\n');
}
