/* =========================================================================
   FORECAST ENGINE — browser port of PREDICTION-ENGINE/revenue_model.py

   This is a SIMPLIFIED but structurally faithful port of the real engine:
   the same Beta-PERT three-point inputs, the same funnel chain, the same
   cohort revenue accumulation, the same cost and payback arithmetic, the
   same percentile/probability reporting, the same refusal behaviour.

   What is simplified versus the real thing:
     · 4,000 Monte Carlo draws instead of 40,000 (wider MC standard error —
       we report it rather than hide it)
     · inputs are DERIVED from seven answers plus sector defaults, instead of
       nine measured three-point estimates gathered on a diagnosis call
     · no LLM inference layer, no market-intelligence pass, no budget optimiser
     · saturation is assumed, not measured

   What is NOT simplified: the maths. Same distributions, same structure, same
   honesty rules. Cross-checked against the Python engine — see ENGINE-PARITY
   in the repo notes.

   NOT a trained model. A structural funnel simulated under stated uncertainty,
   conditional entirely on the inputs it is given.
   ========================================================================= */

const PERT_LAMBDA = 4.0;          /* standard PERT weight on the mode */
const N_SIMS = 4000;
const DEFAULT_SEED = 20260722;    /* the engine's seed, echoed in the report */
const MIN_FINITE_SHARE = 0.99;

/* ---------- seeded RNG ---------------------------------------------------
   Deterministic so the same answers always produce the same forecast — a
   forecast that changes when you press the button twice is not a forecast. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Box–Muller, cached second variate */
