/* =========================================================================
   MONTE CARLO — engine v2

   2,000 runs, seeded from a hash of the input set so the same answers always
   produce the same forecast. A forecast that moves when you press the button
   twice is not a forecast.

   What is sampled, and why:
     · every service's capture rate, and the close rate, as Beta(μk, (1−μ)k)
       with k = 40/s. Beta because a rate lives in [0,1] and a Normal does not.
     · the first-sale value as LogNormal, because deal sizes are right-skewed
       and a symmetric band around the mean would understate the top.
     · firm quality as a single LogNormal applied to every capture rate at
       once. This is the correlation that matters: a business that executes
       badly executes badly everywhere, and sampling each service
       independently would cancel that out and quietly narrow the band.

   The Monte Carlo does not make the centre more accurate. It exists to
   produce the WIDTH. Nothing in the copy may imply otherwise.

   Marsaglia–Tsang for Gamma, Box–Muller for Normal, mulberry32 underneath.
   No dependencies.
   ========================================================================= */

import { SERVICES } from './services.js';
import { netDelta, deltaOf, val, COUNTED_INPUTS } from './model.js';

export const N_RUNS = 2000;

/* ---------- RNG ----------------------------------------------------------- */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNormal(rng) {
  let spare = null;
  return function () {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0, s = 0;
    do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const f = Math.sqrt(-2 * Math.log(s) / s);
    spare = v * f;
    return u * f;
  };
}

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

function makeBeta(gamma) {
  return (a, b) => { const x = gamma(a), y = gamma(b); return x + y === 0 ? 0 : x / (x + y); };
}

/* ---------- seeding from the answers -------------------------------------
   FNV-1a over a canonical rendering of the inputs. Canonical because
   {a,b} and {b,a} are the same set of answers and must not be two forecasts. */
export function canonicalise(inp) {
  const keys = Object.keys(inp).sort();
  return keys.map(k => {
    const f = inp[k];
    const v = f && typeof f === 'object' && 'value' in f ? f.value : f;
    const c = f && typeof f === 'object' && f.confidence ? f.confidence : '';
    return k + '=' + (typeof v === 'object' ? JSON.stringify(v) : String(v)) + ':' + c;
  }).join('|');
}

export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const seedFor = inp => hashSeed(canonicalise(inp));

/* ---------- percentiles --------------------------------------------------- */

export function percentile(sorted, q) {
  if (!sorted.length) return 0;
  const idx = (q / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/* `floor` is the cost the delta has to clear before the engagement has paid.
   Net already carries the monthly run fee; the one-off build is charged here,
   spread across the term, so pPositive answers "did this engagement pay" and
   not "was the arithmetic above zero". */
export function band(arr, floor = 0) {
  const a = Array.from(arr).filter(Number.isFinite).sort((x, y) => x - y);
  return {
    p10: percentile(a, 10),
    p50: percentile(a, 50),
    p90: percentile(a, 90),
    pPositive: a.length ? a.filter(v => v > floor).length / a.length : 0,
    floor,
    n: a.length
  };
}

/* ---------- one draw ------------------------------------------------------ */

function drawFor(inp, spread, beta, normal) {
  const s = Math.max(0.02, spread);
  const k = 40 / s;

  /* one firm, one quality. Applied to every capture rate jointly. */
  const sigQ = 0.35 * s;
  const quality = Math.exp(normal() * sigQ - (sigQ * sigQ) / 2);

  const capture = {};
  SERVICES.forEach(sv => {
    if (!Number.isFinite(sv.capture)) return;
    const mu = Math.min(0.999, Math.max(0.001, sv.capture));
    capture[sv.id] = beta(mu * k, (1 - mu) * k);
  });

  const cl = Math.min(0.999, Math.max(0.001, val(inp, 'closeRate')));
  const close = beta(cl * k, (1 - cl) * k);

  const v = Math.max(1e-6, val(inp, 'firstValue'));
  const sigV = 0.5 * s;
  const firstValue = Math.exp(Math.log(v) - (sigV * sigV) / 2 + normal() * sigV);

  return { quality, capture, close, firstValue };
}

/* ---------- the run ------------------------------------------------------
   `perService` asks for a standalone and a marginal band for each id, drawn
   from the SAME draws as the total, so the figures are comparable rather than
   three separate simulations that happen to be printed side by side. */
export function simulate(inp, selected = [], opts = {}) {
  const n = opts.n || N_RUNS;
  const spread = Number.isFinite(opts.spread) ? opts.spread : val(inp, 'spread') || 0.35;
  const weights = opts.weights;
  const seed = Number.isFinite(opts.seed) ? opts.seed : seedFor(inp);

  const rng = mulberry32(seed);
  const normal = makeNormal(rng);
  const beta = makeBeta(makeGamma(rng, normal));

  const totals = new Float64Array(n);
  const perIds = opts.perService || [];
  const standalone = {}, marginalOut = {};
  perIds.forEach(id => { standalone[id] = new Float64Array(n); marginalOut[id] = new Float64Array(n); });

  /* extra named selections drawn from the same stream — the leak split in
     section 01 has to be commensurable with the total, not a second run */
  const sets = opts.sets || [];
  const setOut = sets.map(() => new Float64Array(n));

  for (let i = 0; i < n; i++) {
    const draws = drawFor(inp, spread, beta, normal);
    const o = { draws, weights };
    const full = netDelta(inp, selected, o);
    totals[i] = full;
    for (let j = 0; j < perIds.length; j++) {
      const id = perIds[j];
      standalone[id][i] = netDelta(inp, [id], o);
      marginalOut[id][i] = selected.includes(id)
        ? full - netDelta(inp, selected.filter(x => x !== id), o)
        : netDelta(inp, selected.concat(id), o) - full;
    }
    for (let j = 0; j < sets.length; j++) {
      setOut[j][i] = deltaOf(inp, sets[j].selected, o, sets[j].metric || 'net');
    }
  }

  const floor = Number.isFinite(opts.floor) ? opts.floor : 0;
  const out = { seed, n, spread, floor, total: band(totals, floor), draws: totals, perService: {}, sets: {} };
  perIds.forEach(id => {
    out.perService[id] = { standalone: band(standalone[id]), marginal: band(marginalOut[id]) };
  });
  sets.forEach((s, j) => { out.sets[s.key] = band(setOut[j]); });
  return out;
}

/* How much of the answer rests on figures the client never gave us. Reported
   next to the band, because a narrow band over guessed inputs is not
   precision, it is confidence in a guess. */
export function inputProvenance(inp) {
  return COUNTED_INPUTS.filter(k => k in inp).map(k => ({
    key: k,
    confidence: (inp[k] && inp[k].confidence) || 'assumed'
  }));
}
