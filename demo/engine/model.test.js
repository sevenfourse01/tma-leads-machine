/* =========================================================================
   ENGINE TESTS — run with `node --test` from demo/engine

   The twelve acceptance criteria from the brief, plus the composition rules
   each get their own assertion. Where the implementation deviates from the
   brief the test states why, because a test that quietly encodes a deviation
   is worse than no test.
   ========================================================================= */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SERVICES, BY_ID } from './services.js';
import {
  runModel, netDelta, standalone, marginal, confidenceCounts, mediators
} from './model.js';
import { simulate, seedFor, band } from './simulate.js';
import { forecast, recommend, schedule, twelveMonths, weightsForMonth, HORIZON } from './forecast.js';
import { refusals, declines, systemView } from './verdicts.js';
import { record, sha256 } from './log.js';

/* ---------- a business the engine can model ------------------------------ */

const m = (value, confidence = 'measured') => ({ value, confidence });

function inputs(over = {}) {
  const base = {
    enquiries: m(60),
    mixPhone: m(0.45, 'inferred'),
    mixForm: m(0.35, 'inferred'),
    answerPhone: m(0.72, 'inferred'),
    respForm: m(0.45, 'inferred'),
    respEmail: m(0.80, 'inferred'),
    closeRate: m(0.25),
    quoteBased: m(true),
    firstValue: m(1400),
    margin: m(0.6, 'assumed'),
    repeat: m(2.0, 'assumed'),
    spareCapacity: m(12),
    budget: m(2000),
    costPerLead: m(55, 'assumed'),
    hourlyCost: m(22, 'assumed'),
    spread: m(0.35, 'assumed'),
    buildPerSystem: m({ default: 1000, machine: 10000 }, 'assumed'),
    runPerSystem: m({ default: 0, machine: 2500 }, 'assumed')
  };
  return Object.assign(base, over);
}

/* ---------- 1 · empty selection is exactly zero -------------------------- */

test('1 · an empty selection returns exactly zero delta', () => {
  const r = runModel(inputs(), []);
  assert.equal(r.delta.net, 0);
  assert.equal(r.delta.revenue, 0);
  assert.equal(r.delta.customers, 0);
  assert.equal(r.delta.timeSaved, 0);
});

/* ---------- 2 · ceilings hold ------------------------------------------- */

test('2 · no rate exceeds its ceiling under any capture or combination', () => {
  const channels = { phone: 'answerPhone', form: 'respForm', email: 'respEmail' };
  Object.entries(channels).forEach(([ch, key]) => {
    const ids = SERVICES.filter(s => s.kind === 'rate' && s.channel === ch).map(s => s.id);
    const maxCeiling = Math.max(...ids.map(id => BY_ID[id].ceiling));
    /* every subset, every starting rate, and capture forced to its extreme */
    for (let mask = 0; mask < (1 << ids.length); mask++) {
      const sel = ids.filter((_, i) => mask & (1 << i));
      [0, 0.1, 0.5, 0.9, 0.99, 1].forEach(start => {
        [0, 0.5, 1, 5].forEach(quality => {
          const inp = inputs({ [key]: m(start) });
          const r = runModel(inp, sel, { draws: { quality } });
          const after = r.current.rates[ch].after;
          assert.ok(after <= Math.max(maxCeiling, start) + 1e-12,
            `${ch} ${sel.join('+')} start=${start} q=${quality} → ${after}`);
          assert.ok(after >= start - 1e-12, 'a capture may never move a rate backwards');
        });
      });
    }
  });
});

test('2b · the close rate never passes its hard cap', () => {
  const closes = SERVICES.filter(s => s.kind === 'close').map(s => s.id);
  [0.05, 0.4, 0.8, 0.94].forEach(start => {
    const r = runModel(inputs({ closeRate: m(start) }), closes, { draws: { quality: 5 } });
    assert.ok(r.current.close <= 0.95 + 1e-12, `close ${r.current.close} from ${start}`);
  });
});

/* ---------- 3 · same channel competes ------------------------------------ */