function makeNormal(rng) {
  let spare = null;
  return function () {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0, s = 0;
    do {
      u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt(-2 * Math.log(s) / s);
    spare = v * f;
    return u * f;
  };
}

/* Marsaglia–Tsang gamma — the same method numpy uses under rng.beta */
function makeGamma(rng, normal) {
  return function gamma(shape) {
    if (shape < 1) return gamma(shape + 1) * Math.pow(rng(), 1 / shape);
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = normal(); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
}

/* Beta(a,b) = X/(X+Y), X~Gamma(a), Y~Gamma(b) */
function makeBeta(gamma) {
  return function (a, b) {
    const x = gamma(a), y = gamma(b);
    return x / (x + y);
  };
}

/* ---------- three-point estimate ----------------------------------------
   low / mode / high, plus whether the client MEASURES it or guessed it. An
   answer resting on a guess is a different animal from one resting on data,
   and the report says which. */
function Est(low, mode, high, measured, label) {
  const a = +low, m = +mode, b = +high;
  if (![a, m, b].every(Number.isFinite)) throw new Error("Est not finite: " + label);
  if (b < a) throw new Error("Est inverted (" + a + " > " + b + "): " + label);
  if (!(a <= m && m <= b)) throw new Error("Est mode outside range: " + label);
  return { low: a, mode: m, high: b, measured: !!measured, label: label || "" };
}

function sampleEst(est, beta, n) {
  const { low: a, mode: m, high: b } = est;
  const out = new Float64Array(n);
  if (b === a) { out.fill(m); return out; }          /* degenerate point mass */
  const alpha = 1 + PERT_LAMBDA * (m - a) / (b - a);
  const bta   = 1 + PERT_LAMBDA * (b - m) / (b - a);
  for (let i = 0; i < n; i++) out[i] = a + (b - a) * beta(alpha, bta);
  return out;
}

/* ---------- simulation ---------------------------------------------------- */

/* Total gross revenue over the horizon from a monthly cohort of new deals.
   A cohort acquired in month t bills `upfront` once, then `recurring` for
   min(retention, horizon − t) months. */
function revenueFromDeals(deals, upfront, recurring, retention, horizon, n) {
  const total = new Float64Array(n);
  for (let t = 0; t < horizon; t++) {
    const monthsLeft = horizon - t;
    for (let i = 0; i < n; i++) {
      const billed = Math.min(retention[i], monthsLeft);
      total[i] += deals[i] * (upfront[i] + recurring[i] * billed);
    }
  }
  return total;
}

const clip = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

/* `cplMultiplier` models diminishing returns: cost per lead rises as you push
   more budget through the same channel. 1.0 = no saturation (linear), which is
   the degenerate assumption that makes naive forecasts look wonderful. */
function simulate(profile, opts) {
  const o = opts || {};
  const seed = o.seed === undefined ? DEFAULT_SEED : o.seed;
  const n = o.n || N_SIMS;
  const H = profile.horizonMonths;
  const spend = o.spend === undefined ? profile.monthlySpend : o.spend;
  const cplMult = o.cplMultiplier === undefined ? 1.0 : o.cplMultiplier;

  const rng = mulberry32(seed);
  const beta = makeBeta(makeGamma(rng, makeNormal(rng)));
  const S = est => sampleEst(est, beta, n);

  /* the 1e-6 floor is a divide-by-zero assertion boundary, not validation */
  const cpl = S(profile.costPerLead);
  for (let i = 0; i < n; i++) cpl[i] = Math.max(cpl[i] * cplMult, 1e-6);
  const l2c  = S(profile.leadToCall);
  const show = S(profile.callShow);
  const close = S(profile.showToClose);
  const val  = S(profile.dealValue);
  const mrr  = S(profile.monthlyRecurring);
  const ret  = S(profile.retentionMonths);
  const marg = S(profile.grossMargin);
  const baseDeals = S(profile.baselineDealsPerMonth);

  for (let i = 0; i < n; i++) {
    l2c[i] = clip(l2c[i], 0, 1);
    show[i] = clip(show[i], 0, 1);
    close[i] = clip(close[i], 0, 1);
    val[i] = Math.max(val[i], 0);
    mrr[i] = Math.max(mrr[i], 0);
    ret[i] = Math.max(ret[i], 0);
    marg[i] = clip(marg[i], 0, 1);
    baseDeals[i] = Math.max(baseDeals[i], 0);
  }

  const deals = new Float64Array(n);
  for (let i = 0; i < n; i++) deals[i] = (spend / cpl[i]) * l2c[i] * show[i] * close[i];

  /* INCREMENTAL framing. These are the NEW deals driven by the spend we manage,
     on top of whatever they already close — so the control ("change nothing")
     is the zero line by construction: no fee, no spend, no new deals. */
  const revNew = revenueFromDeals(deals, val, mrr, ret, H, n);
  const revBase = revenueFromDeals(baseDeals, val, mrr, ret, H, n);

  const gpNew = new Float64Array(n), gpBase = new Float64Array(n);
  for (let i = 0; i < n; i++) { gpNew[i] = revNew[i] * marg[i]; gpBase[i] = revBase[i] * marg[i]; }

  const adCost = spend * H;
  const tmaCost = profile.tmaBuildFee + profile.tmaMonthly * H;

  const netWith = new Float64Array(n), uplift = new Float64Array(n);
  for (let i = 0; i < n; i++) { netWith[i] = gpNew[i] - adCost - tmaCost; uplift[i] = netWith[i]; }

  /* payback month: first month cumulative gross profit clears cumulative cost */
  const payback = new Float64Array(n).fill(NaN);
  for (let t = 1; t <= H; t++) {
    const cumGp = revenueFromDeals(deals, val, mrr, ret, t, n);
    const cumCost = spend * t + profile.tmaBuildFee + profile.tmaMonthly * t;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(payback[i]) && cumGp[i] * marg[i] >= cumCost) payback[i] = t;
    }
  }

  return {
    revenue: revNew, grossProfit: gpNew, netWith, uplift, dealsPerMonth: deals,
    baselineGrossProfit: gpBase, baselineDeals: baseDeals, paybackMonth: payback,
    tmaCost, adCost, spend, seed, n, cplMultiplier: cplMult,
    samples: {
      cost_per_lead: cpl, lead_to_call: l2c, call_show: show, show_to_close: close,
      deal_value: val, monthly_recurring: mrr, retention_months: ret,
      gross_margin: marg, baseline_deals_per_month: baseDeals
    }
  };
}

/* ---------- reporting ----------------------------------------------------- */

/* Honest precision: a 4,000-draw simulation cannot resolve a forecast to the
   pound, so we do not print digits the sampler cannot support. Monotonic, so
   it can never reorder P10/P50/P90. */
function roundSig(x, sig) {
  sig = sig || 3;
  if (x === 0 || !Number.isFinite(x)) return x;
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const f = Math.pow(10, sig - 1 - mag);
  return Math.round(x * f) / f;
}

