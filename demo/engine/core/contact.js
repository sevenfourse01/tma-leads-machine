// Contact identity. One person is one record whatever they typed: "Bob@X.com", "bob@x.com " and
// "07700 900123", "+44 (0)7700 900123" collapse to one key.
// The phone normalisation is reused from tma-systems/core/src/suppression.js (normaliseContact).

export function normaliseEmail(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s || !s.includes('@')) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

/** UK-first E.164. Returns null when the value is not a plausible phone number. */
export function normalisePhone(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  let digits = s.replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('0')) digits = '+44' + digits.slice(1);
  if (!digits.startsWith('+')) digits = '+' + digits;
  if (digits.startsWith('+440')) digits = '+44' + digits.slice(4);
  const count = digits.replace(/\D/g, '').length;
  if (count < 10 || count > 15) return null;
  return digits;
}

/** Every key this contact can be matched on. Email first, phone second. */
export function personKeys({ email, phone } = {}) {
  const keys = [];
  const e = normaliseEmail(email);
  const p = normalisePhone(phone);
  if (e) keys.push(`email:${e}`);
  if (p) keys.push(`phone:${p}`);
  return keys;
}

export function firstName(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  const first = s.split(/\s+/)[0].replace(/[^A-Za-z'\-]/g, '');
  return first ? first[0].toUpperCase() + first.slice(1) : '';
}

/** A name for the person that is safe in an internal task title: first name and last initial only. */
export function shortName(name) {
  const s = String(name || '').trim();
  if (!s) return 'Unnamed';
  const parts = s.split(/\s+/);
  if (parts.length === 1) return firstName(s);
  return `${firstName(parts[0])} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
