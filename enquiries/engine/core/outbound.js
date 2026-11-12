// The one door out. Every message to a patient or to the responder goes through sendMessage, which:
//   renders an approved template (free text cannot reach here),
//   refuses a patient message to a suppressed contact,
//   writes the outbox row as 'queued' BEFORE calling the transport (Everest's pattern, landing/functions/_lib/alerts.js),
//   records 'sent' only when the transport confirmed, otherwise 'failed' with the error,
//   retries failed rows on the tick with a backoff, up to a cap, then 'gave-up' (an exception on the board).
// "Task created" is a different collection from "message sent". They are never the same row.

import { personKeys } from './contact.js';

export const BACKOFF_MINUTES = [1, 2, 5, 10, 30];
export const MAX_ATTEMPTS = 6;

export function isSuppressed(sys, keys) {
  return keys.some((k) => sys.store.get('suppression', k));
}

export function suppress(sys, keys, { reason, source, enquiryId, now }) {
  for (const k of keys) {
    sys.store.put('suppression', { id: k, reason, source, enquiryId, at: now.toISOString() });
  }
  sys.event(enquiryId, 'suppressed', `${keys.length} contact key(s): ${reason}`, now);
}

function transportFor(sys, channel) {
  const t = sys.transports && sys.transports[channel];
  if (!t || typeof t.send !== 'function') throw new Error(`No transport for channel '${channel}'.`);
  return t;
}

/**
 * Send one approved message. Returns the outbox row. Never throws for a transport failure; throws for a
 * programming error (unknown template, missing variable, lint failure) because those must stop a test run.
 */
export async function sendMessage(sys, { enquiryId, templateId, to, vars, now, kind = 'auto', purpose = null }) {
  const rendered = sys.messages.render(templateId, vars);
  const enquiry = enquiryId ? sys.store.get('enquiries', enquiryId) : null;
  const row = {
    id: sys.ids.next('msg'),
    enquiryId: enquiryId || null,
    templateId,
    purpose: purpose || templateId,
    channel: rendered.channel,
    audience: rendered.audience,
    kind,
    to,
    subject: rendered.subject,
    body: rendered.body,
    state: 'queued',
    attempts: 0,
    createdAt: now.toISOString(),
    sentAt: null,
    nextAttemptAt: null,
    providerId: null,
    transport: null,
    error: null,
  };

  if (rendered.audience === 'patient') {
    const keys = personKeys(rendered.channel === 'email' ? { email: to } : { phone: to });
    if (isSuppressed(sys, keys)) {
      row.state = 'blocked';
      row.error = 'contact suppressed';
      sys.store.put('outbox', row);
      sys.event(enquiryId, 'message blocked', `${templateId}: contact suppressed`, now);
      if (enquiry) attach(sys, enquiry, row);
      return row;
    }
  }

  sys.store.put('outbox', row);
  await attempt(sys, row, now);
  if (enquiry) attach(sys, enquiry, row);
  return row;
}

function attach(sys, enquiry, row) {
  enquiry.messages = enquiry.messages || [];
  const existing = enquiry.messages.findIndex((m) => m.id === row.id);
  const summary = { id: row.id, direction: 'out', at: row.createdAt, channel: row.channel, templateId: row.templateId, audience: row.audience, to: row.to, state: row.state, sentAt: row.sentAt };
  if (existing >= 0) enquiry.messages[existing] = summary;
  else enquiry.messages.push(summary);
  sys.store.put('enquiries', enquiry);
}

async function attempt(sys, row, now) {
  row.attempts += 1;
  let result;
  try {
    const transport = transportFor(sys, row.channel);
    row.transport = transport.name || 'unnamed';
    result = await transport.send({ to: row.to, subject: row.subject, body: row.body, meta: { enquiryId: row.enquiryId, templateId: row.templateId, messageId: row.id } });
  } catch (err) {
    result = { ok: false, error: err && err.message ? err.message : String(err) };
  }
  if (result && result.ok) {
    row.state = 'sent';
    row.sentAt = now.toISOString();
    row.providerId = result.providerId || null;
    row.error = null;
    row.nextAttemptAt = null;
    sys.event(row.enquiryId, 'message sent', `${row.templateId} by ${row.channel} (${row.transport})`, now);
  } else {
    row.error = (result && result.error) || 'transport returned no confirmation';
    if (row.attempts >= MAX_ATTEMPTS) {
      row.state = 'gave-up';
      row.nextAttemptAt = null;
      sys.event(row.enquiryId, 'message gave up', `${row.templateId}: ${row.error} after ${row.attempts} attempts`, now);
    } else {
      row.state = 'failed';
      const wait = BACKOFF_MINUTES[Math.min(row.attempts - 1, BACKOFF_MINUTES.length - 1)];
      row.nextAttemptAt = new Date(now.getTime() + wait * 60000).toISOString();
      sys.event(row.enquiryId, 'message failed', `${row.templateId}: ${row.error}; retry at ${row.nextAttemptAt}`, now);
    }
  }
  sys.store.put('outbox', row);
  return row;
}

/** The tick calls this: every failed row whose retry time has come. */
export async function retryFailed(sys, now) {
  const due = sys.store.find('outbox', (r) => r.state === 'failed' && r.nextAttemptAt && Date.parse(r.nextAttemptAt) <= now.getTime());
  const results = [];
  for (const row of due) {
    const keys = row.audience === 'patient' ? personKeys(row.channel === 'email' ? { email: row.to } : { phone: row.to }) : [];
    if (keys.length && isSuppressed(sys, keys)) {
      row.state = 'blocked';
      row.error = 'contact suppressed before retry';
      sys.store.put('outbox', row);
      continue;
    }
    await attempt(sys, row, now);
    const enquiry = row.enquiryId ? sys.store.get('enquiries', row.enquiryId) : null;
    if (enquiry) attach(sys, enquiry, row);
    results.push(row);
  }
  return results;
}
