// S5 outcome. Honest states: a booking is not a paying patient, a treatment plan accepted is not a
// paying patient, an invoice raised is not a paying patient. Only a payment marked with evidence is.

import { stopSequence } from './followup.js';

export const LOST_REASONS = ['price', 'timing', 'went elsewhere', 'no reply', 'not suitable', 'other'];

function need(enquiry, allowed, action) {
  if (!enquiry) return 'no such enquiry';
  if (!allowed.includes(enquiry.stage)) return `cannot mark ${action} from stage '${enquiry.stage}'`;
  return null;
}

export function markPlanAccepted(sys, enquiryId, { by, planRef = '', valueGBP = null } = {}) {
  const now = sys.clock.now();
  const enquiry = sys.store.get('enquiries', enquiryId);
  const problem = need(enquiry, ['attended', 'booked', 'with-responder'], 'plan accepted');
  if (problem) return { ok: false, refused: problem };
  if (!by) return { ok: false, refused: 'who recorded it (by) is required' };
  enquiry.outcome.planAccepted = { at: now.toISOString(), by, planRef, valueGBP };
  enquiry.stage = 'plan-accepted';
  stopSequence(sys, enquiry, 'treatment plan accepted', now);
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'plan accepted', `${planRef || 'no reference'} recorded by ${by}; not yet a paying patient`, now);
  return { ok: true };
}

export function markInvoiced(sys, enquiryId, { by, invoiceRef = '', amountGBP = null } = {}) {
  const now = sys.clock.now();
  const enquiry = sys.store.get('enquiries', enquiryId);
  const problem = need(enquiry, ['attended', 'plan-accepted', 'booked', 'with-responder'], 'invoiced');
  if (problem) return { ok: false, refused: problem };
  if (!by) return { ok: false, refused: 'who recorded it (by) is required' };
  enquiry.outcome.invoiced = { at: now.toISOString(), by, invoiceRef, amountGBP };
  enquiry.stage = 'invoiced';
  stopSequence(sys, enquiry, 'invoiced', now);
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'invoiced', `${invoiceRef || 'no reference'} for ${amountGBP == null ? 'an unstated amount' : `£${amountGBP}`}; an unpaid invoice is not a paying patient`, now);
  return { ok: true };
}

/**
 * The only way an enquiry becomes a paying patient. Refuses without an amount, a reference, who marked it
 * and a line of evidence naming where the payment is recorded.
 */
export function markPaid(sys, enquiryId, { by, amountGBP, reference, method = '', evidence, paidAt } = {}) {
  const now = sys.clock.now();
  const enquiry = sys.store.get('enquiries', enquiryId);
  const problem = need(enquiry, ['booked', 'attended', 'plan-accepted', 'invoiced', 'with-responder'], 'paid');
  if (problem) return { ok: false, refused: problem };
  const missing = [];
  if (!by) missing.push('by (who marked it)');
  if (!(Number(amountGBP) > 0)) missing.push('amountGBP (a positive amount)');
  if (!reference || !String(reference).trim()) missing.push('reference (receipt or invoice number)');
  if (!evidence || !String(evidence).trim()) missing.push('evidence (where the payment is recorded)');
  if (missing.length) {
    sys.event(enquiry.id, 'payment refused', `not counted: missing ${missing.join(', ')}`, now);
    return { ok: false, refused: `payment not counted without ${missing.join(', ')}` };
  }
  const at = paidAt ? new Date(paidAt) : now;
  if (Number.isNaN(at.getTime()) || at.getTime() > now.getTime()) return { ok: false, refused: 'paidAt must be a real time, not in the future' };
  enquiry.outcome.paid = { at: at.toISOString(), markedAt: now.toISOString(), by, amountGBP: Number(amountGBP), reference: String(reference).trim(), method, evidence: String(evidence).trim() };
  enquiry.stage = 'paid';
  stopSequence(sys, enquiry, 'paid', now);
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'paid', `£${Number(amountGBP)} ref ${reference}; evidence: ${evidence}; marked by ${by}`, now);
  return { ok: true };
}

export function markLost(sys, enquiryId, { by, reason, note = '' } = {}) {
  const now = sys.clock.now();
  const enquiry = sys.store.get('enquiries', enquiryId);
  if (!enquiry) return { ok: false, refused: 'no such enquiry' };
  if (['paid', 'spam'].includes(enquiry.stage)) return { ok: false, refused: `cannot mark lost from stage '${enquiry.stage}'` };
  if (!LOST_REASONS.includes(reason)) return { ok: false, refused: `reason must be one of: ${LOST_REASONS.join(', ')}` };
  if (!by) return { ok: false, refused: 'who recorded it (by) is required' };
  enquiry.outcome.lost = { at: now.toISOString(), by, reason, note };
  enquiry.stage = 'lost';
  stopSequence(sys, enquiry, `lost: ${reason}`, now);
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'lost', `${reason}${note ? `: ${note}` : ''} (by ${by})`, now);
  return { ok: true };
}

export function completeTask(sys, taskId, { by, note = '' } = {}) {
  const now = sys.clock.now();
  const task = sys.store.get('tasks', taskId);
  if (!task) return { ok: false, refused: 'no such task' };
  if (task.state !== 'open') return { ok: false, refused: `task is ${task.state}` };
  if (!by) return { ok: false, refused: 'who did it (by) is required' };
  task.state = 'done';
  task.doneAt = now.toISOString();
  task.doneBy = by;
  task.note = note;
  sys.store.put('tasks', task);
  sys.event(task.enquiryId, 'task done', `${task.kind} by ${by}${note ? `: ${note}` : ''}`, now);
  return { ok: true, task };
}
