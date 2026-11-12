// The composition root. One clinic, one system: its config, its store, its clock, its transports, its
// calendar and its AI adapter, sealed off from every other clinic's.

import { MemoryStore } from './store.js';
import { MessageLibrary } from './messages.js';
import { Ids, systemClock } from './util.js';
import { inbound } from './pipeline.js';
import { retryFailed } from './outbound.js';
import { runDueSequences } from './followup.js';
import { availableSlots, book, cancel, move, recordAttendance, sendDueReminders, memoryCalendar } from './booking.js';
import { markPlanAccepted, markInvoiced, markPaid, markLost, completeTask, LOST_REASONS } from './outcome.js';
import { buildReview, renderReview } from './review.js';
import { dailyCheck, runAlarm, runDailyAlarmIfDue, markSourceOk, markSourceFailed, recordProbe, sourceStates } from './alarm.js';
import { createAi } from './ai/adapter.js';

const REQUIRED = ['id', 'name', 'phone', 'address', 'openingHours', 'acknowledgementWindowMinutes', 'dedupeWindowDays', 'sources', 'responder', 'calendar', 'followUp', 'alarm', 'bookingBaseUrl'];

export function validateConfig(config) {
  const missing = REQUIRED.filter((k) => config[k] == null);
  if (missing.length) throw new Error(`Clinic config is missing: ${missing.join(', ')}`);
  if (!config.responder.name) throw new Error('Clinic config needs responder.name: the named person who owns clinical and unclear enquiries.');
  if (!config.openingHours.days || !config.openingHours.start || !config.openingHours.end) throw new Error('openingHours needs days, start and end.');
  return true;
}

/** Transports that keep what they were asked to send. Tests and the demo use these; `down` makes them fail. */
export function memoryTransports() {
  const make = (name) => {
    const t = {
      name: `memory-${name}`,
      sent: [],
      down: false,
      failNext: 0,
      async send(msg) {
        if (this.down) return { ok: false, error: `${name} transport down` };
        if (this.failNext > 0) {
          this.failNext -= 1;
          return { ok: false, error: `${name} transport refused (simulated)` };
        }
        this.sent.push({ ...msg, at: new Date().toISOString() });
        return { ok: true, providerId: `${name}-${this.sent.length}` };
      },
    };
    return t;
  };
  return { email: make('email'), sms: make('sms'), telegram: make('telegram') };
}