test('3 · two services on one channel gain strictly less than the sum of their standalones', () => {
  const inp = inputs({ spareCapacity: m(500) });   /* capacity must not be the binding constraint */
  const a = 'speedlead', b = 'webchat';
  const sa = standalone(inp, a), sb = standalone(inp, b);
  const both = netDelta(inp, [a, b]);
  assert.ok(sa > 0 && sb > 0, 'both must pay on their own for the test to mean anything');
  assert.ok(both < sa + sb - 1e-9, `${both} should be under ${sa + sb}`);
  assert.ok(both > Math.max(sa, sb), 'the second one still adds something');
});

/* ---------- 4 · different channels do not compete ------------------------ */

test('4 · two services on different channels gain exactly the sum of their standalones', () => {
  const inp = inputs({ spareCapacity: m(500) });
  const a = 'missedcall', b = 'inbox';     /* phone and email */
  const sa = standalone(inp, a), sb = standalone(inp, b);
  const both = netDelta(inp, [a, b]);
  assert.ok(Math.abs(both - (sa + sb)) < 1e-9, `${both} vs ${sa + sb}`);
});

/* ---------- 5 · capacity is a wall --------------------------------------- */

test('5 · zero spare capacity drives the revenue delta to zero, time savings persist', () => {
  const inp = inputs({ spareCapacity: m(0) });
  const growth = ['missedcall', 'speedlead', 'signals'];
  const r = runModel(inp, growth);
  assert.ok(Math.abs(r.delta.revenue) < 1e-9, `revenue delta ${r.delta.revenue}`);
  assert.ok(Math.abs(r.delta.customers) < 1e-9);
  assert.ok(r.delta.timeSaved > 0, 'the hours are still saved');
});

test('5b · value services are the documented exception: they pay at zero spare capacity', () => {
  /* DEVIATION from acceptance criterion 5, stated rather than hidden. A
     retention system raises what the customers you ALREADY serve are worth.
     Forcing that to zero when there is no spare capacity would be modelling a
     business that cannot be paid twice by the same customer. */
  const inp = inputs({ spareCapacity: m(0) });
  const r = runModel(inp, ['onboard']);
  assert.ok(r.delta.customers < 1e-9, 'it adds no customers');
  assert.ok(r.delta.revenue > 0, 'it does raise what each is worth');
});

/* ---------- 6 · subsumption ---------------------------------------------- */

test('6 · selecting the machine drives signals below 1% of its standalone value', () => {
  const inp = inputs({ spareCapacity: m(500) });
  const alone = standalone(inp, 'signals');
  assert.ok(alone > 0, 'signals must pay on its own for the test to mean anything');
  const withMachine = marginal(inp, ['machine', 'signals'], 'signals');
  assert.ok(Math.abs(withMachine) < 0.01 * alone, `${withMachine} vs 1% of ${alone}`);
});

test('6b · subsumption is reported, never silent', () => {
  const r = runModel(inputs(), ['machine', 'signals']);
  const note = r.blocked.find(b => b.id === 'signals');
  assert.ok(note, 'signals must appear in blocked');
  assert.equal(note.reason, 'subsumed');
  assert.deepEqual(note.by, ['machine']);
});

/* ---------- 7 · requirements --------------------------------------------- */

test('7 · quote returns zero when the business does not issue quotes', () => {
  const yes = inputs({ quoteBased: m(true), spareCapacity: m(500) });
  const no = inputs({ quoteBased: m(false), spareCapacity: m(500) });
  assert.ok(standalone(yes, 'quote') > 0);
  assert.equal(standalone(no, 'quote'), 0);
  const blocked = runModel(no, ['quote']).blocked;
  assert.equal(blocked[0].reason, 'requires');
});

/* ---------- 8 · determinism ---------------------------------------------- */

test('8 · identical inputs produce byte-identical output across runs', () => {
  const a = forecast(inputs(), { n: 400, monthlyN: 200 });
  const b = forecast(inputs(), { n: 400, monthlyN: 200 });
  assert.equal(a.seed, b.seed);
  assert.equal(JSON.stringify(a.monthly), JSON.stringify(b.monthly));
  assert.equal(JSON.stringify(a.year.months.map(x => [x.p10, x.p50, x.p90])),
    JSON.stringify(b.year.months.map(x => [x.p10, x.p50, x.p90])));
  assert.deepEqual(a.selected, b.selected);
});

test('8b · the seed comes from the answers, not from a constant', () => {
  assert.notEqual(seedFor(inputs()), seedFor(inputs({ enquiries: m(61) })));
  assert.equal(seedFor(inputs()), seedFor(inputs()));
});

