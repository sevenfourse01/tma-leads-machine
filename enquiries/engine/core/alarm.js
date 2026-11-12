// The one alarm from day one: every enquiry received in the last 24 hours has an acknowledgement and an
// owner, or Zach hears about it on Telegram. The same check reports a source that has gone dark: an inbox
// whose login expired, a form that stopped reaching us. The message carries counts only, never a name,
// an address or a message text (Everest's Telegram rule, kept).

import { nextLocalTime } from './ukTime.js';

export function sourceIds(config) {
  const ids = [];
  const s = config.sources || {};
  if (s.form && s.form.enabled) ids.push('form');
  if (s.inbox && s.inbox.enabled) ids.push('inbox');
  if (s.missedCall && s.missedCall.enabled) ids.push('missed-call');
  return ids;
}

export function sourceLabel(config, id) {
  const s = config.sources || {};
  const key = id === 'missed-call' ? 'missedCall' : id;
  return (s[key] && s[key].label) || id;
}

function healthRow(sys, id) {
  return sys.store.get('health', id) || { id, state: 'unknown', lastOkAt: null, lastError: null, failedSince: null, checkedAt: null };
}

export function markSourceOk(sys, id, now) {
  const row = healthRow(sys, id);
  const recovered = row.state === 'failed';
  row.state = 'ok';
  row.lastOkAt = now.toISOString();
  row.checkedAt = now.toISOString();
  row.lastError = null;
  row.failedSince = null;
  sys.store.put('health', row);
  if (recovered) sys.event(null, 'source recovered', `${sourceLabel(sys.config, id)} is reaching us again`, now);
  return row;
}

/** A source failure. The first failure after an ok state raises the alarm straight away. */
export async function markSourceFailed(sys, id, { code = 'ERROR', message = '' } = {}, now) {
  const row = healthRow(sys, id);
  const wasFailed = row.state === 'failed';
  row.state = 'failed';
  row.checkedAt = now.toISOString();
  row.lastError = { code, message, at: now.toISOString() };
  if (!wasFailed) row.failedSince = now.toISOString();
  sys.store.put('health', row);
  sys.event(null, 'source failed', `${sourceLabel(sys.config, id)}: ${code} ${message}`.trim(), now);
  if (!wasFailed) return runAlarm(sys, now, { trigger: 'source-failure' });
  return null;
}

/** Form health comes from a probe (the website pinging us, or us fetching the form page). */
export async function recordProbe(sys, id, { ok, code = 'PROBE', message = '' } = {}, now) {
  if (ok) return markSourceOk(sys, id, now);
  return markSourceFailed(sys, id, { code, message }, now);
}

export function sourceStates(sys, now) {
  return sourceIds(sys.config).map((id) => {
    const row = healthRow(sys, id);
    const cfgKey = id === 'missed-call' ? 'missedCall' : id;
    const maxHours = (sys.config.sources[cfgKey] && sys.config.sources[cfgKey].heartbeatMaxHours) || null;
    let state = row.state;
    let note = row.lastError ? `${row.lastError.code}${row.lastError.message ? `: ${row.lastError.message}` : ''}` : '';
    if (state !== 'failed' && maxHours && row.lastOkAt && now.getTime() - Date.parse(row.lastOkAt) > maxHours * 3600000) {
      state = 'stale';
      note = `nothing heard for ${Math.round((now.getTime() - Date.parse(row.lastOkAt)) / 3600000)}h`;
    }
    if (state === 'unknown') note = 'never heard from since install';
    return { id, label: sourceLabel(sys.config, id), state, note, since: row.failedSince || row.lastOkAt };
  });
}

