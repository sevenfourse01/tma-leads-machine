// S3 booking: real availability from the clinic's opening hours and calendar, one appointment per slot,
// confirmation and reminders from approved templates, and an attendance record.
// The calendar adapter is the clinic's own diary where it passes inspection; the memory calendar runs
// the tests and the demo. The practice management system is never touched.

import { sendMessage } from './outbound.js';
import { firstName, shortName } from './contact.js';
import { isWithinOpeningHours, londonParts, londonWallTimeToUtc, formatLondon, nextOpenInfo } from './ukTime.js';
import { startSequence, stopSequence } from './followup.js';

export function memoryCalendar(busy = []) {
  const created = [];
  return {
    name: 'memory',
    busy: () => busy.slice(),
    create: (appointment) => {
      created.push(appointment);
      return { ok: true, externalId: `cal-${created.length}` };
    },
    cancel: () => ({ ok: true }),
    created,
  };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Bookable start times from now: inside opening hours, after the lead time, inside the horizon, not taken. */
export function availableSlots(sys, now, { limit = 40 } = {}) {
  const cal = sys.config.calendar;
  const hours = sys.config.openingHours;
  const slotMs = cal.slotMinutes * 60000;
  const lengthMs = cal.consultMinutes * 60000;
  const earliest = now.getTime() + cal.leadTimeHours * 3600000;
  const latest = now.getTime() + cal.horizonDays * 86400000;
  const booked = sys.store.find('appointments', (a) => a.state === 'booked' || a.state === 'attended');
  const busy = (sys.calendar.busy() || []).map((b) => [Date.parse(b.start), Date.parse(b.end)]);
  const [sh, sm] = hours.start.split(':').map(Number);
  const [eh, em] = hours.end.split(':').map(Number);
  const out = [];
  const p = londonParts(now);
  for (let addDays = 0; addDays <= cal.horizonDays + 1 && out.length < limit; addDays++) {
    const cursor = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays, 12));
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    const open = londonWallTimeToUtc({ year: y, month: m, day: d, hour: sh, minute: sm });
    if (!hours.days.includes(londonParts(open).weekday)) continue;
    const close = londonWallTimeToUtc({ year: y, month: m, day: d, hour: eh, minute: em });
    for (let t = open.getTime(); t + lengthMs <= close.getTime() && out.length < limit; t += slotMs) {
      if (t < earliest || t > latest) continue;
      const end = t + lengthMs;
      if (booked.some((a) => overlaps(t, end, Date.parse(a.startsAt), Date.parse(a.endsAt)))) continue;
      if (busy.some(([bs, be]) => overlaps(t, end, bs, be))) continue;
      out.push(new Date(t).toISOString());
    }
  }
  return out;
}

function appointmentVars(sys, enquiry, appt) {
  return {
    firstName: firstName(enquiry.contact.name) || 'there',
    clinicName: sys.config.name,
    responderName: sys.config.responder.name,
    clinicPhone: sys.config.phone,
    clinicAddress: sys.config.address,
    appointmentWhen: formatLondon(new Date(appt.startsAt)),
    manageLink: sys.links.manage(enquiry, appt),
  };
}

/** Book one slot for an enquiry. Refuses a taken slot, a slot outside hours, or a stopped enquiry. */
export async function book(sys, enquiryId, startIso, { by = 'patient' } = {}) {
  const now = sys.clock.now();
  const enquiry = sys.store.get('enquiries', enquiryId);
  if (!enquiry) return { ok: false, refused: 'no such enquiry' };
  if (['stopped', 'spam', 'lost'].includes(enquiry.stage)) return { ok: false, refused: `enquiry is ${enquiry.stage}` };
  const start = Date.parse(startIso);
  if (Number.isNaN(start)) return { ok: false, refused: 'bad start time' };
  const end = start + sys.config.calendar.consultMinutes * 60000;
  if (!isWithinOpeningHours(new Date(start), sys.config.openingHours)) return { ok: false, refused: 'outside opening hours' };
  if (start < now.getTime()) return { ok: false, refused: 'in the past' };
  const clash = sys.store.find('appointments', (a) => (a.state === 'booked' || a.state === 'attended') && overlaps(start, end, Date.parse(a.startsAt), Date.parse(a.endsAt)));
  if (clash.length) return { ok: false, refused: 'slot already taken' };
  const busy = (sys.calendar.busy() || []).some((b) => overlaps(start, end, Date.parse(b.start), Date.parse(b.end)));
  if (busy) return { ok: false, refused: 'diary is busy then' };

  const appt = {
    id: sys.ids.next('appt'),
    enquiryId,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    state: 'booked',
    bookedBy: by,
    bookedAt: now.toISOString(),
    calendarId: null,
    attendance: null,
    reminders: (sys.config.calendar.reminders || []).map((r) => ({
      hoursBefore: r.hoursBefore,
      channel: r.channel,
      dueAt: new Date(start - r.hoursBefore * 3600000).toISOString(),
      state: 'scheduled',
      outboxId: null,
    })),
  };
  // claim the slot before anything else: a second booking for the same time now fails the clash check above
  sys.store.put('appointments', appt);
  const cal = sys.calendar.create(appt);
  appt.calendarId = cal && cal.ok ? cal.externalId : null;
  if (!cal || !cal.ok) {
    appt.calendarNote = `diary write failed: ${(cal && cal.error) || 'no answer'}; the appointment is held here and on the board`;
  }
  sys.store.put('appointments', appt);

  stopSequence(sys, enquiry, 'booked', now);
  enquiry.stage = 'booked';
  enquiry.booking = { appointmentId: appt.id, startsAt: appt.startsAt, bookedAt: appt.bookedAt };
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, 'booked', `${formatLondon(new Date(appt.startsAt))} by ${by}`, now);

  const channel = enquiry.channel;
  const to = channel === 'email' ? enquiry.contact.email : enquiry.contact.phone;
  const row = await sendMessage(sys, { enquiryId, templateId: `booking-confirmation-${channel}`, to, vars: appointmentVars(sys, enquiry, appt), now, purpose: 'booking-confirmation' });
  appt.confirmation = { outboxId: row.id, state: row.state };
  sys.store.put('appointments', appt);
  return { ok: true, appointment: appt };
}