export function createSystem({ config, messages, store, clock, transports, calendar, ai, links } = {}) {
  if (!config) throw new Error('createSystem needs a clinic config.');
  validateConfig(config);
  const library = messages instanceof MessageLibrary ? messages : new MessageLibrary(messages);
  const lint = library.lintAll();
  if (lint.length) throw new Error(`Approved message library fails the clinical lint: ${lint.map((f) => `${f.id} (${f.hits.join(', ')})`).join('; ')}`);

  const sys = {
    config,
    messages: library,
    store: store || new MemoryStore(),
    clock: clock || systemClock(),
    transports: transports || memoryTransports(),
    calendar: calendar || memoryCalendar(),
    ai: ai || createAi(config),
    links: {
      booking: (enquiry) => `${config.bookingBaseUrl}/${enquiry.id}`,
      manage: (enquiry, appt) => `${config.bookingBaseUrl}/${enquiry.id}/${appt.id}`,
      board: (enquiry) => `${config.boardBaseUrl || 'http://127.0.0.1:4480/board'}#${enquiry.id}`,
      ...(links || {}),
    },
  };
  sys.ids = new Ids(sys.store);
  if (!sys.store.get('counters', 'install')) sys.store.put('counters', { id: 'install', at: sys.clock.now().toISOString() });
  sys.event = (enquiryId, type, detail, at) => {
    const row = { id: sys.ids.next('ev'), at: (at || sys.clock.now()).toISOString(), enquiryId: enquiryId || null, type, detail };
    sys.store.put('events', row);
    if (enquiryId) {
      const e = sys.store.get('enquiries', enquiryId);
      if (e) {
        e.events = e.events || [];
        e.events.push({ at: row.at, type, detail });
        sys.store.put('enquiries', e);
      }
    }
    return row;
  };

  const api = {
    sys,
    config,
    store: sys.store,
    clock: sys.clock,
    transports: sys.transports,
    messages: library,
    LOST_REASONS,

    // S1 and S2
    inbound: (event) => inbound(sys, event),

    // S3
    availableSlots: (opts) => availableSlots(sys, sys.clock.now(), opts),
    book: (enquiryId, startIso, opts) => book(sys, enquiryId, startIso, opts),
    cancel: (appointmentId, opts) => cancel(sys, appointmentId, opts),
    move: (appointmentId, startIso, opts) => move(sys, appointmentId, startIso, opts),
    recordAttendance: (appointmentId, opts) => recordAttendance(sys, appointmentId, opts),

    // S5 and the human layer
    completeTask: (taskId, opts) => completeTask(sys, taskId, opts),
    markPlanAccepted: (id, opts) => markPlanAccepted(sys, id, opts),
    markInvoiced: (id, opts) => markInvoiced(sys, id, opts),
    markPaid: (id, opts) => markPaid(sys, id, opts),
    markLost: (id, opts) => markLost(sys, id, opts),

    // S6
    review: (opts) => buildReview(sys, opts),
    reviewText: (opts) => renderReview(buildReview(sys, opts)),

    // the alarm and source health
    dailyCheck: () => dailyCheck(sys, sys.clock.now()),
    runAlarm: (opts) => runAlarm(sys, sys.clock.now(), opts),
    sourceOk: (id) => markSourceOk(sys, id, sys.clock.now()),
    sourceFailed: (id, err) => markSourceFailed(sys, id, err, sys.clock.now()),
    probe: (id, result) => recordProbe(sys, id, result, sys.clock.now()),
    sourceStates: () => sourceStates(sys, sys.clock.now()),

    /** Everything that is due now: retries, reminders, follow-up steps, the daily alarm. Run it every few minutes. */
    async tick() {
      const now = sys.clock.now();
      const retried = await retryFailed(sys, now);
      const reminders = await sendDueReminders(sys, now);
      const followUps = await runDueSequences(sys, now);
      const alarm = await runDailyAlarmIfDue(sys, now);
      return { at: now.toISOString(), retried: retried.length, reminders: reminders.length, followUps: followUps.length, alarm: alarm ? alarm.state : null };
    },

    enquiry: (id) => sys.store.get('enquiries', id),
    enquiries: () => sys.store.all('enquiries'),
    tasks: (pred) => sys.store.find('tasks', pred || (() => true)),
    outbox: (pred) => sys.store.find('outbox', pred || (() => true)),
    appointments: (pred) => sys.store.find('appointments', pred || (() => true)),
    alarms: () => sys.store.all('alarms'),
    events: (enquiryId) => sys.store.find('events', (e) => !enquiryId || e.enquiryId === enquiryId),

    /** The board: honest states side by side. Counts and ids only, plus short names for the clinic's own screen. */
    board() {
      const now = sys.clock.now();
      const enquiries = sys.store.all('enquiries').filter((e) => e.stage !== 'spam');
      const byStage = {};
      for (const e of enquiries) byStage[e.stage] = (byStage[e.stage] || 0) + 1;
      const outbox = sys.store.all('outbox');
      const tasks = sys.store.all('tasks');
      return {
        at: now.toISOString(),
        clinic: config.name,
        enquiries: enquiries.length,
        byStage,
        messages: {
          sent: outbox.filter((r) => r.state === 'sent').length,
          queued: outbox.filter((r) => r.state === 'queued').length,
          failed: outbox.filter((r) => r.state === 'failed').length,
          gaveUp: outbox.filter((r) => r.state === 'gave-up').length,
          blocked: outbox.filter((r) => r.state === 'blocked').length,
        },
        tasks: {
          open: tasks.filter((t) => t.state === 'open').length,
          overdue: tasks.filter((t) => t.state === 'open' && Date.parse(t.dueAt) < now.getTime()).length,
          done: tasks.filter((t) => t.state === 'done').length,
        },
        sources: sourceStates(sys, now),
        ai: { adapter: sys.ai.name, enabled: sys.ai.enabled },
      };
    },
  };
  return api;
}

export { MemoryStore, MessageLibrary, memoryCalendar, createAi };
export { fakeClock, systemClock, parseDuration } from './util.js';
