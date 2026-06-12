export function normalizeName(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b);
}

/**
 * @param {string} fightersStr - "Fighter A vs Fighter B"
 */
export function parseVersus(fightersStr) {
  const raw = String(fightersStr || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (!raw) return null;
  const m = raw.match(/^(.+?)\s+(?:versus|vs\.?|v\.?)\s+(.+)$/i);
  if (m) {
    const a = m[1].trim();
    const b = m[2].trim();
    if (a && b) return { fighterA: a, fighterB: b };
  }
  return null;
}

export function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'event';
}
