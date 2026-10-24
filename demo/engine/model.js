/* =========================================================================
   THE CAUSAL MODEL — engine v2

   Pure functions. No DOM, no randomness, no clock. Every number this file
   produces is a deterministic function of (inputs, selection, options), which
   is what makes the same answers give the same forecast twice.

   The shape of the thing:

     enquiries split by channel
       → each channel's rate improved by HEADROOM CAPTURE, never by a
         multiplier: new = old + capture × (ceiling − old). A rate is then
         physically incapable of passing its ceiling, and the gain shrinks by
         itself as the business gets good, which is the behaviour the
         benchmark-multiplier approach gets wrong.
       → engaged enquiries
       → close rate, itself improved by headroom capture, hard-capped
       → customers from inbound, from outbound, from referral, from content
       → capacity clips the TOTAL, last, proportionally
       → value, margin, hours saved, run cost
       → net

   The engine's answer is net(selected) − net([]) computed by this same
   function with an empty selection. Never net(selected) on its own.
   ========================================================================= */

import {
  BY_ID, ratesOn, requirementsMet, isSubsumed,
  CLOSE_SERVICES, VOLUME_SERVICES, VALUE_SERVICES,
  REFERRAL_SERVICES, CONTENT_SERVICES, ENGINE_SERVICES
} from './services.js';
import { OUTBOUND_FACTOR, CLOSE_CAP } from './presets.js';

export const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const nz = x => (Number.isFinite(x) ? x : 0);

/* Inputs arrive as { key: { value, confidence } }. Nothing else reads .value
   so a bare number is tolerated too, which keeps the tests readable. */
export function val(inp, key, dflt = 0) {
  const f = inp[key];
  if (f === undefined || f === null) return dflt;
  const v = typeof f === 'object' ? f.value : f;
  return Number.isFinite(v) ? v : (typeof v === 'boolean' ? v : dflt);
}

/* Commercial figures come in from the page, which reads them off the repo's
   pricing config. The engine never carries a price of its own. A field may be
   one number for every system, or a lookup keyed by service id with a
   `default`, because the full machine is not billed like an entry build. */
export function priceFor(inp, key, id) {
  const f = inp[key];
  const raw = f && typeof f === 'object' && 'value' in f ? f.value : f;
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'object') {
    const v = id in raw ? raw[id] : raw.default;
    return Math.max(0, Number.isFinite(v) ? v : 0);
  }
  return Math.max(0, Number.isFinite(raw) ? raw : 0);
}

export function confidenceOf(inp, key) {
  const f = inp[key];
  return f && typeof f === 'object' && f.confidence ? f.confidence : 'assumed';
}

/* ---------- which services are actually running -------------------------- */

/* A selected service runs unless its requirements are unmet or something else
   in the selection subsumes it. Both cases are reported, never silent. */
export function resolveSelection(inp, selected) {
  const active = [], blocked = [];
  selected.forEach(id => {
    const s = BY_ID[id];
    if (!s) return;
    if (!requirementsMet(s, inp)) {
      blocked.push({ id, reason: 'requires', needs: s.requires.slice() });
      return;
    }
    if (isSubsumed(s, selected)) {
      blocked.push({ id, reason: 'subsumed', by: s.subsumedBy.filter(x => selected.includes(x)) });
      return;
    }
    active.push(id);
  });
  return { active, blocked };
}

/* ---------- draws and ramps ---------------------------------------------
   `draws` is what the Monte Carlo hands in; `weights` is what the twelve-month
   ramp hands in. Both default to "the central case, at steady state". */
function captureOf(s, opts) {
  const drawn = opts.draws && opts.draws.capture && opts.draws.capture[s.id];
  const base = Number.isFinite(drawn) ? drawn : s.capture;
  const quality = opts.draws && Number.isFinite(opts.draws.quality) ? opts.draws.quality : 1;
  return clamp01(base * quality) * weightOf(s.id, opts);
}

function weightOf(id, opts) {
  const w = opts.weights && opts.weights[id];
  return Number.isFinite(w) ? clamp01(w) : 1;
}

function volumeOf(s, inp, opts) {
  const raw = typeof s.volume === 'function' ? s.volume(inp) : s.volume;
  return Math.max(0, nz(raw)) * weightOf(s.id, opts);
}

/* ---------- the funnel, before capacity ---------------------------------- */

