// S1 capture and S2 respond, in the order the brief sets: plain rules, then the fixed acknowledgement,
// then the keyword sort, then the model (if on), then people.

import { normaliseEmail, normalisePhone, personKeys, firstName, shortName } from './contact.js';
import { spamCheck, findExisting } from './rules.js';
import { clinicalMatches, isStop } from './keywords.js';
import { sortEnquiry } from './sort.js';
import { sendMessage, suppress, isSuppressed } from './outbound.js';
import { nextOpenInfo, isWithinOpeningHours, formatLondon } from './ukTime.js';
import { addOpenMinutes } from './util.js';
import { startSequence, stopSequence } from './followup.js';
import { markSourceOk } from './alarm.js';

export const STAGES = ['new', 'acknowledged', 'with-responder', 'awaiting-reply', 'booking-sent', 'booked', 'attended', 'no-show', 'plan-accepted', 'invoiced', 'paid', 'lost', 'stopped', 'spam'];

export const SOURCE_LABELS = { form: 'Website form', inbox: 'Practice inbox', 'missed-call': 'Missed call' };

function normaliseEvent(event) {
  const source = event.source;
  if (!['form', 'inbox', 'missed-call'].includes(source)) throw new Error(`Unknown source '${source}'. The three sources are form, inbox and missed-call.`);
  if (source === 'form') {
    return {
      source,
      name: event.name || '',
      email: event.email || '',
      phone: event.phone || '',
      text: event.message || event.text || '',
      subject: null,
      honeypot: event.honeypot || event.website || '',
      externalId: event.submissionId || null,
      page: event.page || null,
    };
  }
  if (source === 'inbox') {
    return {
      source,
      name: event.fromName || '',
      email: event.from || event.email || '',
      phone: event.phone || '',
      text: event.text || event.body || '',
      subject: event.subject || null,
      honeypot: '',
      externalId: event.messageId || null,
      inReplyTo: event.inReplyTo || null,
    };
  }
  return {
    source,
    name: event.callerName || '',
    email: '',
    phone: event.from || event.phone || '',
    text: event.text || '',
    subject: null,
    honeypot: '',
    externalId: event.callSid || null,
    callStatus: event.status || 'no-answer',
  };
}

function ackVars(sys, enquiry, now) {
  const { config } = sys;
  const open = nextOpenInfo(now, config.openingHours);
  return {
    firstName: firstName(enquiry.contact.name) || 'there',
    clinicName: config.name,
    responderName: config.responder.name,
    clinicPhone: config.phone,
    openText: open.text,
  };
}

/** The approved acknowledgement, chosen by channel and whether the clinic is open. Nothing about treatment. */
export async function acknowledge(sys, enquiry, now) {
  const open = isWithinOpeningHours(now, sys.config.openingHours);
  const channel = enquiry.channel;
  let templateId;
  if (enquiry.source === 'missed-call') templateId = open ? 'ack-missed-call-sms-open' : 'ack-missed-call-sms-closed';
  else templateId = `ack-${channel}-${open ? 'open' : 'closed'}`;
  const to = channel === 'email' ? enquiry.contact.email : enquiry.contact.phone;
  const row = await sendMessage(sys, { enquiryId: enquiry.id, templateId, to, vars: ackVars(sys, enquiry, now), now, purpose: 'acknowledgement' });
  const latencyMs = row.state === 'sent' ? now.getTime() - Date.parse(enquiry.receivedAt) : null;
  enquiry.acknowledgement = { state: row.state, templateId, outboxId: row.id, at: row.sentAt, latencyMs, error: row.error };
  if (row.state === 'sent') enquiry.stage = 'acknowledged';
  sys.store.put('enquiries', enquiry);
  return row;
}

function fitLine(fit) {
  const asks = [];
  if (!fit.forSomeoneElse) asks.push('is this for you or someone else');
  if (!fit.timing) asks.push('do you prefer mornings, afternoons or evenings');
  if (!asks.length) return '';
  if (asks.length === 1) return ` One quick thing so we book the right slot: ${asks[0]}?`;
  return ` Two quick things so we book the right slot: ${asks[0]}, and ${asks[1]}?`;
}