/* ---------- 9 · a real distribution -------------------------------------- */

test('9 · p10 < p50 < p90 for every non-degenerate input set', () => {
  const cases = [
    inputs(),
    inputs({ enquiries: m(200), spareCapacity: m(60) }),
    inputs({ closeRate: m(0.05), firstValue: m(300) }),
    inputs({ budget: m(0), spareCapacity: m(4) }),
    inputs({ enquiries: m(25), margin: m(0.3), repeat: m(1.1) })
  ];
  cases.forEach((inp, i) => {
    const f = forecast(inp, { n: 500, monthlyN: 200 });
    if (!f.selected.length) return;              /* nothing selected is a valid answer */
    const t = f.monthly;
    assert.ok(t.p10 < t.p50, `case ${i}: p10 ${t.p10} !< p50 ${t.p50}`);
    assert.ok(t.p50 < t.p90, `case ${i}: p50 ${t.p50} !< p90 ${t.p90}`);
    assert.ok(t.pPositive >= 0 && t.pPositive <= 1);
  });
});

/* ---------- 10 · the band widens with the horizon ------------------------ */

test('10 · the month-12 interval is at least 50% wider than month 1', () => {
  const inp = inputs({ spareCapacity: m(60) });
  const rec = recommend(inp);
  const plan = schedule(rec.selected, rec.selected);
  const year = twelveMonths(inp, rec.selected, plan, { n: 1500 });
  assert.ok(year.months[HORIZON - 1].width > year.months[0].width * 1.5,
    `m12 ${year.months[HORIZON - 1].width} vs m1 ${year.months[0].width}`);

  /* and again with the ramp held flat, so the widening is demonstrably the
     horizon rather than systems still coming live.

     This one lands near 1.45×, not 1.7×, and the reason is worth stating: the
     brief specifies BOTH `s × (1 + 0.06(month − 1))` and `k = 40/s` for the
     Beta concentration. A Beta's standard deviation goes as √(1/k), so the
     rate components of the band widen as √s — about 1.29× by month twelve —
     while the log-normal value and quality terms widen as s. The two figures
     the brief gives cannot both hold. We kept the mechanism it specifies and
     report the width it actually produces rather than tuning the constant
     until the prose came true. */
  const flat = plan.map(p => ({ ...p, liveMonth: 1, rampMonths: 1 }));
  const level = twelveMonths(inp, rec.selected, flat, { n: 3000 });
  const ratio = level.months[HORIZON - 1].width / level.months[0].width;
  assert.ok(ratio > 1.4, `horizon-only widening was ${ratio.toFixed(2)}×`);
  assert.ok(ratio < 1.8, 'and it must not run away either');
});

test('10b · every month past six is labelled lower confidence', () => {
  const inp = inputs();
  const rec = recommend(inp);
  const year = twelveMonths(inp, rec.selected, schedule(rec.selected, rec.selected), { n: 200 });
  assert.deepEqual(year.months.filter(x => x.lowConfidence).map(x => x.month), [7, 8, 9, 10, 11, 12]);
});

/* ---------- 11 · the registry is honest ---------------------------------- */

test('11 · every service in the registry has a non-empty catch', () => {
  SERVICES.forEach(s => {
    assert.equal(typeof s.catch, 'string', s.id);
    assert.ok(s.catch.trim().length > 20, `${s.id} needs a real catch, not a placeholder`);
    assert.ok(s.why && s.why.trim().length > 10, `${s.id} needs a why`);
    assert.ok(['measured', 'inferred', 'assumed'].includes(s.confidence), s.id);
    assert.ok(Number.isFinite(s.hours) && s.hours >= 0, s.id);
    assert.ok(Number.isFinite(s.buildDays) && s.buildDays > 0, s.id);
  });
});

test('11b · the registry covers all 22 library systems, each mapped once', () => {
  assert.equal(SERVICES.length, 22);
  const codes = SERVICES.map(s => s.buildCode);
  assert.equal(new Set(codes).size, 22, 'no two services may claim the same library entry');
  assert.equal(new Set(SERVICES.map(s => s.id)).size, 22);
});

