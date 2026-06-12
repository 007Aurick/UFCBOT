/**
 * Pull fight cards from ufc.com event pages (public HTML; no official JSON API).
 * Parses Main Card / Prelims / Early Prelims sections when present.
 */

const UFC_EVENT_PATH = /^\/event\/[^/]+\/?$/;

function normalizeEventUrl(input) {
  const raw = input.trim();
  let u;
  try {
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'ufc.com') return null;
  if (!UFC_EVENT_PATH.test(u.pathname)) return null;
  u.hash = '';
  u.search = '';
  if (!u.hostname.startsWith('www.')) u.hostname = 'www.' + u.hostname;
  return u.toString();
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function sliceSection(html, startNeedle, endNeedle) {
  const i = html.indexOf(startNeedle);
  if (i === -1) return '';
  const from = i + startNeedle.length;
  if (!endNeedle) return html.slice(from);
  const j = html.indexOf(endNeedle, from);
  if (j === -1) return html.slice(from);
  return html.slice(from, j);
}

function isPlaceholderName(name) {
  const n = name.toLowerCase();
  return (
    !name ||
    n === 'tbd' ||
    n.includes('tbd vs') ||
    n.includes('silhouette') ||
    n.includes('full body silhouette') ||
    n.includes('shadow_fighter')
  );
}

function extractFightBlocks(sectionHtml) {
  const fights = [];
  const needle = '<div class="c-listing-fight"';
  let pos = 0;
  while (true) {
    const start = sectionHtml.indexOf(needle, pos);
    if (start === -1) break;
    const block = sectionHtml.slice(start, start + 12000);
    const classMatch = block.match(
      /class="c-listing-fight__class-text"[^>]*>([^<]*)</
    );
    const boutType = (classMatch?.[1] ?? '').trim();
    const redMatch = block.match(
      /class="c-listing-fight__corner-name[^"]*c-listing-fight__corner-name--red"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/
    );
    const blueMatch = block.match(
      /class="c-listing-fight__corner-name[^"]*c-listing-fight__corner-name--blue"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/
    );
    let fighterA = redMatch ? stripTags(redMatch[1]) : '';
    let fighterB = blueMatch ? stripTags(blueMatch[1]) : '';
    fighterA = fighterA.replace(/\s+/g, ' ').trim();
    fighterB = fighterB.replace(/\s+/g, ' ').trim();
    if (!isPlaceholderName(fighterA) && !isPlaceholderName(fighterB)) {
      const isTitle =
        /\btitle\b/i.test(boutType) ||
        /\bchampionship\b/i.test(boutType) ||
        /\binterim\b/i.test(boutType);
      fights.push({ fighterA, fighterB, boutType, isTitle });
    }
    pos = start + needle.length;
  }
  return fights;
}

/**
 * @param {string} html
 * @param {'prelim'|'main'} defaultSlot
 */
function sectionToFights(html, defaultSlot) {
  const raw = extractFightBlocks(html);
  const slot = defaultSlot === 'main' ? 'main' : 'prelim';
  return raw.map((r) => ({
    fighterA: r.fighterA,
    fighterB: r.fighterB,
    fightType: r.isTitle ? 'title' : slot,
  }));
}

/**
 * @param {string} eventPageUrl
 * @returns {Promise<{ fights: { fighterA: string, fighterB: string, fightType: string }[], sourceUrl: string }>}
 */
export async function fetchUfcCardFromEventPage(eventPageUrl) {
  const url = normalizeEventUrl(eventPageUrl);
  if (!url) {
    throw new Error('Use a UFC event URL like https://www.ufc.com/event/ufc-fight-night-may-30-2026');
  }
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'UFCBOT/1.0 (Discord bot; fetches public ufc.com event pages)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`UFC.com returned HTTP ${res.status}`);
  }
  const html = await res.text();

  const mainHtml = sliceSection(html, 'class="fight-card"', 'id="prelims-card"');
  const prelimsHtml = sliceSection(html, 'id="prelims-card"', 'id="early-prelims"');
  const earlyHtml = sliceSection(html, 'id="early-prelims"', 'id="follow-along-live"');

  const earlyFights = sectionToFights(earlyHtml, 'prelim');
  const prelimFights = sectionToFights(prelimsHtml, 'prelim');
  const mainFightsRaw = sectionToFights(mainHtml, 'main');
  const mainFights = [...mainFightsRaw].reverse();

  const fights = [...earlyFights, ...prelimFights, ...mainFights];
  const key = (f) =>
    `${f.fighterA.toLowerCase()}|${f.fighterB.toLowerCase()}|${f.fightType}`;
  const seen = new Set();
  const deduped = [];
  for (const f of fights) {
    const k = key(f);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(f);
  }

  if (deduped.length === 0) {
    throw new Error(
      'No bouts found on that page (card may be empty, TBD-only, or HTML layout changed).'
    );
  }

  return { fights: deduped, sourceUrl: url };
}