/** The check itself: pure, so the board and the tests can show exactly what the alarm saw. */
export function dailyCheck(sys, now) {
  const since = now.getTime() - 24 * 3600000;
  const recent = sys.store.find('enquiries', (e) => Date.parse(e.receivedAt) >= since && e.stage !== 'spam');
  const misses = [];
  for (const e of recent) {
    const reasons = [];
    if (!e.acknowledgement || e.acknowledgement.state !== 'sent') reasons.push('no acknowledgement');
    if (!e.owner || !e.owner.name) reasons.push('no owner');
    if (reasons.length) misses.push({ enquiryId: e.id, source: e.source, reasons });
  }
  const sources = sourceStates(sys, now);
  const broken = sources.filter((s) => s.state === 'failed' || s.state === 'stale');
  const overdue = sys.store.find('tasks', (t) => t.state === 'open' && Date.parse(t.dueAt) < now.getTime());
  const gaveUp = sys.store.find('outbox', (r) => r.state === 'gave-up');
  const noAck = misses.filter((m) => m.reasons.includes('no acknowledgement')).length;
  const noOwner = misses.filter((m) => m.reasons.includes('no owner')).length;
  const ok = !misses.length && !broken.length;
  const lines = [];
  lines.push(`${sys.config.name}: daily check`);
  lines.push(`${recent.length} enquir${recent.length === 1 ? 'y' : 'ies'} in the last 24h; ${noAck} without an acknowledgement; ${noOwner} without an owner.`);
  for (const s of sources) {
    lines.push(`${s.label}: ${s.state === 'ok' ? 'ok' : s.state.toUpperCase()}${s.note ? ` (${s.note})` : ''}`);
  }
  if (overdue.length) lines.push(`${overdue.length} responder task${overdue.length === 1 ? '' : 's'} past the staffed-hour target.`);
  if (gaveUp.length) lines.push(`${gaveUp.length} message${gaveUp.length === 1 ? '' : 's'} gave up after retries.`);
  lines.push(ok ? 'Nothing to repair.' : 'Repair today and tell the clinic before they find it.');
  return { ok, counts: { last24h: recent.length, noAck, noOwner, overdueTasks: overdue.length, gaveUp: gaveUp.length }, misses, sources, broken, text: lines.join('\n') };
}

export async function runAlarm(sys, now, { trigger = 'daily' } = {}) {
  const check = dailyCheck(sys, now);
  const row = {
    id: sys.ids.next('alarm'),
    at: now.toISOString(),
    trigger,
    ok: check.ok,
    counts: check.counts,
    misses: check.misses.map((m) => ({ enquiryId: m.enquiryId, reasons: m.reasons })),
    broken: check.broken.map((b) => ({ id: b.id, state: b.state, note: b.note })),
    to: sys.config.alarm.to,
    channel: sys.config.alarm.channel,
    text: check.text,
    state: 'queued',
    error: null,
  };
  sys.store.put('alarms', row);
  const transport = sys.transports[sys.config.alarm.channel];
  let result;
  try {
    result = transport ? await transport.send({ to: sys.config.alarm.to, body: check.text, meta: { kind: 'alarm', trigger } }) : { ok: false, error: `no ${sys.config.alarm.channel} transport` };
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  row.state = result && result.ok ? 'sent' : 'failed';
  row.error = result && result.ok ? null : (result && result.error) || 'no confirmation';
  sys.store.put('alarms', row);
  const counter = sys.store.get('counters', 'alarm-daily') || { id: 'alarm-daily', lastAt: null };
  if (trigger === 'daily') {
    counter.lastAt = now.toISOString();
    sys.store.put('counters', counter);
  }
  sys.event(null, `alarm ${row.state}`, `${trigger}: ${check.ok ? 'all clear' : `${check.misses.length} miss(es), ${check.broken.length} broken source(s)`}`, now);
  return row;
}

/** The tick calls this: is the daily alarm due? */
export async function runDailyAlarmIfDue(sys, now) {
  const [hour, minute] = String(sys.config.alarm.time || '08:00').split(':').map(Number);
  const counter = sys.store.get('counters', 'alarm-daily');
  const install = sys.store.get('counters', 'install');
  const from = counter && counter.lastAt ? new Date(counter.lastAt) : install ? new Date(install.at) : now;
  const due = nextLocalTime({ hour, minute, from });
  if (due.getTime() <= now.getTime()) return runAlarm(sys, now, { trigger: 'daily' });
  return null;
}
