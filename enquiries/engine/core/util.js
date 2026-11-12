// Small shared helpers: clocks, ids, durations, open-hours arithmetic.

import { isWithinOpeningHours, nextOpenInfo, londonParts, londonWallTimeToUtc } from './ukTime.js';

export function systemClock() {
  return { now: () => new Date(), fake: false };
}

/** A clock the tests and the demo drive by hand. */
export function fakeClock(startIso, { allowBackwards = false } = {}) {
  let t = Date.parse(startIso);
  if (Number.isNaN(t)) throw new Error(`fakeClock needs an ISO start, got ${startIso}`);
  let max = t;
  return {
    fake: true,
    now: () => new Date(t),
    /** The latest instant this clock has shown (the replay rewinds between cases). */
    max: () => new Date(max),
    set(iso) {
      const n = Date.parse(iso);
      if (Number.isNaN(n)) throw new Error(`clock.set needs an ISO time, got ${iso}`);
      if (n < t && !allowBackwards) throw new Error('The clock does not run backwards.');
      t = n;
      if (t > max) max = t;
    },
    advance(ms) {
      if (ms < 0) throw new Error('The clock does not run backwards.');
      t += ms;
      if (t > max) max = t;
    },
    advanceMinutes(m) {
      this.advance(m * 60000);
    },
    advanceHours(h) {
      this.advance(h * 3600000);
    },
  };
}

export function iso(d) {
  return new Date(d).toISOString();
}

export function addMinutes(date, m) {
  return new Date(date.getTime() + m * 60000);
}

/** 'PT25H', 'P3D', 'PT90M', '90m', '2h', '10d', '45s' or a number of minutes. */
export function parseDuration(value) {
  if (typeof value === 'number') return value * 60000;
  const s = String(value).trim();
  const isoMatch = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (isoMatch) {
    const [, d = 0, h = 0, m = 0, sec = 0] = isoMatch;
    return ((Number(d) * 24 + Number(h)) * 60 + Number(m)) * 60000 + Number(sec) * 1000;
  }
  const short = s.match(/^(\d+(?:\.\d+)?)\s*(d|h|m|s)$/i);
  if (short) {
    const n = Number(short[1]);
    const unit = short[2].toLowerCase();
    return n * { d: 86400000, h: 3600000, m: 60000, s: 1000 }[unit];
  }
  throw new Error(`Cannot read duration '${value}'.`);
}

/** The instant when `minutes` of opening hours have passed since `from`. The due time for a staffed reply. */
export function addOpenMinutes(from, minutes, openingHours) {
  let cursor = new Date(from.getTime());
  let left = minutes;
  const [eh, em] = openingHours.end.split(':').map(Number);
  for (let i = 0; i < 100 && left > 0; i++) {
    if (!isWithinOpeningHours(cursor, openingHours)) {
      cursor = nextOpenInfo(cursor, openingHours).instant;
      continue;
    }
    const p = londonParts(cursor);
    const close = londonWallTimeToUtc({ year: p.year, month: p.month, day: p.day, hour: eh, minute: em });
    const untilClose = (close.getTime() - cursor.getTime()) / 60000;
    if (untilClose >= left) return new Date(cursor.getTime() + left * 60000);
    left -= untilClose;
    cursor = new Date(close.getTime());
  }
  return cursor;
}

/** Readable, deterministic ids: enq-0001, appt-0003. Counters persist with the store. */
export class Ids {
  constructor(store) {
    this.store = store;
  }

  next(prefix) {
    const row = this.store.get('counters', prefix) || { id: prefix, n: 0 };
    row.n += 1;
    this.store.put('counters', row);
    return `${prefix}-${String(row.n).padStart(4, '0')}`;
  }
}

export function median(values) {
  const v = values.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 100);
}