export async function sendBookingLink(sys, enquiry, now) {
  const { config } = sys;
  const fit = enquiry.sort.fit || {};
  const channel = enquiry.channel;
  const vars = {
    firstName: firstName(enquiry.contact.name) || 'there',
    clinicName: config.name,
    responderName: config.responder.name,
    treatmentLine: fit.treatment ? `Thanks for asking about ${fit.treatment}.` : 'Thanks for your enquiry.',
    consultFeeLine: config.fees && config.fees.consultation ? ` (${config.fees.consultation})` : '',
    bookingLink: sys.links.booking(enquiry),
    fitLine: fitLine(fit),
    clinicPhone: config.phone,
  };
  const to = channel === 'email' ? enquiry.contact.email : enquiry.contact.phone;
  const row = await sendMessage(sys, { enquiryId: enquiry.id, templateId: `booking-link-${channel}`, to, vars, now, purpose: 'booking-link' });
  enquiry.bookingLink = { state: row.state, outboxId: row.id, at: row.sentAt };
  if (row.state === 'sent' || row.state === 'failed') enquiry.stage = 'booking-sent';
  sys.store.put('enquiries', enquiry);
  return row;
}

export function createTask(sys, enquiry, { kind, title, now, priority = 'normal' }) {
  const dueAt = addOpenMinutes(now, sys.config.responder.substantiveReplyMinutes || 60, sys.config.openingHours);
  const task = {
    id: sys.ids.next('task'),
    enquiryId: enquiry.id,
    for: sys.config.responder.name,
    kind,
    title,
    priority,
    state: 'open',
    createdAt: now.toISOString(),
    dueAt: dueAt.toISOString(),
    doneAt: null,
    doneBy: null,
    note: null,
  };
  sys.store.put('tasks', task);
  enquiry.tasks = enquiry.tasks || [];
  enquiry.tasks.push(task.id);
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'task created', `${kind} for ${task.for}: ${title} (due ${task.dueAt}); a task is not a message`, now);
  return task;
}

/** Clinical or unclear: a named person at the clinic, every time. */
export async function handover(sys, enquiry, now, { kind, reason }) {
  const label = kind === 'clinical' ? 'Clinical or urgent' : kind === 'unclear' ? 'Unclear' : 'Needs a person';
  const task = createTask(sys, enquiry, {
    kind,
    title: `${label}: ${shortName(enquiry.contact.name)} via ${SOURCE_LABELS[enquiry.source]}`,
    now,
    priority: kind === 'clinical' ? 'high' : 'normal',
  });
  enquiry.stage = 'with-responder';
  enquiry.handledBy = 'people';
  enquiry.owner = { name: sys.config.responder.name, role: sys.config.responder.role, since: now.toISOString() };
  sys.store.put('enquiries', enquiry);
  if (sys.config.responder.email) {
    await sendMessage(sys, {
      enquiryId: enquiry.id,
      templateId: 'responder-handover-email',
      to: sys.config.responder.email,
      kind: 'internal',
      purpose: 'handover',
      now,
      vars: {
        responderFirstName: firstName(sys.config.responder.name),
        reasonLabel: label.toLowerCase(),
        personShort: shortName(enquiry.contact.name),
        sourceLabel: SOURCE_LABELS[enquiry.source],
        receivedAt: formatLondon(new Date(enquiry.receivedAt)),
        boardLink: sys.links.board(enquiry),
        taskId: task.id,
        clinicName: sys.config.name,
      },
    });
  }
  return task;
}

export async function stopEverything(sys, enquiry, now, { reason, source }) {
  suppress(sys, enquiry.personKeys, { reason, source, enquiryId: enquiry.id, now });
  stopSequence(sys, enquiry, reason, now);
  for (const appt of sys.store.find('appointments', (a) => a.enquiryId === enquiry.id && a.state === 'booked')) {
    for (const r of appt.reminders) if (r.state === 'scheduled') r.state = 'skipped';
    sys.store.put('appointments', appt);
  }
  enquiry.stage = 'stopped';
  enquiry.stoppedAt = now.toISOString();
  enquiry.stopReason = reason;
  sys.store.put('enquiries', enquiry);
  createTask(sys, enquiry, { kind: 'stop', title: `${shortName(enquiry.contact.name)} asked us to stop: nothing more goes out; note it in the practice system`, now });
}

