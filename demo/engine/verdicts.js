/* =========================================================================
   REFUSAL AND DECLINE RULES — engine v2

   A run that declines is a successful run. The engine is allowed to say the
   inputs cannot carry a forecast, and it is allowed to say a system it could
   sell should not be built.

   Two levels:
     refusals()  whole engagement. No forecast is returned at all.
     declines()  one system. It still appears, its gain shows as zero, and the
                 reason travels with it.
   ========================================================================= */

import { BY_ID } from './services.js';
import { runModel, netDelta, val, priceFor, confidenceCounts } from './model.js';

const gbp = n => (n < 0 ? '−£' : '£') + Math.round(Math.abs(n)).toLocaleString('en-GB');
const months = n => (n === Infinity ? 'never' : n.toFixed(1) + ' months');

/* Amortising the build across a twelve-month term is our own convention, not
   the repo's pricing config: the published entry price is a one-off with no
   monthly, and a system that costs nothing to run every month can never fail
   a unit-economics test. Spreading it over the term the forecast covers is
   the fairest comparison available. */
export const AMORTISE_MONTHS = 12;

/* The kinds whose mechanism is winning a customer. Everything else is judged
   on payback, because CAC is meaningless where the customer count does not
   move. */
const ACQUIRES = new Set(['rate', 'close', 'volume', 'referral', 'content', 'engine']);

export function monthlyCommitment(inp, selected) {
  let m = 0;
  selected.forEach(id => {
    m += priceFor(inp, 'runPerSystem', id) + priceFor(inp, 'buildPerSystem', id) / AMORTISE_MONTHS;
  });
  if (selected.some(id => BY_ID[id] && BY_ID[id].kind === 'engine')) m += Math.max(0, val(inp, 'budget'));
  return m;
}

/* What one customer is worth to them in gross profit across the relationship.
   Used by both the unit-economics refusal and the CAC decline. */
export function lifetimeGross(inp) {
  return Math.max(0, val(inp, 'firstValue')) * Math.max(0, val(inp, 'repeat')) *
    Math.max(0, Math.min(1, val(inp, 'margin')));
}

/* ---------- whole-engagement refusals ------------------------------------ */

export function refusals(inp, selected = []) {
  const out = [];
  const enquiries = val(inp, 'enquiries');
  const budget = val(inp, 'budget');
  const spare = val(inp, 'spareCapacity');
  const run = monthlyCommitment(inp, selected);
  const ltGross = lifetimeGross(inp);
  const counts = confidenceCounts(inp);

  if (enquiries < 15 && budget < 500) {
    out.push({
      code: 'no-flow',
      message: 'Not enough flow to model. Here is what we would measure first.',
      value: enquiries,
      detail: enquiries + ' enquiries a month and ' + gbp(budget) + ' of budget. ' +
        'Below about fifteen enquiries a month a rate improvement moves fewer than one customer, ' +
        'and the model would be reporting rounding.'
    });
  }

  if (run > 0 && ltGross < run * 2) {
    out.push({
      code: 'unit-economics',
      message: 'The unit economics cannot carry the fee at any conversion rate.',
      value: ltGross,
      detail: 'One customer is worth ' + gbp(ltGross) + ' in gross profit across the relationship, ' +
        'against ' + gbp(run) + ' a month of commitment. Even a perfect funnel would need ' +
        (run * 2 / Math.max(1, ltGross)).toFixed(1) + ' times the customer value to clear it.'
    });
  }

  if (spare < 2) {
    out.push({
      code: 'capacity',
      message: 'Capacity, not demand, is the constraint. Growth systems would be building a queue you cannot serve.',
      value: spare,
      detail: 'You told us you could take on ' + spare + ' more customer' + (spare === 1 ? '' : 's') +
        ' a month without hiring. Every system below adds customers, and there is nowhere to put them.'
    });
  }

  if (counts.assumedShare > 0.6) {
    out.push({
      code: 'too-assumed',
      message: 'Too much of this is guesswork to be worth quoting. Book the call and we will measure it.',
      value: counts.assumedShare,
      detail: counts.assumed + ' of ' + counts.total + ' inputs (' +
        Math.round(counts.assumedShare * 100) + '%) are our industry defaults rather than your figures. ' +
        'A forecast built mostly on our benchmarks tells you about the benchmarks.'
    });
  }

  return out;
}

/* ---------- per-system declines ------------------------------------------ */

/* Everything a single system's verdict needs, computed against the selection
   it would actually be built alongside. */