function funnel(inp, activeIds, opts) {
  const on = new Set(activeIds);
  const enquiries = Math.max(0, val(inp, 'enquiries'));

  const mixPhone = clamp01(val(inp, 'mixPhone'));
  const mixForm = clamp01(val(inp, 'mixForm'));
  const mixEmail = clamp01(1 - mixPhone - mixForm);

  /* rule 1: same channel competes, applied sequentially so the second service
     captures a share of what the first left behind.
     rule 2: different channels do not compete, so they are computed apart. */
  const rateFor = (channel, baseKey) => {
    const before = clamp01(val(inp, baseKey));
    let r = before;
    ratesOn(channel).forEach(s => {
      if (!on.has(s.id)) return;
      r = r + captureOf(s, opts) * Math.max(0, s.ceiling - r);
    });
    return { before, after: Math.min(r, 1) };
  };

  const phone = rateFor('phone', 'answerPhone');
  const form = rateFor('form', 'respForm');
  const email = rateFor('email', 'respEmail');

  const engaged = enquiries * (mixPhone * phone.after + mixForm * form.after + mixEmail * email.after);

  /* close: headroom capture again, each ceiling measured off the STARTING
     close rate so stacking services never compounds a multiplier. */
  const drawnClose = opts.draws && Number.isFinite(opts.draws.close) ? opts.draws.close : val(inp, 'closeRate');
  const closeBefore = clamp01(drawnClose);
  let close = closeBefore;
  CLOSE_SERVICES.forEach(s => {
    if (!on.has(s.id)) return;
    const ceiling = Math.min(closeBefore * s.ceilingMult, s.ceilingCap);
    close = close + captureOf(s, opts) * Math.max(0, ceiling - close);
  });
  close = Math.min(close, CLOSE_CAP);

  /* rule 4: volume sources are additive and inherit the COMPOSED close rate.
     Improving close lifts every source at once. */
  const budget = Math.max(0, val(inp, 'budget'));
  const cpl = Math.max(1e-6, val(inp, 'costPerLead'));
  let outLeads = 0;
  VOLUME_SERVICES.forEach(s => { if (on.has(s.id)) outLeads += volumeOf(s, inp, opts); });
  ENGINE_SERVICES.forEach(s => { if (on.has(s.id)) outLeads += (budget / cpl) * weightOf(s.id, opts); });

  const inbound = engaged * close;
  /* rule 5: a sourced lead does not convert like someone who rang you */
  const outbound = outLeads * close * OUTBOUND_FACTOR;

  let referral = 0;
  REFERRAL_SERVICES.forEach(s => {
    if (!on.has(s.id)) return;
    const refClose = Math.min(close * s.referralCloseMult, CLOSE_CAP);
    referral += (inbound + outbound) * s.referralRate * refClose * weightOf(s.id, opts);
  });

  let content = 0;
  CONTENT_SERVICES.forEach(s => {
    if (!on.has(s.id)) return;
    content += enquiries * s.inboundLift * s.horizonDiscount * close * weightOf(s.id, opts);
  });

  /* rule 7: value effects multiply, they never add customers */
  let repeat = Math.max(0, val(inp, 'repeat'));
  VALUE_SERVICES.forEach(s => {
    if (!on.has(s.id)) return;
    repeat = repeat + captureOf(s, opts) * Math.max(0, s.repeatCeiling - repeat);
  });

  let hours = 0, runCost = 0, buildCost = 0;
  activeIds.forEach(id => {
    const s = BY_ID[id];
    hours += Math.max(0, nz(s.hours)) * weightOf(id, opts);
    runCost += priceFor(inp, 'runPerSystem', id);
    buildCost += priceFor(inp, 'buildPerSystem', id);
  });
  /* the outreach budget is a cost only when something is spending it. The
     brief's runCost charges it unconditionally, which cancels in the delta
     and hands the machine its sourced leads for free; charged here instead,
     so the CAC decline in verdicts.js has a real number to test. */
  const spendsBudget = ENGINE_SERVICES.some(s => on.has(s.id));
  if (spendsBudget) runCost += budget;

  const sources = { inbound, outbound, referral, content };
  const sold = inbound + outbound + referral + content;

  return {
    enquiries, mix: { phone: mixPhone, form: mixForm, email: mixEmail },
    rates: { phone, form, email },
    engaged, close, closeBefore, outLeads, sources, sold,
    repeat, hours, runCost, buildCost, budget: spendsBudget ? budget : 0
  };
}

/* ---------- capacity, value, net ----------------------------------------- */

/* rule 6: capacity applies LAST, to the total, and clips proportionally
   across sources. A hard wall, never a multiplier on the way in. */
function settle(inp, f, capacity, opts) {
  const served = Math.min(f.sold, capacity);
  const clipped = Math.max(0, f.sold - served);
  const k = f.sold > 0 ? served / f.sold : 1;
  const servedBy = {
    inbound: f.sources.inbound * k,
    outbound: f.sources.outbound * k,
    referral: f.sources.referral * k,
    content: f.sources.content * k
  };

  const drawnValue = opts && opts.draws && Number.isFinite(opts.draws.firstValue)
    ? opts.draws.firstValue : val(inp, 'firstValue');
  const value = Math.max(0, drawnValue) * f.repeat;
  const revenue = served * value;
  const gross = revenue * clamp01(val(inp, 'margin'));
  const timeSaved = f.hours * Math.max(0, val(inp, 'hourlyCost'));
  const net = gross + timeSaved - f.runCost;

  return { ...f, capacity, served, clipped, servedBy, value, revenue, gross, timeSaved, net };
}