async function attachToExisting(sys, existing, ev, now) {
  existing.messages = existing.messages || [];
  const stop = isStop(ev.text);
  const isReplyToTextBack = existing.stage === 'awaiting-reply' && ev.text.trim() && !stop;
  existing.messages.push({ id: sys.ids.next('in'), direction: 'in', at: now.toISOString(), source: ev.source, channel: ev.source === 'missed-call' ? 'phone' : ev.email ? 'email' : 'sms', text: ev.text, subject: ev.subject, externalId: ev.externalId, duplicate: !isReplyToTextBack });
  if (!isReplyToTextBack) existing.duplicates = (existing.duplicates || 0) + 1;
  existing.lastInboundAt = now.toISOString();
  sys.store.put('enquiries', existing);
  sys.event(existing.id, isReplyToTextBack ? 'reply to the text-back' : 'duplicate attached', isReplyToTextBack ? 'the caller said what it is about' : `${SOURCE_LABELS[ev.source]} message from the same person inside ${sys.config.dedupeWindowDays} days: one record, no second acknowledgement`, now);

  if (stop) {
    await stopEverything(sys, existing, now, { reason: 'patient asked us to stop', source: ev.source });
    return { enquiry: existing, outcome: 'stopped' };
  }

  // The first reply to a missed-call text-back IS the enquiry: sort it like one.
  if (existing.stage === 'awaiting-reply' && ev.text.trim()) {
    stopSequence(sys, existing, 'patient replied', now);
    for (const t of sys.store.find('tasks', (x) => x.enquiryId === existing.id && x.state === 'open' && x.kind === 'callback')) {
      t.state = 'superseded';
      t.note = 'the patient replied by text; the reply was handled as the enquiry';
      sys.store.put('tasks', t);
    }
    const sorted = await sortEnquiry(ev.text, { config: sys.config, ai: sys.ai });
    existing.sort = sorted;
    sys.store.put('enquiries', existing);
    sys.event(existing.id, 'sorted', `${sorted.label} by ${sorted.decidedBy}: ${sorted.reason} (the reply to the text-back)`, now);
    if (sorted.label === 'routine' && !existing.suppressed) {
      existing.handledBy = 'template';
      await sendBookingLink(sys, existing, now);
      startSequence(sys, existing, 'beforeBooking', now);
    } else {
      await handover(sys, existing, now, { kind: sorted.label === 'routine' ? 'reply' : sorted.label, reason: sorted.reason });
    }
    return { enquiry: existing, outcome: 'attached' };
  }

  const wasActive = existing.followUp && existing.followUp.state === 'active';
  if (wasActive) stopSequence(sys, existing, 'patient replied', now);

  const clinical = clinicalMatches(ev.text, (sys.config.keywords && sys.config.keywords.extraClinical) || []);
  if (!['paid', 'lost', 'stopped', 'spam'].includes(existing.stage) && ev.text.trim()) {
    const openTask = sys.store.find('tasks', (t) => t.enquiryId === existing.id && t.state === 'open' && ['clinical', 'unclear', 'reply', 'callback'].includes(t.kind))[0];
    if (clinical.length && !(openTask && openTask.kind === 'clinical')) {
      createTask(sys, existing, { kind: 'clinical', title: `Clinical or urgent words in a reply from ${shortName(existing.contact.name)}: ${clinical.slice(0, 3).join(', ')}`, now, priority: 'high' });
    } else if (!openTask) {
      createTask(sys, existing, { kind: 'reply', title: `${shortName(existing.contact.name)} wrote back: answer them`, now });
    }
    if (['acknowledged', 'booking-sent', 'awaiting-reply', 'new'].includes(existing.stage)) existing.stage = 'with-responder';
    existing.handledBy = 'people';
    sys.store.put('enquiries', existing);
  }
  return { enquiry: existing, outcome: 'attached' };
}

/**
 * One inbound event from one of the three sources. Returns { enquiry, outcome } where outcome is
 * 'spam' | 'attached' | 'stopped' | 'new'.
 */