export function systemView(inp, selected, id) {
  const s = BY_ID[id];
  const inSel = selected.includes(id);
  const withIt = inSel ? selected : selected.concat(id);
  const without = selected.filter(x => x !== id);

  const mWith = runModel(inp, withIt);
  const mWithout = runModel(inp, without);

  const marginalNet = mWith.delta.net - mWithout.delta.net;
  const marginalCustomers = mWith.delta.customers - mWithout.delta.customers;
  const standaloneNet = netDelta(inp, [id]);

  const build = priceFor(inp, 'buildPerSystem', id);
  const run = priceFor(inp, 'runPerSystem', id);
  const budget = s.kind === 'engine' ? Math.max(0, val(inp, 'budget')) : 0;
  const monthlyCost = run + budget;

  const cac = marginalCustomers > 1e-9
    ? (monthlyCost + build / AMORTISE_MONTHS) / marginalCustomers
    : Infinity;
  const payback = marginalNet > 1e-9 ? build / marginalNet : Infinity;

  const soldWith = mWith.current.sold;
  const clippedShare = soldWith > 0 ? mWith.current.clipped / soldWith : 0;

  /* the same marginal, with the capacity wall taken away. If a system wins
     customers here and none in the real run, the thing stopping it is the
     queue, not its economics — and saying "CAC £Infinity" would blame the
     wrong number. */
  const free = { ...inp, spareCapacity: { value: 1e9, confidence: 'inferred' } };
  const uncappedCustomers =
    runModel(free, withIt).delta.customers - runModel(free, without).delta.customers;
  /* Capacity is the binding constraint when the wall takes at least half of
     what this would otherwise win. A stricter test (all of it) let a system
     that was allowed the last two per cent of the queue get turned down for
     its cost per customer, which named the wrong cause. */
  const capacityBinds = uncappedCustomers > 0.05 && marginalCustomers < 0.5 * uncappedCustomers;
  /* and this one has genuinely nothing left to give: its lever is pulled */
  const saturated = uncappedCustomers <= 0.05 && ACQUIRES.has(s.kind);

  return {
    id, service: s, marginalNet, marginalCustomers, standaloneNet,
    build, run, budget, monthlyCost, cac, payback, clippedShare,
    uncappedCustomers, capacityBinds, saturated,
    affordableCac: lifetimeGross(inp) / 3
  };
}

export function declines(inp, selected, id) {
  const v = systemView(inp, selected, id);
  const out = [];

  if (v.service.kind === 'time') {
    out.push({
      code: 'no-mechanism',
      message: 'No revenue mechanism. The figure shown is hours only.',
      value: v.service.hours,
      detail: v.service.hours + ' admin hours a month, and no transition in your funnel that we can honestly attach revenue to.'
    });
  }

  /* Capacity is tested before economics, and where it binds it is the whole
     answer: a system that would win customers with room to serve them has not
     failed a cost test, it has hit a wall the systems above it built. */
  if (v.capacityBinds) {
    out.push({
      code: 'capacity-binds',
      message: 'Capacity binds. This builds demand you cannot serve.',
      value: v.uncappedCustomers,
      detail: 'With room to serve them this would win ' + v.uncappedCustomers.toFixed(2) +
        ' more customers a month. Against your real capacity it wins ' + v.marginalCustomers.toFixed(2) +
        ', because the systems above it have already filled the space. Nothing is wrong with this ' +
        'system; there is nowhere to put what it would bring.'
    });
  } else if (v.clippedShare > 0.3) {
    out.push({
      code: 'capacity-binds',
      message: 'Capacity binds. This builds demand you cannot serve.',
      value: v.clippedShare,
      detail: Math.round(v.clippedShare * 100) + '% of the customers this plan would win have nowhere to go, ' +
        'so the systems above it already fill your spare capacity.'
    });
  }

  if (v.saturated && !v.capacityBinds) {
    out.push({
      code: 'saturated',
      message: 'Adds nothing once the systems above it are running.',
      value: v.uncappedCustomers,
      detail: 'Even with unlimited capacity this would win ' + v.uncappedCustomers.toFixed(2) +
        ' more customers a month, because something earlier in the list already pulls the same lever. ' +
        'Building it would be paying twice for one improvement.'
    });
  }

  /* CAC only makes sense for systems that acquire customers, and only once
     capacity and saturation have been ruled out. A retention system acquires
     nobody by design, so dividing its fee by zero customers would decline it
     for doing exactly what it is for. Payback tests those. */
  if (ACQUIRES.has(v.service.kind) && !v.capacityBinds && !v.saturated && v.cac > v.affordableCac) {
    out.push({
      code: 'cac',
      message: 'Declined: CAC ' + gbp(v.cac) + ' against an affordable ' + gbp(v.affordableCac) + ' at the target return.',
      value: v.cac,
      arithmetic: {
        cost: v.monthlyCost + v.build / AMORTISE_MONTHS,
        customers: v.marginalCustomers,
        cac: v.cac,
        firstValue: val(inp, 'firstValue'),
        margin: val(inp, 'margin'),
        repeat: val(inp, 'repeat'),
        lifetimeGross: lifetimeGross(inp),
        affordableCac: v.affordableCac
      },
      detail: gbp(v.monthlyCost + v.build / AMORTISE_MONTHS) + ' a month ÷ ' +
        v.marginalCustomers.toFixed(2) + ' extra customers = ' + gbp(v.cac) + ' each. ' +
        'A customer is worth ' + gbp(lifetimeGross(inp)) + ' in gross profit, and at a three-to-one ' +
        'target return you can afford ' + gbp(v.affordableCac) + '.'
    });
  }

  if (v.service.kind !== 'time' && !v.capacityBinds && !v.saturated && v.payback > 9) {
    out.push({
      code: 'payback',
      message: 'Slower than the term. Build it later.',
      value: v.payback,
      detail: gbp(v.build) + ' of build against ' + gbp(v.marginalNet) + ' a month of net gain pays back in ' +
        months(v.payback) + ', past the nine-month line we hold ourselves to.'
    });
  }

  return out;
}

/* True when a system should be shown at zero rather than counted. */
export const isDeclined = list => list.length > 0;