test('11c · time-kind services carry no revenue mechanism at all', () => {
  const inp = inputs({ spareCapacity: m(500) });
  SERVICES.filter(s => s.kind === 'time').forEach(s => {
    const r = runModel(inp, [s.id]);
    assert.equal(r.delta.revenue, 0, s.id);
    assert.equal(r.delta.customers, 0, s.id);
    assert.ok(r.delta.timeSaved > 0, s.id);
  });
});

/* ---------- 12 · refusal ------------------------------------------------- */

test('12 · five enquiries and no budget triggers refusal, not a forecast', () => {
  const inp = inputs({ enquiries: m(5), budget: m(0) });
  const r = refusals(inp, recommend(inp).selected);
  assert.ok(r.some(x => x.code === 'no-flow'), JSON.stringify(r.map(x => x.code)));
  assert.ok(r[0].message.length > 10);
  assert.ok(Number.isFinite(r.find(x => x.code === 'no-flow').value));
});

test('12b · each refusal rule fires on its own trigger', () => {
  const capacity = refusals(inputs({ spareCapacity: m(1) }), ['missedcall']);
  assert.ok(capacity.some(x => x.code === 'capacity'));

  const thin = inputs({ firstValue: m(40), repeat: m(1), margin: m(0.2) });
  assert.ok(refusals(thin, ['machine']).some(x => x.code === 'unit-economics'));

  const guessy = {};
  Object.keys(inputs()).forEach(k => { guessy[k] = { ...inputs()[k], confidence: 'assumed' }; });
  assert.ok(refusals(guessy, ['missedcall']).some(x => x.code === 'too-assumed'));

  assert.equal(refusals(inputs(), ['missedcall']).length, 0, 'a healthy business is not refused');
});

/* ---------- composition rules -------------------------------------------- */

test('rule 4 · volume sources inherit the composed close rate', () => {
  const inp = inputs({ spareCapacity: m(500) });
  const volumeOnly = netDelta(inp, ['signals']);
  const closeOnly = netDelta(inp, ['nurture']);
  const both = netDelta(inp, ['signals', 'nurture']);
  assert.ok(both > volumeOnly + closeOnly,
    'improving close must lift the sourced leads too, so the pair beats the sum');
});

test('rule 5 · a sourced lead does not convert like someone who rang you', () => {
  const inp = inputs({ spareCapacity: m(500), budget: m(0) });
  const s = BY_ID.signals;
  const r = runModel(inp, ['signals']);
  const naive = s.volume * r.current.close;
  assert.ok(r.current.sources.outbound < naive * 0.5,
    `outbound ${r.current.sources.outbound} should sit near 0.38 of ${naive}`);
});

test('rule 6 · capacity clips the total proportionally across sources', () => {
  const inp = inputs({ spareCapacity: m(1) });
  const r = runModel(inp, ['missedcall', 'speedlead', 'signals', 'referral']);
  assert.ok(r.current.clipped > 0, 'this selection must overrun the wall');
  const k = r.current.served / r.current.sold;
  ['inbound', 'outbound', 'referral', 'content'].forEach(src => {
    assert.ok(Math.abs(r.current.servedBy[src] - r.current.sources[src] * k) < 1e-9, src);
  });
});

test('rule 7 · value effects multiply, they never add customers', () => {
  const inp = inputs({ spareCapacity: m(500) });
  const r = runModel(inp, ['onboard', 'winback']);
  assert.ok(Math.abs(r.delta.customers) < 1e-9);
  assert.ok(r.current.repeat > r.baseline.repeat);
  assert.ok(r.current.repeat <= 3.0 + 1e-12, 'headroom capture caps the repeat multiple');
});

test('marginal and standalone are different numbers, and the roadmap ranks by marginal', () => {
  const inp = inputs({ spareCapacity: m(500) });
  const f = forecast(inp, { n: 300, monthlyN: 100 });
  const marg = f.ranked.map(id => f.marginalOf[id]);
  for (let i = 1; i < marg.length; i++) assert.ok(marg[i - 1] >= marg[i] - 1e-9, 'ranked descending by marginal');
  const differs = f.selected.some(id => Math.abs(standalone(inp, id) - f.marginalOf[id]) > 1);
  assert.ok(differs, 'if the two agreed everywhere the distinction would be decorative');
});

/* ---------- declines ------------------------------------------------------ */

