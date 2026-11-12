// The keyword lists. Step 3 of "cheap checks first": anything mentioning symptoms, pain, medication,
// results or urgency goes straight to the clinic's responder, and no model is involved.
// Matching is on word boundaries so "painting" is not "pain", and negation is deliberately ignored:
// "no pain yet" still reaches a person. The clinical row is zero tolerance, so the list errs wide.

const CLINICAL_TERMS = [
  // pain and symptoms
  'pain', 'painful', 'ache', 'aching', 'toothache', 'hurts', 'hurt', 'hurting', 'sore', 'throbbing', 'sensitive', 'sensitivity',
  'bleed', 'bleeds', 'bleeding', 'bled', 'swelling', 'swollen', 'swell', 'abscess', 'infection', 'infected', 'pus',
  'numb', 'numbness', 'tingling', 'fever', 'lump', 'ulcer', 'ulcers', 'wobbly', 'loose tooth', 'loose crown', 'loose filling',
  'broken', 'broke', 'chipped', 'chip', 'cracked', 'crack', 'fell out', 'fallen out', 'came out', 'come out', 'knocked out', 'lost a filling', 'lost my filling', 'lost a crown',
  'bite', 'jaw', 'clicking', 'locked', 'gum disease', 'gums', 'decay', 'cavity', 'cavities', 'hole in',
  // existing treatment problems
  'my implant', 'my crown', 'my filling', 'my veneer', 'my denture', 'my brace', 'my retainer', 'my aligner', 'after my', 'since my',
  // medication, results, records
  'medication', 'medicine', 'antibiotic', 'antibiotics', 'prescription', 'prescribe', 'painkiller', 'painkillers', 'ibuprofen', 'paracetamol', 'codeine',
  'allergic', 'allergy', 'pregnant', 'pregnancy', 'breastfeeding', 'diabetic', 'blood thinner', 'warfarin',
  'results', 'x-ray', 'xray', 'x ray', 'scan', 'biopsy', 'referral', 'referred', 'diagnosis', 'diagnosed', 'symptom', 'symptoms', 'side effect', 'side effects',
  'sedation', 'anaesthetic', 'anesthetic', 'extraction', 'root canal',
  // urgency
  'urgent', 'urgently', 'emergency', 'asap', 'as soon as possible', 'straight away', 'right away', 'immediately', 'today if possible', 'can i be seen today', 'seen today',
];

const ROUTINE_TERMS = [
  'price', 'prices', 'cost', 'costs', 'how much', 'fee', 'fees', 'quote', 'pricing', 'finance', 'payment plan', 'payment plans', 'insurance', 'denplan', 'nhs',
  'book', 'booking', 'appointment', 'appointments', 'availability', 'available', 'slot', 'slots', 'consultation', 'consult', 'register', 'registering', 'new patient',
  'opening hours', 'open on', 'open at', 'weekend', 'weekends', 'saturday', 'evening', 'evenings', 'parking', 'where are you', 'address', 'location',
  'check-up', 'check up', 'checkup', 'hygienist', 'hygiene', 'clean', 'scale and polish', 'whitening', 'whiten', 'invisalign', 'aligners', 'braces', 'orthodontic',
  'implants', 'implant', 'veneers', 'veneer', 'crowns', 'crown', 'bonding', 'composite', 'smile makeover', 'dentures', 'denture', 'bridge',
];

const TREATMENTS = [
  ['invisalign', 'Invisalign'], ['aligners', 'clear aligners'], ['braces', 'braces'], ['orthodontic', 'orthodontics'],
  ['whitening', 'teeth whitening'], ['whiten', 'teeth whitening'],
  ['implants', 'dental implants'], ['implant', 'a dental implant'],
  ['veneers', 'veneers'], ['veneer', 'a veneer'], ['bonding', 'composite bonding'], ['composite', 'composite bonding'],
  ['crowns', 'crowns'], ['crown', 'a crown'], ['dentures', 'dentures'], ['denture', 'a denture'], ['bridge', 'a bridge'],
  ['hygienist', 'a hygienist visit'], ['hygiene', 'a hygienist visit'], ['scale and polish', 'a scale and polish'],
  ['check-up', 'a check-up'], ['check up', 'a check-up'], ['checkup', 'a check-up'], ['new patient', 'a new-patient check-up'],
  ['smile makeover', 'a smile makeover'],
];