function percentile(sorted, q) {
  if (!sorted.length) return null;
  const idx = (q / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function pctiles(arr, money) {
  const f = Array.from(arr).filter(Number.isFinite).sort((a, b) => a - b);
  if (!f.length) return { p10: null, p50: null, p90: null };
  const out = { p10: percentile(f, 10), p50: percentile(f, 50), p90: percentile(f, 90) };
  if (money) { out.p10 = roundSig(out.p10); out.p50 = roundSig(out.p50); out.p90 = roundSig(out.p90); }
  return out;
}

/* Spearman rank correlation of each input against the outcome — the honest
   "what is actually driving your answer" view. An input the client GUESSED
   sitting at the top of this list is a warning, not a result. */
function rank(arr) {
  const idx = Array.from(arr.keys()).sort((a, b) => arr[a] - arr[b]);
  const r = new Float64Array(arr.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && arr[idx[j + 1]] === arr[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(x, y) {
  const n = x.length;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? NaN : num / den;
}

function sensitivity(sim) {
  const y = rank(sim.uplift);
  const out = [], skipped = [];
  Object.keys(sim.samples).forEach(k => {
    const v = sim.samples[k];
    const first = v[0];
    let varies = false;
    for (let i = 1; i < v.length; i++) if (Math.abs(v[i] - first) > 1e-12) { varies = true; break; }
    if (!varies) { skipped.push(k); return; }
    const c = pearson(rank(v), y);
    if (!Number.isFinite(c)) { skipped.push(k); return; }
    out.push({ input: k, correlation: c });
  });
  out.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  return { sensitivity: out, skipped };
}

/* Thrown rather than returned: a refusal is not a forecast with a caveat. */
function Refusal(message, reasons) {
  const e = new Error(message);
  e.name = "Refusal";
  e.reasons = reasons || [];
  return e;
}

function report(profile, sim) {
  const u = sim.uplift, nw = sim.netWith, n = sim.n;
  const keep = [];
  for (let i = 0; i < n; i++) if (Number.isFinite(u[i]) && Number.isFinite(nw[i])) keep.push(i);
  const finiteShare = n ? keep.length / n : 0;

  /* An all-NaN uplift would make both probabilities read 0.0 — a fabricated
     certainty. If too many draws are non-finite we refuse rather than quote
     the survivors. */
  if (finiteShare < MIN_FINITE_SHARE) {
    throw Refusal("The inputs overflow the model, so no honest distribution exists.",
      [(finiteShare * 100).toFixed(1) + "% of simulated scenarios were finite: " +
       "the economics as entered are too extreme to simulate."]);
  }

  const uf = keep.map(i => u[i]), nwf = keep.map(i => nw[i]);
  const pb = keep.map(i => sim.paybackMonth[i]);
  const paid = pb.filter(Number.isFinite);

  let mean = 0; uf.forEach(v => mean += v); mean /= uf.length;
  let ss = 0; uf.forEach(v => ss += (v - mean) * (v - mean));
  const sd = uf.length > 1 ? Math.sqrt(ss / (uf.length - 1)) : 0;

  const s = sensitivity(sim);
  return {
    horizonMonths: profile.horizonMonths,
    monthlySpend: sim.spend,
    seed: sim.seed,
    nSims: sim.n,
    tmaCostTotal: sim.tmaCost,
    adCostTotal: sim.adCost,
    discardedNonFiniteShare: +(1 - finiteShare).toFixed(5),
    dealsPerMonth: pctiles(keep.map(i => sim.dealsPerMonth[i])),
    grossRevenue: pctiles(keep.map(i => sim.revenue[i]), true),
    netAfterAllCosts: pctiles(nwf, true),
    upliftVsNoIntervention: pctiles(uf, true),
    upliftMcStdError: uf.length > 1 ? roundSig(sd / Math.sqrt(uf.length)) : null,
    pBeatOurFee: uf.filter(v => v > 0).length / uf.length,
    pLoseMoney: nwf.filter(v => v < 0).length / nwf.length,
    baselineContext: {
      dealsPerMonth: pctiles(keep.map(i => sim.baselineDeals[i])),
      grossProfitOverHorizon: pctiles(keep.map(i => sim.baselineGrossProfit[i]), true)
    },
    paybackMonth: {
      p50AmongThoseThatPayBack: paid.length ? percentile(paid.slice().sort((a, b) => a - b), 50) : null,
      shareThatPayBack: pb.length ? paid.length / pb.length : 0,
      neverWithinHorizon: pb.length ? 1 - paid.length / pb.length : 1
    },
    sensitivity: s.sensitivity,
    sensitivitySkipped: s.skipped,
    guessedInputs: Object.keys(profile).filter(k => profile[k] && profile[k].label !== undefined && !profile[k].measured)
      .map(k => profile[k].label || k),
    upliftDraws: uf,
    method: "Beta-PERT three-point inputs, " + sim.n + " Monte Carlo draws (seed " + sim.seed +
      "). NOT a trained model: a structural funnel simulated under stated uncertainty, " +
      "conditional on the inputs given. Inputs are drawn INDEPENDENTLY; real funnels are " +
      "correlated, which would narrow this band."
  };
}
