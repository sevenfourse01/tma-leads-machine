// The approved message library and the lint that keeps anything clinical out of it.
// Every automated message the system sends is one of these templates filled in. There is no code
// path that sends free text to a patient.

import { fillTemplate, templateVars } from './template.js';

// Words an automated message to a patient must never contain. These are advice words, not topic names:
// "Thanks for asking about Invisalign" names a topic; "take ibuprofen" or "it sounds like an infection"
// is clinical. The lint runs over the library on every test run and over every rendered message.
export const CLINICAL_ADVICE_TERMS = [
  'pain', 'ache', 'bleed', 'swelling', 'swollen', 'infection', 'infected', 'abscess', 'antibiotic', 'ibuprofen', 'paracetamol', 'painkiller',
  'medication', 'prescription', 'dose', 'dosage', 'diagnos', 'symptom', 'x-ray', 'root canal', 'extraction', 'we recommend', 'you should',
  'you need', 'it sounds like', 'it is likely', 'probably', 'treatment plan says', 'rinse', 'salt water', 'clove oil', 'numb(?!er)', 'nerve', 'decay', 'cavity',
  'gum disease', 'results show', 'your results', 'referral', 'sedation', 'anaesthetic',
];

// Each term matches at the start of a word and runs to the end of it ("ache" catches "aches" and "aching",
// not "reached"; "pain" catches "painful", not "Spain").
const LINT_RE = CLINICAL_ADVICE_TERMS.map((t) => [t.replace(/\(\?!.*\)$/, ''), new RegExp(`(^|[^a-z])${t.replace(/\s+/g, '\\s+')}`, 'i')]);

export function clinicalLint(text) {
  const s = String(text || '');
  return LINT_RE.filter(([, re]) => re.test(s)).map(([t]) => t);
}

export class MessageLibrary {
  constructor(entries) {
    if (!Array.isArray(entries) || !entries.length) throw new Error('The message library is empty.');
    this.byId = new Map();
    for (const e of entries) {
      if (!e.id || !e.channel || !e.body) throw new Error(`Message entry needs id, channel and body: ${JSON.stringify(e).slice(0, 80)}`);
      if (e.channel === 'email' && !e.subject) throw new Error(`Email message '${e.id}' needs a subject.`);
      this.byId.set(e.id, { ...e, vars: [...new Set([...templateVars(e.subject || ''), ...templateVars(e.body)])] });
    }
  }

  get(id) {
    const m = this.byId.get(id);
    if (!m) throw new Error(`No approved message with id '${id}'.`);
    return m;
  }

  has(id) {
    return this.byId.has(id);
  }

  list() {
    return [...this.byId.values()];
  }

  /** Render one message. Throws on a missing variable or a lint failure, so nothing half-filled or clinical leaves. */
  render(id, vars) {
    const m = this.get(id);
    const subject = m.subject ? fillTemplate(m.subject, vars) : null;
    const body = fillTemplate(m.body, vars);
    const hits = m.audience === 'patient' ? clinicalLint(`${subject || ''}\n${body}`) : [];
    if (hits.length) throw new Error(`Message '${id}' failed the clinical lint: ${hits.join(', ')}`);
    return { id, channel: m.channel, audience: m.audience || 'patient', subject, body };
  }

  /** Every patient-facing template checked against the lint, before anything runs. Returns the failures. */
  lintAll() {
    const failures = [];
    for (const m of this.list()) {
      if ((m.audience || 'patient') !== 'patient') continue;
      const hits = clinicalLint(`${m.subject || ''}\n${m.body}`);
      if (hits.length) failures.push({ id: m.id, hits });
    }
    return failures;
  }
}
