// S4 follow-up: an approved sequence that runs until a reply, a booking, a decision or a stop.
// Named sequences come from the clinic config (followUp.beforeBooking, afterConsult, noShow, missedCall).
// Each step is cumulative hours from the start; a step that falls outside opening hours waits for the
// next opening. When the steps run out, the sequence ends in a task for the responder, never silence.

import { sendMessage } from './outbound.js';
import { firstName, shortName } from './contact.js';
import { isWithinOpeningHours, nextOpenInfo, formatLondon } from './ukTime.js';

const ALLOWED_STAGES = {
  beforeBooking: ['booking-sent'],
  afterConsult: ['attended'],
  noShow: ['no-show'],
  missedCall: ['awaiting-reply'],
};

export function startSequence(sys, enquiry, name, now) {
  const def = sys.config.followUp && sys.config.followUp[name];
  if (!def || !def.steps || !def.steps.length) return null;
  enquiry.followUp = {
    name,
    step: 0,
    state: 'active',
    startedAt: now.toISOString(),
    nextAt: new Date(now.getTime() + def.steps[0].afterHours * 3600000).toISOString(),
    sent: [],
    stoppedAt: null,
    stopReason: null,
  };
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'follow-up started', `${name}: ${def.steps.length} step(s), first due ${enquiry.followUp.nextAt}`, now);
  return enquiry.followUp;
}

export function stopSequence(sys, enquiry, reason, now) {
  if (!enquiry.followUp || enquiry.followUp.state !== 'active') return false;
  enquiry.followUp.state = 'stopped';
  enquiry.followUp.stoppedAt = now.toISOString();
  enquiry.followUp.stopReason = reason;
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'follow-up stopped', reason, now);
  return true;
}

function stepVars(sys, enquiry) {
  const fit = (enquiry.sort && enquiry.sort.fit) || {};
  const consult = sys.store.find('appointments', (a) => a.enquiryId === enquiry.id).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0];
  return {
    firstName: firstName(enquiry.contact.name) || 'there',
    clinicName: sys.config.name,
    responderName: sys.config.responder.name,
    clinicPhone: sys.config.phone,
    bookingLink: sys.links.booking(enquiry),
    treatment: fit.treatment || 'a consultation',
    consultDate: consult ? formatLondon(new Date(consult.startsAt), { withDay: true }).split(',')[0] : 'recently',
  };
}

function createEndTask(sys, enquiry, def, now) {
  const task = {
    id: sys.ids.next('task'),
    enquiryId: enquiry.id,
    for: sys.config.responder.name,
    kind: def.thenKind || 'chase',
    title: `${shortName(enquiry.contact.name)}: ${def.thenTitle || 'no reply after the follow-up sequence; call them'}`,
    priority: 'normal',
    state: 'open',
    createdAt: now.toISOString(),
    dueAt: nextOpenInfo(now, sys.config.openingHours).instant.toISOString(),
    doneAt: null,
    doneBy: null,
    note: null,
  };
  sys.store.put('tasks', task);
  enquiry.tasks = enquiry.tasks || [];
  enquiry.tasks.push(task.id);
  sys.event(enquiry.id, 'task created', `${task.kind}: ${task.title}; a task is not a message`, now);
}

/** The tick calls this. Sends every due step, honouring stop conditions first. */
export async function runDueSequences(sys, now) {
  const results = [];
  const due = sys.store.find('enquiries', (e) => e.followUp && e.followUp.state === 'active' && Date.parse(e.followUp.nextAt) <= now.getTime());
  for (const enquiry of due) {
    const fu = enquiry.followUp;
    const def = sys.config.followUp[fu.name];
    const allowed = ALLOWED_STAGES[fu.name] || [];

    if (sys.store.find('suppression', (s) => enquiry.personKeys.includes(s.id)).length) {
      stopSequence(sys, enquiry, 'contact suppressed', now);
      continue;
    }
    if (!allowed.includes(enquiry.stage)) {
      stopSequence(sys, enquiry, `stage is now ${enquiry.stage}`, now);
      continue;
    }
    if (enquiry.lastInboundAt && Date.parse(enquiry.lastInboundAt) > Date.parse(fu.startedAt)) {
      stopSequence(sys, enquiry, 'patient replied', now);
      continue;
    }
    if (!isWithinOpeningHours(now, sys.config.openingHours)) {
      fu.nextAt = nextOpenInfo(now, sys.config.openingHours).instant.toISOString();
      sys.store.put('enquiries', enquiry);
      continue;
    }

    const step = def.steps[fu.step];
    const channel = enquiry.channel;
    const templateId = `${step.template}-${channel}`;
    if (!sys.messages.has(templateId)) {
      sys.event(enquiry.id, 'follow-up step skipped', `no approved ${channel} version of ${step.template}`, now);
    } else {
      const to = channel === 'email' ? enquiry.contact.email : enquiry.contact.phone;
      const row = await sendMessage(sys, { enquiryId: enquiry.id, templateId, to, vars: stepVars(sys, enquiry), now, purpose: `follow-up:${fu.name}:${fu.step + 1}` });
      fu.sent.push({ step: fu.step, outboxId: row.id, state: row.state, at: now.toISOString() });
      results.push(row);
    }

    fu.step += 1;
    if (fu.step >= def.steps.length) {
      fu.state = 'exhausted';
      fu.nextAt = null;
      sys.store.put('enquiries', enquiry);
      sys.event(enquiry.id, 'follow-up exhausted', `${fu.name}: all ${def.steps.length} step(s) sent; a person takes it from here`, now);
      if ((def.then || 'task') === 'task') createEndTask(sys, enquiry, def, now);
    } else {
      fu.nextAt = new Date(Date.parse(fu.startedAt) + def.steps[fu.step].afterHours * 3600000).toISOString();
      if (Date.parse(fu.nextAt) <= now.getTime()) fu.nextAt = new Date(now.getTime() + 60000).toISOString();
      sys.store.put('enquiries', enquiry);
    }
  }
  return results;
}