/* ---------- the public call ---------------------------------------------- */

/* Baseline and selection are computed by the SAME function, sharing one
   capacity ceiling, so the delta is a difference and not two models. */
export function runModel(inp, selected = [], opts = {}) {
  const { active, blocked } = resolveSelection(inp, selected);
  const baseF = funnel(inp, [], opts);
  const curF = funnel(inp, active, opts);

  /* spareCapacity is EXTRA customers a month on top of what they already
     serve, so the wall sits at today's throughput plus that. Clipping the
     total against the spare figure alone would model a business that cannot
     serve its own existing customers. */
  const capacity = baseF.sold + Math.max(0, val(inp, 'spareCapacity'));

  const baseline = settle(inp, baseF, capacity, opts);
  const current = settle(inp, curF, capacity, opts);

  return {
    baseline, current, capacity, active, blocked,
    delta: {
      net: current.net - baseline.net,
      gross: current.gross - baseline.gross,
      revenue: current.revenue - baseline.revenue,
      customers: current.served - baseline.served,
      timeSaved: current.timeSaved - baseline.timeSaved,
      runCost: current.runCost - baseline.runCost,
      buildCost: current.buildCost - baseline.buildCost,
      hours: current.hours - baseline.hours,
      clipped: current.clipped - baseline.clipped
    }
  };
}

export function netDelta(inp, selected = [], opts = {}) {
  return runModel(inp, selected, opts).delta.net;
}

/* Same difference, read off a different line of the P&L. `revenue` is what
   section 01 shows as recoverable; `net` is what the engine forecasts. */
export function deltaOf(inp, selected = [], opts = {}, metric = 'net') {
  const d = runModel(inp, selected, opts).delta;
  return Number.isFinite(d[metric]) ? d[metric] : 0;
}

/* Two numbers per service. Ranking by standalone is the most common way this
   class of tool misleads people, so the roadmap ranks by marginal. */
export function standalone(inp, id, opts = {}) {
  return netDelta(inp, [id], opts);
}

export function marginal(inp, selected, id, opts = {}) {
  if (!selected.includes(id)) return netDelta(inp, selected.concat(id), opts) - netDelta(inp, selected, opts);
  return netDelta(inp, selected, opts) - netDelta(inp, selected.filter(x => x !== id), opts);
}

/* ---------- provenance ---------------------------------------------------- */

/* Only inputs a person could in principle have measured are counted. Derived
   fields (mixEmail) and our own commercial figures are excluded, because
   counting our prices as the client's guesswork would inflate the share and
   trip the refusal on the wrong evidence. */
export const COUNTED_INPUTS = [
  'enquiries', 'mixPhone', 'mixForm', 'answerPhone', 'respForm', 'respEmail',
  'closeRate', 'quoteBased', 'firstValue', 'margin', 'repeat', 'spareCapacity',
  'budget', 'costPerLead'
];

export function confidenceCounts(inp) {
  const out = { measured: 0, inferred: 0, assumed: 0, total: 0 };
  COUNTED_INPUTS.forEach(k => {
    if (!(k in inp)) return;
    const c = confidenceOf(inp, k);
    if (out[c] === undefined) out[c] = 0;
    out[c] += 1;
    out.total += 1;
  });
  out.assumedShare = out.total ? out.assumed / out.total : 0;
  return out;
}

/* The mediator block: the links in the chain a deployment can refute. If the
   answer rate does not move, the model failed somewhere we can name. */
export function mediators(inp, selected, opts = {}) {
  const m = runModel(inp, selected, opts);
  const pack = r => ({
    from: round4(r.before),
    to: round4(r.after),
    refutedBelow: round4(r.before + 0.5 * (r.after - r.before))
  });
  return {
    phoneAnswerRate: pack(m.current.rates.phone),
    formResponseRate: pack(m.current.rates.form),
    emailResponseRate: pack(m.current.rates.email),
    closeRate: {
      from: round4(m.baseline.close),
      to: round4(m.current.close),
      refutedBelow: round4(m.baseline.close + 0.5 * (m.current.close - m.baseline.close))
    },
    customersPerMonth: {
      from: round4(m.baseline.served),
      to: round4(m.current.served),
      refutedBelow: round4(m.baseline.served + 0.5 * (m.current.served - m.baseline.served))
    }
  };
}

const round4 = x => Math.round(x * 10000) / 10000;