const TIMING_TERMS = [
  ['weekend', 'at the weekend'], ['weekends', 'at the weekend'], ['saturday', 'on a Saturday'],
  ['evening', 'in the evening'], ['evenings', 'in the evening'], ['after work', 'after work'], ['before work', 'before work'],
  ['morning', 'in the morning'], ['mornings', 'in the morning'], ['lunchtime', 'at lunchtime'], ['afternoon', 'in the afternoon'],
  ['next week', 'next week'], ['this week', 'this week'], ['this month', 'this month'], ['next month', 'next month'], ['january', 'in January'], ['new year', 'in the new year'],
];

const SOMEONE_ELSE = ['my son', 'my daughter', 'my child', 'my kids', 'my mum', 'my mother', 'my dad', 'my father', 'my wife', 'my husband', 'my partner', 'for my', 'on behalf'];

// A bare "stop" counts only when it is the whole message (or nearly), so "please stop by reception" never
// suppresses a patient. Anything less certain reaches a person as an ordinary reply.
const STOP_PHRASES = [
  'unsubscribe', 'opt out', 'opt-out', 'do not contact', "don't contact", 'dont contact', 'no further contact', 'no more messages', 'no more emails', 'no more texts',
  'remove me', 'take me off', 'leave me alone', 'stop contacting', 'stop emailing', 'stop texting', 'stop messaging', 'stop sending', 'stop calling',
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boundaryRe(term) {
  // a term may contain spaces or hyphens; match it as a whole word or phrase, case-insensitive
  return new RegExp(`(^|[^a-z0-9])${escapeRe(term).replace(/\s+/g, '\\s+')}(?=$|[^a-z0-9])`, 'i');
}

const CLINICAL_RE = CLINICAL_TERMS.map((t) => [t, boundaryRe(t)]);
const ROUTINE_RE = ROUTINE_TERMS.map((t) => [t, boundaryRe(t)]);
const TREATMENT_RE = TREATMENTS.map(([t, label]) => [t, label, boundaryRe(t)]);
const TIMING_RE = TIMING_TERMS.map(([t, label]) => [t, label, boundaryRe(t)]);
const SOMEONE_ELSE_RE = SOMEONE_ELSE.map((t) => boundaryRe(t));

export function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/** Clinical or urgent terms present in the text, with the clinic's extra terms included. */
export function clinicalMatches(text, extra = []) {
  const t = clean(text).toLowerCase();
  const hits = [];
  for (const [term, re] of CLINICAL_RE) if (re.test(t)) hits.push(term);
  for (const term of extra) if (boundaryRe(String(term).toLowerCase()).test(t)) hits.push(String(term).toLowerCase());
  return [...new Set(hits)];
}

export function routineMatches(text, extra = []) {
  const t = clean(text).toLowerCase();
  const hits = [];
  for (const [term, re] of ROUTINE_RE) if (re.test(t)) hits.push(term);
  for (const term of extra) if (boundaryRe(String(term).toLowerCase()).test(t)) hits.push(String(term).toLowerCase());
  return [...new Set(hits)];
}

/**
 * The two fit answers the booking message needs: what they asked about, and when suits.
 * Plus whether it is for someone else. Rules only; a model may enrich this later, never replace it.
 */
export function fitAnswers(text) {
  const t = clean(text).toLowerCase();
  let treatment = null;
  for (const [, label, re] of TREATMENT_RE) {
    if (re.test(t)) {
      treatment = label;
      break;
    }
  }
  let timing = null;
  for (const [, label, re] of TIMING_RE) {
    if (re.test(t)) {
      timing = label;
      break;
    }
  }
  const forSomeoneElse = SOMEONE_ELSE_RE.some((re) => re.test(t));
  return { treatment, timing, forSomeoneElse };
}

/** A patient asking us to stop. Short replies are read whole; long ones must carry a stop phrase. */
export function isStop(text) {
  const t = clean(text).toLowerCase().replace(/[!.,]+$/, '');
  if (!t) return false;
  const words = t.split(/\s+/);
  if (words.length <= 3 && words.includes('stop')) return true;
  if (t === 'unsubscribe' || t === 'no thanks' || t === 'no thank you') return true;
  return STOP_PHRASES.some((p) => boundaryRe(p).test(t));
}

export const lists = { CLINICAL_TERMS, ROUTINE_TERMS, STOP_PHRASES };