test('the CAC decline renders the arithmetic beside it', () => {
  /* a budget far too large for the customer value it can buy */
  const inp = inputs({ budget: m(40000), firstValue: m(200), repeat: m(1), margin: m(0.3), spareCapacity: m(500) });
  const d = declines(inp, [], 'machine');
  const cac = d.find(x => x.code === 'cac');
  assert.ok(cac, JSON.stringify(d.map(x => x.code)));
  assert.ok(cac.arithmetic.cost > 0);
  assert.ok(cac.arithmetic.customers > 0);
  assert.ok(Math.abs(cac.arithmetic.cost / cac.arithmetic.customers - cac.arithmetic.cac) < 1e-6);
  assert.ok(cac.arithmetic.cac > cac.arithmetic.affordableCac);
});

test('a full queue is declined as capacity, not as cost per customer', () => {
  /* the misattribution this guards against: with the queue full every system
     wins ~0 customers, so CAC divides by nothing and reads £Infinity — a true
     number naming the wrong cause. */
  const inp = inputs({ spareCapacity: m(1) });
  const rec = recommend(inp);
  const codes = id => declines(inp, rec.selected, id).map(x => x.code);
  const bound = rec.declined.filter(d => d.reasons.some(r => r.code === 'capacity-binds'));
  assert.ok(bound.length >= 3, 'a one-customer queue must bind on several systems');
  bound.forEach(d => {
    assert.ok(!codes(d.id).includes('cac'), `${d.id} should not also be blamed on CAC`);
    const v = systemView(inp, rec.selected, d.id);
    assert.ok(v.uncappedCustomers > v.marginalCustomers,
      `${d.id} must win more with room to serve them`);
  });
});

test('a lever already pulled is declined as saturation, not as cost', () => {
  const inp = inputs({ spareCapacity: m(500) });
  /* speedlead takes most of the form headroom; intake is left with scraps */
  const v = systemView(inp, ['speedlead', 'webchat'], 'intake');
  const codes = declines(inp, ['speedlead', 'webchat'], 'intake').map(x => x.code);
  assert.ok(v.uncappedCustomers < 0.5, 'the headroom should be nearly gone');
  if (codes.length) assert.ok(!codes.includes('capacity-binds'), 'capacity is not the constraint here');
});

test('near-ties are broken on evidence, not on the third decimal place', () => {
  const inp = inputs({ spareCapacity: m(4) });
  const rec = recommend(inp);
  const first = BY_ID[rec.selected[0]];
  /* signals beats speedlead on raw marginal by a few per cent, on the strength
     of a volume figure we invented. speedlead is better evidenced and faster,
     so inside the tie band it goes first. */
  assert.ok(standalone(inp, 'signals') > 0 && standalone(inp, 'speedlead') > 0);
  assert.ok(first.confidence !== 'assumed' || rec.selected.length === 0,
    `an assumed-confidence system (${first.id}) should not lead a near-tie`);
});

test('decline reasons do not depend on the order candidates were tested', () => {
  const inp = inputs({ spareCapacity: m(3) });
  const rec = recommend(inp);
  rec.declined.forEach(d => {
    const fresh = declines(inp, rec.selected, d.id).map(x => x.code);
    const shown = d.reasons.map(x => x.code);
    if (fresh.length) assert.deepEqual(shown, fresh, `${d.id} reported ${shown} but is ${fresh}`);
  });
});

test('time-kind systems decline with a reason rather than being hidden', () => {
  const d = declines(inputs(), [], 'dashboard');
  assert.ok(d.some(x => x.code === 'no-mechanism'));
  const f = forecast(inputs(), { n: 200, monthlyN: 100 });
  assert.ok(f.declined.some(x => x.id === 'dashboard'), 'it still appears in the report');
});

/* ---------- sequencing ---------------------------------------------------- */

test('never more than two builds run at once, and each ramps from its live date', () => {
  const order = ['missedcall', 'speedlead', 'inbox', 'quote', 'nurture'];
  const plan = schedule(order, order);
  order.forEach((id, i) => assert.equal(plan[i].id, id));
  /* with two crews, the third build cannot start before one of the first two ends */
  assert.ok(plan[2].startDay >= Math.min(plan[0].finishDay, plan[1].finishDay) - 1e-9);
  const w1 = weightsForMonth(plan, 1);
  const w12 = weightsForMonth(plan, 12);
  order.forEach(id => {
    assert.ok(w12[id] === 1, `${id} should be at steady state by month 12`);
    assert.ok(w1[id] >= 0 && w1[id] <= 1);
  });
});

