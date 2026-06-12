import { getDb } from '../database/db.js';
import { normalizeName, parseVersus } from '../utils/fighters.js';

export function listEventsForGuild(guildId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM events WHERE guild_id = ? ORDER BY date(event_date) DESC, id DESC`
    )
    .all(guildId);
}

export function resolveEvent(guildId, slugOrId) {
  const db = getDb();
  const key = String(slugOrId || '').trim();
  if (!key) return null;
  const id = Number(key);
  if (Number.isFinite(id) && id > 0) {
    const byId = db.prepare(`SELECT * FROM events WHERE guild_id = ? AND id = ?`).get(guildId, id);
    if (byId) return byId;
  }
  const bySlug = db
    .prepare(`SELECT * FROM events WHERE guild_id = ? AND slug = ?`)
    .get(guildId, key);
  if (bySlug) return bySlug;
  const byName = db.prepare(`SELECT * FROM events WHERE guild_id = ? AND name = ?`).get(guildId, key);
  if (byName) return byName;
  const withoutDate = key.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim();
  if (withoutDate !== key) {
    return db.prepare(`SELECT * FROM events WHERE guild_id = ? AND name = ?`).get(guildId, withoutDate);
  }
  return null;
}

export function findFightRow(eventId, fighterA, fighterB) {
  const db = getDb();
  const na = normalizeName(fighterA);
  const nb = normalizeName(fighterB);
  const rows = db.prepare(`SELECT * FROM fights WHERE event_id = ?`).all(eventId);
  for (const r of rows) {
    const a = normalizeName(r.fighter_a);
    const b = normalizeName(r.fighter_b);
    if ((na === a && nb === b) || (na === b && nb === a)) return r;
  }
  return null;
}

export function findFightByVersusString(eventId, versusStr) {
  const p = parseVersus(versusStr);
  if (!p) return null;
  return findFightRow(eventId, p.fighterA, p.fighterB);
}