export async function cancel(sys, appointmentId, { by = 'patient', reason = '' } = {}) {
  const now = sys.clock.now();
  const appt = sys.store.get('appointments', appointmentId);
  if (!appt || appt.state !== 'booked') return { ok: false, refused: 'no booked appointment with that id' };
  appt.state = 'cancelled';
  appt.cancelledAt = now.toISOString();
  appt.cancelledBy = by;
  appt.cancelReason = reason;
  for (const r of appt.reminders) if (r.state === 'scheduled') r.state = 'skipped';
  sys.store.put('appointments', appt);
  if (appt.calendarId) sys.calendar.cancel(appt.calendarId);
  const enquiry = sys.store.get('enquiries', appt.enquiryId);
  if (enquiry && enquiry.stage === 'booked') {
    enquiry.stage = 'booking-sent';
    enquiry.booking = null;
    sys.store.put('enquiries', enquiry);
    sys.event(enquiry.id, 'booking cancelled', `${by}${reason ? `: ${reason}` : ''}; back to booking-sent`, now);
    if (!enquiry.suppressed) startSequence(sys, enquiry, 'beforeBooking', now);
  }
  return { ok: true, appointment: appt };
}

export async function move(sys, appointmentId, newStartIso, { by = 'patient' } = {}) {
  const appt = sys.store.get('appointments', appointmentId);
  if (!appt || appt.state !== 'booked') return { ok: false, refused: 'no booked appointment with that id' };
  const cancelled = await cancel(sys, appointmentId, { by, reason: 'moved' });
  if (!cancelled.ok) return cancelled;
  return book(sys, appt.enquiryId, newStartIso, { by });
}

/** After the consultation: attended starts the decision follow-up; a no-show gets one gentle chase. */
export async function recordAttendance(sys, appointmentId, { attended, by }) {
  const now = sys.clock.now();
  const appt = sys.store.get('appointments', appointmentId);
  if (!appt || appt.state !== 'booked') return { ok: false, refused: 'no booked appointment with that id' };
  if (Date.parse(appt.startsAt) > now.getTime()) return { ok: false, refused: 'the appointment has not happened yet' };
  appt.state = attended ? 'attended' : 'no-show';
  appt.attendance = { attended: !!attended, recordedBy: by, recordedAt: now.toISOString() };
  for (const r of appt.reminders) if (r.state === 'scheduled') r.state = 'skipped';
  sys.store.put('appointments', appt);
  const enquiry = sys.store.get('enquiries', appt.enquiryId);
  enquiry.outcome.attended = !!attended;
  enquiry.stage = attended ? 'attended' : 'no-show';
  sys.store.put('enquiries', enquiry);
  sys.event(enquiry.id, attended ? 'attended' : 'no-show', `recorded by ${by}`, now);
  if (!enquiry.suppressed) startSequence(sys, enquiry, attended ? 'afterConsult' : 'noShow', now);
  return { ok: true, appointment: appt };
}

/** The tick calls this: reminders whose time has come, for appointments still booked and still ahead. */
export async function sendDueReminders(sys, now) {
  const sent = [];
  const appts = sys.store.find('appointments', (a) => a.state === 'booked' && a.reminders.some((r) => r.state === 'scheduled' && Date.parse(r.dueAt) <= now.getTime()));
  for (const appt of appts) {
    const enquiry = sys.store.get('enquiries', appt.enquiryId);
    for (const r of appt.reminders) {
      if (r.state !== 'scheduled' || Date.parse(r.dueAt) > now.getTime()) continue;
      if (Date.parse(appt.startsAt) <= now.getTime()) {
        r.state = 'skipped';
        continue;
      }
      const channel = r.channel === 'sms' && enquiry.contact.phone ? 'sms' : enquiry.contact.email ? 'email' : enquiry.contact.phone ? 'sms' : null;
      if (!channel) {
        r.state = 'skipped';
        continue;
      }
      const to = channel === 'email' ? enquiry.contact.email : enquiry.contact.phone;
      const row = await sendMessage(sys, { enquiryId: enquiry.id, templateId: `reminder-${channel}`, to, vars: appointmentVars(sys, enquiry, appt), now, purpose: `reminder:${r.hoursBefore}h` });
      r.state = row.state === 'sent' ? 'sent' : 'failed';
      r.outboxId = row.id;
      sent.push(row);
    }
    sys.store.put('appointments', appt);
  }
  return sent;
}

export function describeSlot(iso) {
  return formatLondon(new Date(iso));
}

export { nextOpenInfo, shortName };