export async function inbound(sys, event) {
  const now = sys.clock.now();
  const ev = normaliseEvent(event);
  const { config } = sys;
  markSourceOk(sys, ev.source, now);

  const email = normaliseEmail(ev.email);
  const phone = normalisePhone(ev.phone);
  const keys = personKeys({ email, phone });

  const spam = spamCheck({ text: ev.text, email: ev.email, phone: ev.phone, honeypot: ev.honeypot, source: ev.source });
  if (spam) {
    const enquiry = {
      id: sys.ids.next('enq'),
      clinic: config.id,
      source: ev.source,
      channel: email ? 'email' : phone ? 'sms' : 'none',
      receivedAt: now.toISOString(),
      contact: { name: ev.name, email, phone },
      personKeys: keys,
      owner: null,
      stage: 'spam',
      sort: { label: 'spam', decidedBy: 'rules', reason: spam.reason, matched: [], fit: {} },
      handledBy: 'rules',
      acknowledgement: { state: 'not-applicable', reason: 'spam is never acknowledged' },
      messages: [{ id: sys.ids.next('in'), direction: 'in', at: now.toISOString(), source: ev.source, text: ev.text, subject: ev.subject, externalId: ev.externalId }],
      tasks: [],
      events: [],
    };
    sys.store.put('enquiries', enquiry);
    sys.event(enquiry.id, 'dropped as spam', spam.reason, now);
    return { enquiry, outcome: 'spam' };
  }

  const existing = findExisting(sys.store.all('enquiries'), keys, now, config.dedupeWindowDays);
  if (existing) return attachToExisting(sys, existing, ev, now);

  const enquiry = {
    id: sys.ids.next('enq'),
    clinic: config.id,
    source: ev.source,
    channel: email ? 'email' : 'sms',
    receivedAt: now.toISOString(),
    contact: { name: ev.name, email, phone },
    personKeys: keys,
    owner: { name: config.responder.name, role: config.responder.role, since: now.toISOString() },
    stage: 'new',
    sort: null,
    handledBy: null,
    acknowledgement: { state: 'none' },
    bookingLink: null,
    followUp: null,
    booking: null,
    outcome: { attended: null, planAccepted: null, invoiced: null, paid: null, lost: null },
    suppressed: isSuppressed(sys, keys),
    duplicates: 0,
    lastInboundAt: now.toISOString(),
    messages: [{ id: sys.ids.next('in'), direction: 'in', at: now.toISOString(), source: ev.source, channel: ev.source === 'missed-call' ? 'phone' : email ? 'email' : 'sms', text: ev.text, subject: ev.subject, externalId: ev.externalId }],
    tasks: [],
    events: [],
  };
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'captured', `${SOURCE_LABELS[ev.source]}; owner ${enquiry.owner.name}`, now);

  // S2: the acknowledgement goes first, before any sorting. It says nothing about treatment.
  await acknowledge(sys, enquiry, now);

  if (ev.source === 'missed-call') {
    enquiry.sort = { label: 'callback', decidedBy: 'rules', reason: 'a missed call has no message; the text-back asks what it is about', matched: [], fit: {} };
    enquiry.handledBy = 'people';
    enquiry.stage = 'awaiting-reply';
    sys.store.put('enquiries', enquiry);
    createTask(sys, enquiry, { kind: 'callback', title: `Call back ${enquiry.contact.phone.replace(/^\+44/, '0')} (missed call)`, now });
    if (!enquiry.suppressed) startSequence(sys, enquiry, 'missedCall', now);
    return { enquiry, outcome: 'new' };
  }

  const sorted = await sortEnquiry(ev.text, { config, ai: sys.ai });
  enquiry.sort = sorted;
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'sorted', `${sorted.label} by ${sorted.decidedBy}: ${sorted.reason}`, now);

  if (sorted.label === 'routine' && !enquiry.suppressed) {
    enquiry.handledBy = 'template';
    await sendBookingLink(sys, enquiry, now);
    startSequence(sys, enquiry, 'beforeBooking', now);
  } else if (sorted.label === 'routine' && enquiry.suppressed) {
    await handover(sys, enquiry, now, { kind: 'reply', reason: 'this person asked us to stop earlier; a person decides' });
  } else {
    await handover(sys, enquiry, now, { kind: sorted.label, reason: sorted.reason });
  }
  return { enquiry, outcome: 'new' };
}
