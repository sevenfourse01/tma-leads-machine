/* =========================================================================
   TWELVE-MONTH FORECAST — engine v2

   Four jobs:
     1. choose what to build, greedily, by MARGINAL gain against everything
        already chosen. Ranking by standalone is the most common way this
        class of tool misleads people: three systems that each "add £4k" and
        all pull the same lever add £4k between them, not £12k.
     2. sequence it: two concurrent builds, respecting build days.
     3. ramp each system from its live date to steady state.
     4. band the year by running the Monte Carlo month by month, with the
        spread WIDENING as the horizon lengthens.

   On (4): the interval grows by 6% of the base spread per month, so month
   twelve is about 70% wider than month one. This is not pessimism. It is the
   truth about forecast horizons, and a band that stays the same width across
   twelve months is the clearest sign of a model that has not thought about
   time at all.
   ========================================================================= */

import { SERVICES, BY_ID, requirementsMet } from './services.js';
import { runModel, netDelta, val, priceFor, mediators } from './model.js';
import { simulate, band, N_RUNS } from './simulate.js';
import { declines, systemView, AMORTISE_MONTHS } from './verdicts.js';
import { CHANNELS } from './services.js';

export const HORIZON = 12;
export const MAX_CONCURRENT_BUILDS = 2;
export const WORKING_DAYS_PER_MONTH = 21;
/* Build days are our effort. Every entry in the library also needs something
   from the client before it can go live — mailbox access, a signed-off set of
   wordings, a fortnight of watching what it gets wrong — so each slot carries
   a fixed client-side lead time on top. Our number, not a measured one. */
export const LEAD_TIME_DAYS = 5;
export const HORIZON_WIDENING = 0.06;   /* of the base spread, per month */
export const MAX_SYSTEMS = 8;
/* two gains inside this band of each other are a tie, not a ranking */
export const TIE_BAND = 0.10;
const CONF_RANK = { measured: 0, inferred: 1, assumed: 2 };

/* ---------- what to build ------------------------------------------------ */

/* Greedy on marginal gain. At each step every remaining candidate is re-scored
   against what has already been chosen, so a service whose lever another
   system has already pulled falls down the list by itself rather than being
   suppressed by a hand-written rule. */
export function recommend(inp, opts = {}) {
  const cap = opts.max || MAX_SYSTEMS;
  const eligible = SERVICES.filter(s => requirementsMet(s, inp)).map(s => s.id);
  const unavailable = SERVICES.filter(s => !requirementsMet(s, inp))
    .map(s => ({ id: s.id, reason: 'requires', needs: s.requires.slice() }));

  const selected = [];
  let pool = eligible.slice();

  while (selected.length < cap && pool.length) {
    const here = netDelta(inp, selected);
    const gains = pool.map(id => ({ id, gain: netDelta(inp, selected.concat(id)) - here }));
    const top = gains.reduce((a, b) => (b.gain > a.gain ? b : a), gains[0]);

    /* Near-ties are broken on evidence and speed, not on the third decimal
       place of a number we guessed. Several of these capture rates are our
       starting assumptions, and letting an `assumed` figure edge out an
       `inferred` one by four percent would be reading precision into a guess.
       Inside the tie band, the better-evidenced and faster build wins. */
    const contenders = gains.filter(g => g.gain > 0 && g.gain >= top.gain * (1 - TIE_BAND));
    contenders.sort((a, b) =>
      (CONF_RANK[BY_ID[a.id].confidence] - CONF_RANK[BY_ID[b.id].confidence]) ||
      (BY_ID[a.id].buildDays - BY_ID[b.id].buildDays) ||
      (b.gain - a.gain) ||
      (a.id < b.id ? -1 : 1));
    const pick = contenders.length ? contenders[0] : top;
    const best = pick.id, bestGain = pick.gain;
    if (best === undefined) break;
    pool = pool.filter(id => id !== best);

    if (bestGain <= 0 || declines(inp, selected, best).length) continue;
    selected.push(best);
  }

  /* Reasons are worked out AFTER the selection settles, against the plan that
     actually got chosen. Deciding them mid-loop made what a visitor reads
     depend on the order candidates happened to be tested in: the same system
     could be turned down for its cost per customer early on and for capacity
     later, which are different sentences about the same business. */
  const declined = eligible.filter(id => !selected.includes(id)).map(id => {
    const why = declines(inp, selected, id);
    return {
      id,
      reasons: why.length ? why : [{
        code: 'no-gain',
        message: 'Adds nothing once the systems above it are running.',
        value: netDelta(inp, selected.concat(id)) - netDelta(inp, selected),
        detail: 'Its lever is already pulled by something earlier in the list, so building it ' +
          'would be paying twice for one improvement.'
      }]
    };
  });

  return { selected, declined, unavailable };
}

/* ---------- sequencing --------------------------------------------------- */

/* Two crews. Each takes the next system in marginal order the moment it is
   free, so the order the user sees is the order the work actually happens in
   rather than a fixed month-one / month-three template. */
export function schedule(selected, order) {
  const crews = new Array(MAX_CONCURRENT_BUILDS).fill(0);
  const out = [];
  order.forEach(id => {
    const s = BY_ID[id];
    let k = 0;
    for (let i = 1; i < crews.length; i++) if (crews[i] < crews[k]) k = i;
    const startDay = crews[k];
    const finishDay = startDay + Math.max(1, s.buildDays) + LEAD_TIME_DAYS;
    crews[k] = finishDay;
    out.push({
      id, startDay, finishDay,
      liveMonth: Math.floor(finishDay / WORKING_DAYS_PER_MONTH) + 1,
      buildDays: s.buildDays, rampMonths: Math.max(1, s.rampMonths)
    });
  });
  return out;
}