test('content ramps over nine months, everything else over one to three', () => {
  SERVICES.forEach(s => {
    if (s.id === 'content') assert.equal(s.rampMonths, 9);
    else assert.ok(s.rampMonths >= 1 && s.rampMonths <= 3, `${s.id} ramps in ${s.rampMonths}`);
  });
});

/* ---------- provenance and the log ---------------------------------------- */

test('confidence counts drive the guesswork refusal', () => {
  const c = confidenceCounts(inputs());
  assert.equal(c.total, 14);
  assert.ok(c.assumedShare >= 0 && c.assumedShare <= 1);
  assert.equal(c.measured + c.inferred + c.assumed, c.total);
});

test('the log record is a pure function of the answers', () => {
  const inp = inputs();
  const out = { p10: 1, p50: 2, p90: 3, pPositive: 0.7 };
  const a = record(inp, ['missedcall'], out, { ts: '2026-01-01T00:00:00.000Z' });
  const b = record(inp, ['missedcall'], out, { ts: '2026-06-01T00:00:00.000Z' });
  assert.equal(a.id, b.id, 'the id must not move with the clock');
  assert.equal(a.id.length, 12);
  const c = record(inputs({ enquiries: m(61) }), ['missedcall'], out, { ts: a.ts });
  assert.notEqual(a.id, c.id);
  assert.equal(a.engineVersion, '2.0.0');
});

test('sha256 matches the known vectors', () => {
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256('a'.repeat(1000)).length, 64);
});

test('the mediator block names the links a deployment can refute', () => {
  const med = mediators(inputs(), ['missedcall', 'speedlead']);
  assert.ok(med.phoneAnswerRate.to > med.phoneAnswerRate.from);
  assert.ok(med.phoneAnswerRate.refutedBelow > med.phoneAnswerRate.from);
  assert.ok(med.phoneAnswerRate.refutedBelow < med.phoneAnswerRate.to);
  assert.ok(med.formResponseRate.to > med.formResponseRate.from);
});

/* ---------- the engine's own headline ------------------------------------- */

test('the engine forecasts the delta, never the level', () => {
  const inp = inputs();
  const r = runModel(inp, ['missedcall']);
  assert.ok(r.current.revenue > r.delta.revenue, 'the level is much larger than the delta');
  assert.ok(r.baseline.revenue > 0, 'a do-nothing baseline exists and is not zero');
  assert.equal(r.delta.net, r.current.net - r.baseline.net);
});

test('pPositive is a real share of simulated firms', () => {
  const f = forecast(inputs(), { n: 800, monthlyN: 200 });
  const positive = Array.from(f.sim.draws).filter(v => v > 0).length / f.sim.draws.length;
  assert.ok(Math.abs(positive - f.monthly.pPositive) < 1e-12);
});

test('a band of a constant collapses rather than inventing width', () => {
  const b = band([5, 5, 5, 5]);
  assert.equal(b.p10, 5); assert.equal(b.p50, 5); assert.equal(b.p90, 5);
  assert.equal(b.pPositive, 1);
});

test('a leak line is recoverable revenue, not total leak', () => {
  const f = forecast(inputs({ spareCapacity: m(500) }), { n: 300, monthlyN: 100 });
  assert.ok(f.leaks.length >= 3);
  f.leaks.forEach(l => {
    assert.ok(l.revenue >= 0, l.key);
    assert.ok(f.sim.sets[l.key], `${l.key} needs a band`);
    assert.ok(f.sim.sets[l.key].p10 <= f.sim.sets[l.key].p90);
    if (l.channel !== 'close') assert.ok(l.after >= l.before);
  });
});

test('a system view carries everything a decline needs to show its working', () => {
  const v = systemView(inputs(), ['missedcall'], 'speedlead');
  ['marginalNet', 'marginalCustomers', 'standaloneNet', 'build', 'run', 'cac', 'payback', 'affordableCac']
    .forEach(k => assert.ok(k in v, k));
});
