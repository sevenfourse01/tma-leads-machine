// UK wall-clock helpers, correct across the BST/GMT boundary.
// Reused from the TMA System Library: C:\Users\zachs\tma-systems\core\src\ukTime.js (Phase 0, audited
// 31 July 2026), ported from CommonJS to ESM so the same file runs in Node and in the browser demo.
//
// All maths uses Intl with an explicit 'Europe/London' zone, so results do not depend on the machine's
// timezone. "9am UK" in January is 09:00 UTC; in July it is 08:00 UTC. Code that schedules "9am" goes
// through these helpers, never Date.UTC(..., 9, 0) directly.

const TZ = 'Europe/London';

const dtf = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

/** London wall-clock parts for a UTC instant. weekday is 'Mon'..'Sun'. */
export function londonParts(date) {
  const parts = {};
  for (const { type, value } of dtf.formatToParts(date)) parts[type] = value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

/** Offset of London wall time from UTC at a given instant, in ms (0 in GMT, 3600000 in BST). */
export function londonOffsetMs(date) {
  const p = londonParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - wholeSeconds;
}

/** The UTC instant of a London wall-clock time. */
export function londonWallTimeToUtc({ year, month, day, hour, minute = 0 } = {}) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(guess - londonOffsetMs(new Date(guess)));
  candidate = new Date(guess - londonOffsetMs(candidate)); // second pass for boundary days
  return candidate;
}

/** The next UTC instant strictly after `from` whose London wall time is hour:minute on an allowed weekday. */
export function nextLocalTime({ hour, minute = 0, from, allowedDays } = {}) {
  if (!Number.isInteger(hour)) throw new Error('nextLocalTime needs an integer hour.');
  if (!(from instanceof Date)) throw new Error('nextLocalTime needs a `from` Date.');
  const p = londonParts(from);
  for (let addDays = 0; addDays <= 8; addDays++) {
    const cursor = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays, 12)); // noon avoids DST edges
    const instant = londonWallTimeToUtc({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
      hour,
      minute,
    });
    if (instant.getTime() <= from.getTime()) continue;
    if (allowedDays && !allowedDays.includes(londonParts(instant).weekday)) continue;
    return instant;
  }
  throw new Error('No allowed day found within 8 days. Check allowedDays.');
}

/** Is this instant inside the clinic's opening hours ({days, start, end})? */
export function isWithinOpeningHours(date, { days, start, end } = {}) {
  if (!days || !start || !end) throw new Error('isWithinOpeningHours needs openingHours {days, start, end}.');
  const p = londonParts(date);
  if (!days.includes(p.weekday)) return false;
  const mins = p.hour * 60 + p.minute;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return mins >= sh * 60 + sm && mins < eh * 60 + em;
}

const WEEKDAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

/**
 * When is the clinic next open? Returns { open, instant, text } where text reads naturally inside a
 * message: 'today' while open, otherwise e.g. 'Monday from 8:30am'.
 */
export function nextOpenInfo(now, openingHours) {
  if (isWithinOpeningHours(now, openingHours)) return { open: true, instant: now, text: 'today' };
  const [hour, minute] = openingHours.start.split(':').map(Number);
  const instant = nextLocalTime({ hour, minute, from: now, allowedDays: openingHours.days });
  const p = londonParts(instant);
  const sameDay = londonParts(now).day === p.day && londonParts(now).month === p.month;
  const h12 = ((p.hour + 11) % 12) + 1;
  const ampm = p.hour < 12 ? 'am' : 'pm';
  const clock = `${h12}:${String(p.minute).padStart(2, '0')}${ampm}`;
  return { open: false, instant, text: sameDay ? `today from ${clock}` : `${WEEKDAY_NAMES[p.weekday]} from ${clock}` };
}

/**
 * Minutes of opening hours between two instants: the "staffed minutes" the battle plan measures
 * substantive replies in. Walks minute by minute only across the open stretch of each day, so a
 * 22:15 enquiry answered at 09:05 the next morning counts as 35 staffed minutes.
 */
export function openMinutesBetween(from, to, openingHours) {
  if (!(from instanceof Date) || !(to instanceof Date)) throw new Error('openMinutesBetween needs two Dates.');
  if (to <= from) return 0;
  const [sh, sm] = openingHours.start.split(':').map(Number);
  const [eh, em] = openingHours.end.split(':').map(Number);
  let total = 0;
  const p = londonParts(from);
  for (let addDays = 0; addDays < 400; addDays++) {
    const cursor = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays, 12));
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    const open = londonWallTimeToUtc({ year: y, month: m, day: d, hour: sh, minute: sm });
    const close = londonWallTimeToUtc({ year: y, month: m, day: d, hour: eh, minute: em });
    if (open > to) break;
    if (openingHours.days.includes(londonParts(open).weekday)) {
      const a = Math.max(open.getTime(), from.getTime());
      const b = Math.min(close.getTime(), to.getTime());
      if (b > a) total += (b - a) / 60000;
    }
  }
  return Math.round(total);
}

/** 'Tue 18 Nov, 10:20am' in London time, for messages. */
export function formatLondon(date, { withDay = true } = {}) {
  const p = londonParts(date);
  const h12 = ((p.hour + 11) % 12) + 1;
  const ampm = p.hour < 12 ? 'am' : 'pm';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = withDay ? `${p.weekday} ${p.day} ${months[p.month - 1]}, ` : '';
  return `${day}${h12}:${String(p.minute).padStart(2, '0')}${ampm}`;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
