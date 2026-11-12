// Step 1, plain rules: drop obvious spam, and decide whether an inbound message belongs to an enquiry
// the clinic already has (same email or phone inside the dedupe window is one enquiry).

const SPAM_PHRASES = [
  'seo', 'search engine ranking', 'backlink', 'backlinks', 'guest post', 'link building', 'increase your traffic', 'rank on google', 'first page of google',
  'web design services', 'redesign your website', 'crypto', 'bitcoin', 'forex', 'casino', 'viagra', 'cialis', 'loan offer', 'make money', 'work from home',
  'lead generation services', 'we can get you more customers', 'digital marketing agency', 'free trial of our', 'unclaimed funds', 'wire transfer', 'lottery',
];

const DISPOSABLE_DOMAINS = ['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'yopmail.com', 'trashmail.com'];

function linkCount(text) {
  return (String(text).match(/https?:\/\/|www\./gi) || []).length;
}

function vowelRatio(text) {
  const letters = String(text).replace(/[^a-z]/gi, '');
  if (letters.length < 12) return 1;
  const vowels = letters.replace(/[^aeiou]/gi, '').length;
  return vowels / letters.length;
}

/**
 * Returns null when the message looks like a real enquiry, otherwise { reason } naming the rule that
 * caught it. Spam is never acknowledged.
 */
export function spamCheck({ text = '', email = '', phone = '', honeypot = '', source = 'form' } = {}) {
  if (String(honeypot || '').trim()) return { reason: 'honeypot filled' };
  const body = String(text || '');
  const lower = body.toLowerCase();
  if (linkCount(body) >= 3) return { reason: `${linkCount(body)} links` };
  for (const p of SPAM_PHRASES) {
    if (lower.includes(p)) return { reason: `spam phrase "${p}"` };
  }
  const domain = String(email || '').split('@')[1];
  if (domain && DISPOSABLE_DOMAINS.includes(domain.toLowerCase())) return { reason: `disposable address (${domain})` };
  if (source !== 'missed-call') {
    if (!String(email || '').trim() && !String(phone || '').trim()) return { reason: 'no way to reply (no email or phone)' };
    if (body.trim().length >= 20 && vowelRatio(body) < 0.18) return { reason: 'unreadable text' };
    if (body.trim().length >= 400 && linkCount(body) >= 2) return { reason: 'long text with links' };
  }
  return null;
}

/**
 * The open enquiry this message belongs to, if any: same person key, received inside the window,
 * and not closed as spam. Returns the most recent match.
 */
export function findExisting(enquiries, keys, now, windowDays) {
  if (!keys.length) return null;
  const since = now.getTime() - windowDays * 86400000;
  const matches = enquiries.filter((e) => {
    if (e.sort && e.sort.label === 'spam') return false;
    if (Date.parse(e.receivedAt) < since) return false;
    return e.personKeys.some((k) => keys.includes(k));
  });
  matches.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  return matches[0] || null;
}

export const spamLists = { SPAM_PHRASES, DISPOSABLE_DOMAINS };
