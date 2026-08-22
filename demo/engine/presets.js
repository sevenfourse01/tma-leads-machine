/* =========================================================================
   INDUSTRY BENCHMARK DEFAULTS — engine v2

   Everything a business never told us. Every figure here is served to the
   model tagged `assumed`, and the report says so beside the number.

   Sources, honestly stated:
     · margin and costPerLead mirror SECTOR_ECON in demo/archive/predict.js,
       which is the repo's existing sector table. Where a niche has no row
       there, it inherits the nearest one through ALIAS below.
     · repeat, hourlyCost and spread have no source. They are our starting
       guesses, listed in README-NUMBERS.md as the first things to measure.

   Commercial figures come from PRICING, which mirrors the repo's own pricing
   config (TIERS in demo/archive/predict.js). The engine never hardcodes a
   price: model.js reads buildPerSystem and runPerSystem off the input set.
   ========================================================================= */

/* The repo's published engagement shapes. One place, mirrored from
   demo/archive/predict.js — change it there and change it here. */
export const PRICING = {
  entry: { label: 'an entry build', build: 1000, monthly: 0 },
  core: { label: 'the full machine', build: 10000, monthly: 2500 }
};

/* Which shape each service is billed under. Only the machine is core. */
export const priceOf = id => (id === 'machine' ? PRICING.core : PRICING.entry);

/* ---------- sector economics --------------------------------------------
   cpl is the cost of one NEW enquiry bought from advertising, not spend
   divided by total enquiries. Those are different numbers by a wide margin,
   because most businesses get referral and organic enquiries no budget paid
   for. The real engine reads the ad account; this reads a benchmark. */
const ECON = {
  dental: { margin: 0.62, costPerLead: 45, repeat: 2.4, hourlyCost: 22, spread: 0.30 },
  aesthetics: { margin: 0.68, costPerLead: 35, repeat: 3.2, hourlyCost: 22, spread: 0.35 },
  hvac: { margin: 0.42, costPerLead: 70, repeat: 1.6, hourlyCost: 24, spread: 0.40 },
  recruitment: { margin: 0.55, costPerLead: 120, repeat: 1.8, hourlyCost: 28, spread: 0.45 },
  ifa: { margin: 0.70, costPerLead: 95, repeat: 3.5, hourlyCost: 30, spread: 0.35 },
  vet: { margin: 0.55, costPerLead: 30, repeat: 4.0, hourlyCost: 20, spread: 0.30 },
  estate: { margin: 0.60, costPerLead: 55, repeat: 1.3, hourlyCost: 24, spread: 0.40 },
  law: { margin: 0.65, costPerLead: 80, repeat: 1.4, hourlyCost: 30, spread: 0.35 },
  accounting: { margin: 0.70, costPerLead: 90, repeat: 3.8, hourlyCost: 28, spread: 0.30 },
  mortgage: { margin: 0.70, costPerLead: 60, repeat: 1.9, hourlyCost: 26, spread: 0.35 },
  msp: { margin: 0.60, costPerLead: 150, repeat: 3.5, hourlyCost: 30, spread: 0.40 },
  agency: { margin: 0.60, costPerLead: 130, repeat: 3.0, hourlyCost: 28, spread: 0.45 },
  construction: { margin: 0.38, costPerLead: 55, repeat: 1.2, hourlyCost: 22, spread: 0.50 },
  solar: { margin: 0.40, costPerLead: 65, repeat: 1.15, hourlyCost: 22, spread: 0.50 },
  cleaning: { margin: 0.35, costPerLead: 55, repeat: 3.6, hourlyCost: 18, spread: 0.40 },
  gym: { margin: 0.60, costPerLead: 20, repeat: 2.8, hourlyCost: 18, spread: 0.35 },
  physio: { margin: 0.55, costPerLead: 42, repeat: 2.6, hourlyCost: 20, spread: 0.30 },
  education: { margin: 0.45, costPerLead: 40, repeat: 2.2, hourlyCost: 20, spread: 0.35 },
  other: { margin: 0.55, costPerLead: 55, repeat: 2.0, hourlyCost: 22, spread: 0.35 }
};

/* Niches the sector table has no row for inherit the nearest one it does. */
const ALIAS = {
  gp: 'dental', ortho: 'dental', chiro: 'physio', osteo: 'physio',
  podiatry: 'physio', optometry: 'dental', audiology: 'dental',
  fertility: 'aesthetics', derm: 'aesthetics', hairtx: 'aesthetics',
  weightloss: 'aesthetics', therapy: 'physio', homecare: 'cleaning',
  lettings: 'estate', landscaping: 'construction', wealth: 'ifa',
  benefits: 'ifa', insurance: 'mortgage', hr: 'accounting',
  security: 'cleaning', commercialre: 'estate'
};

export function econOf(industry) {
  return ECON[industry] || ECON[ALIAS[industry]] || ECON.other;
}

/* ---------- channel mix --------------------------------------------------
   Answered as a band rather than a percentage, because nobody knows their
   split to the point and a made-up decimal reads more certain than it is.
   Tagged `inferred`: derived from an answer they did give. */
export const MIX = {
  phone: { label: 'Mostly by phone', mixPhone: 0.70, mixForm: 0.20 },
  even: { label: 'An even mix of phone and online', mixPhone: 0.45, mixForm: 0.35 },
  form: { label: 'Mostly web forms', mixPhone: 0.20, mixForm: 0.60 },
  email: { label: 'Mostly email', mixPhone: 0.20, mixForm: 0.20 }
};

/* ---------- how good the front door is today -----------------------------
   answerPhone: share of calls answered or returned the same day.
   The bands are wide on purpose; the call measures the real figure. */
export const ANSWER_PHONE = {
  most: { label: 'Nearly all of them', value: 0.92 },
  many: { label: 'Most, but some slip', value: 0.78 },
  half: { label: 'About half', value: 0.55 },
  few: { label: 'Honestly, we miss a lot', value: 0.35 }
};

/* respForm / respEmail are derived from the existing "how fast does someone
   reply" question. Same answer, two different transitions: a form enquiry is
   measured against an hour, an email against a day. */
export const RESP = {
  u5: { respForm: 0.92, respEmail: 0.95 },
  hour: { respForm: 0.75, respEmail: 0.90 },
  sameday: { respForm: 0.45, respEmail: 0.80 },
  nextday: { respForm: 0.22, respEmail: 0.55 }
};

/* ---------- spare capacity ----------------------------------------------
   The single most important input, and the one people are least sure of. The
   "not sure" path infers it from headcount and current customer count, and
   the answer is tagged `inferred` so the report can say where it came from. */
export const HEADCOUNT_SLACK = {
  solo: 0.25, small: 0.35, mid: 0.30, big: 0.25
};

export function inferSpareCapacity(sizeBand, currentCustomers) {
  const slack = HEADCOUNT_SLACK[sizeBand] ?? 0.30;
  return Math.max(1, Math.round(currentCustomers * slack));
}

/* ---------- outbound discount -------------------------------------------
   A sourced lead does not convert like someone who rang you. Held at 0.38
   across every sector, because we have no evidence it differs by sector and
   inventing a per-sector figure would look like knowledge. */
export const OUTBOUND_FACTOR = 0.38;

/* Capacity clip, referral share and content discount live on the services
   that own them. Everything global to the funnel lives here. */
export const CLOSE_CAP = 0.95;