/* Contribution weight for one system in one month: nothing before it is live,
   then a straight line to steady state over its ramp. */
export function weightsForMonth(plan, month) {
  const w = {};
  plan.forEach(p => {
    if (month < p.liveMonth) { w[p.id] = 0; return; }
    w[p.id] = Math.min(1, (month - p.liveMonth + 1) / p.rampMonths);
  });
  return w;
}

/* ---------- the year ----------------------------------------------------- */

export function twelveMonths(inp, selected, plan, opts = {}) {
  const baseSpread = Number.isFinite(opts.spread) ? opts.spread : val(inp, 'spread') || 0.35;
  const n = opts.n || Math.round(N_RUNS / 2);   /* per month; the total run uses the full 2,000 */
  const months = [];

  for (let m = 1; m <= HORIZON; m++) {
    const weights = weightsForMonth(plan, m);
    const spread = baseSpread * (1 + HORIZON_WIDENING * (m - 1));
    const sim = simulate(inp, selected, { n, spread, weights, seed: opts.seed, floor: opts.floor });
    const live = plan.filter(p => p.liveMonth <= m).map(p => p.id);
    months.push({
      month: m, live, weights, spread,
      p10: sim.total.p10, p50: sim.total.p50, p90: sim.total.p90,
      pPositive: sim.total.pPositive,
      width: sim.total.p90 - sim.total.p10,
      lowConfidence: m >= 7
    });
  }

  const sumOf = k => months.reduce((t, r) => t + r[k], 0);
  return {
    months,
    cumulative: { p10: sumOf('p10'), p50: sumOf('p50'), p90: sumOf('p90') },
    widening: months[HORIZON - 1].width / Math.max(1e-9, months[0].width)
  };
}

/* ---------- where it leaks ----------------------------------------------
   Section 01 shows RECOVERABLE revenue, not total leak. Total leak is not
   addressable and quoting it is the dishonest version of this number: it
   counts enquiries no system could ever have saved. Each line is the revenue
   delta of the systems that act on that one transition, and nothing else. */
export function leakLines(inp) {
  const lines = [];
  const label = { phone: 'Unanswered phone', form: 'Slow form response', email: 'Unchased email' };
  CHANNELS.forEach(ch => {
    const ids = SERVICES.filter(s => s.kind === 'rate' && s.channel === ch && requirementsMet(s, inp)).map(s => s.id);
    if (!ids.length) return;
    const m = runModel(inp, ids);
    lines.push({
      key: 'leak:' + ch, channel: ch, label: label[ch], ids,
      before: m.current.rates[ch].before,
      after: m.current.rates[ch].after,
      share: m.current.mix[ch],
      revenue: m.delta.revenue,
      customers: m.delta.customers
    });
  });

  const followIds = SERVICES.filter(s => s.kind === 'close' && requirementsMet(s, inp)).map(s => s.id);
  if (followIds.length) {
    const m = runModel(inp, followIds);
    lines.push({
      key: 'leak:follow', channel: 'close', label: 'No follow-up', ids: followIds,
      before: m.baseline.close, after: m.current.close, share: 1,
      revenue: m.delta.revenue, customers: m.delta.customers
    });
  }
  return lines;
}

/* ---------- the whole run ------------------------------------------------ */

/* One call from the page. Everything the report needs, or a refusal. */
export function forecast(inp, opts = {}) {
  const rec = opts.selected
    ? { selected: opts.selected, declined: [], unavailable: [] }
    : recommend(inp, opts);
  const selected = rec.selected;

  /* rank by marginal against the FINAL selection, not by pick order */
  const full = netDelta(inp, selected);
  const marginalOf = {};
  selected.forEach(id => { marginalOf[id] = full - netDelta(inp, selected.filter(x => x !== id)); });
  const ranked = selected.slice().sort((a, b) => marginalOf[b] - marginalOf[a]);

  const plan = schedule(selected, ranked);
  const leaks = leakLines(inp);

  /* pPositive asks whether the ENGAGEMENT paid, so the one-off build has to be
     on the cost side of the question. net already carries the monthly fee. */
  const amortisedBuild = selected.reduce(
    (t, id) => t + priceFor(inp, 'buildPerSystem', id) / AMORTISE_MONTHS, 0);

  const sim = simulate(inp, selected, {
    n: opts.n || N_RUNS,
    floor: amortisedBuild,
    perService: SERVICES.filter(s => requirementsMet(s, inp)).map(s => s.id),
    sets: leaks.map(l => ({ key: l.key, selected: l.ids, metric: 'revenue' }))
  });

  const year = twelveMonths(inp, selected, plan, {
    seed: sim.seed, n: opts.monthlyN, floor: amortisedBuild
  });

  const central = runModel(inp, selected);
  const views = {};
  SERVICES.forEach(s => {
    if (!requirementsMet(s, inp)) return;
    views[s.id] = systemView(inp, selected, s.id);
  });

  return {
    selected, ranked, marginalOf, plan, leaks, sim, year, central, views,
    declined: rec.declined, unavailable: rec.unavailable,
    mediators: mediators(inp, selected),
    monthly: sim.total,
    seed: sim.seed
  };
}

export { band };
