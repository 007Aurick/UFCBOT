import { getDb } from '../database/db.js';
import { namesMatch } from '../utils/fighters.js';
import { topPredictorRoleId } from '../config.js';

const TYPE_POINTS = { prelim: 2, main: 5, title: 10 };

export function pointsForFightType(fightType) {
  return TYPE_POINTS[fightType] ?? 0;
}

export function allFightsHaveResults(eventId) {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) AS c FROM fights WHERE event_id = ?`).get(eventId).c;
  if (total === 0) return false;
  const withRes = db
    .prepare(
      `SELECT COUNT(*) AS c FROM fights f
       INNER JOIN results r ON r.fight_id = f.id WHERE f.event_id = ?`
    )
    .get(eventId).c;
  return withRes === total;
}

/**
 * Compute and persist scores for an event. Idempotent per run; overwrites scores rows.
 * @returns {{ finalized: boolean, summary?: string }}
 */
export function computeEventScores(eventId, guild = null) {
  const db = getDb();
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
  if (!event) return { finalized: false, summary: 'Event not found.' };
  const alreadyFinalized = Boolean(event.scores_finalized_at);
  if (!allFightsHaveResults(eventId)) {
    return { finalized: false, summary: 'Not all fights have results yet.' };
  }

  const fights = db
    .prepare(
      `SELECT f.*, r.winner AS result_winner FROM fights f
       INNER JOIN results r ON r.fight_id = f.id WHERE f.event_id = ?`
    )
    .all(eventId);

  const preds = db
    .prepare(
      `SELECT p.* FROM predictions p
       INNER JOIN fights f ON f.id = p.fight_id
       WHERE f.event_id = ?`
    )
    .all(eventId);

  /** @type {Map<string, { points: number, correct: number, total: number, predictedFightIds: Set<number> }>} */
  const byUser = new Map();
  for (const p of preds) {
    if (!byUser.has(p.user_id)) {
      byUser.set(p.user_id, { points: 0, correct: 0, total: 0, predictedFightIds: new Set() });
    }
  }

  const fightById = new Map(fights.map((f) => [f.id, f]));

  for (const p of preds) {
    const agg = byUser.get(p.user_id);
    const fight = fightById.get(p.fight_id);
    if (!fight) continue;
    agg.total += 1;
    agg.predictedFightIds.add(p.fight_id);
    const ok = namesMatch(p.predicted_winner, fight.result_winner);
    if (ok) {
      agg.correct += 1;
      agg.points += pointsForFightType(fight.fight_type);
    }
  }

  const fightCount = fights.length;
  for (const uid of byUser.keys()) {
    db.prepare(`INSERT OR IGNORE INTO users (discord_id, username) VALUES (?, ?)`).run(uid, 'Unknown');
  }

  const insertScore = db.prepare(
    `INSERT INTO scores (user_id, event_id, points, correct, total, perfect_card)
     VALUES (@user_id, @event_id, @points, @correct, @total, @perfect_card)
     ON CONFLICT(user_id, event_id) DO UPDATE SET
       points = excluded.points,
       correct = excluded.correct,
       total = excluded.total,
       perfect_card = excluded.perfect_card,
       computed_at = datetime('now')`
  );

  const tx = db.transaction(() => {
    for (const [userId, agg] of byUser) {
      const predictedAllCard =
        agg.predictedFightIds.size === fightCount && fightCount > 0;
      const perfectCard = predictedAllCard && agg.correct === fightCount;
      insertScore.run({
        user_id: userId,
        event_id: eventId,
        points: agg.points,
        correct: agg.correct,
        total: agg.total,
        perfect_card: perfectCard ? 1 : 0,
      });

      if (!alreadyFinalized) {
        const userRow = db.prepare(`SELECT streak, weekly_points FROM users WHERE discord_id = ?`).get(userId);
        let streak = userRow?.streak ?? 0;
        if (agg.total > 0) {
          streak = agg.correct > 0 ? streak + 1 : 0;
        }
        db.prepare(`UPDATE users SET streak = ?, last_scored_event_id = ? WHERE discord_id = ?`).run(
          streak,
          eventId,
          userId
        );
        db.prepare(
          `INSERT INTO guild_weekly_scores (guild_id, user_id, points) VALUES (?, ?, ?)
           ON CONFLICT(guild_id, user_id) DO UPDATE SET
             points = guild_weekly_scores.points + excluded.points,
             updated_at = datetime('now')`
        ).run(event.guild_id, userId, agg.points);
      }
    }

    if (!alreadyFinalized) {
      db.prepare(`UPDATE events SET scores_finalized_at = datetime('now') WHERE id = ?`).run(eventId);
    }
  });

  tx();

  let roleNote = '';
  if (!alreadyFinalized && guild && topPredictorRoleId) {
    const top = db
      .prepare(
        `SELECT user_id, points FROM scores WHERE event_id = ? ORDER BY points DESC, correct DESC LIMIT 1`
      )
      .get(eventId);
    if (top) {
      guild.members
        .fetch(top.user_id)
        .then((m) => m.roles.add(topPredictorRoleId).catch(() => null))
        .catch(() => null);
      roleNote = ` Attempted to assign top-predictor role to <@${top.user_id}>.`;
    }
  }

  const withPerfect = [...byUser.entries()].filter(([, a]) => {
    const predictedAllCard = a.predictedFightIds.size === fightCount && fightCount > 0;
    return predictedAllCard && a.correct === fightCount;
  }).length;

  return {
    finalized: true,
    summary: `Scores saved for **${event.name}**. Users scored: **${byUser.size}**. Perfect cards: **${withPerfect}**.${roleNote}`,
  };
}

export function getGlobalLeaderboard(guildId, limit = 15) {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.user_id,
              SUM(s.points) AS points,
              SUM(s.correct) AS correct,
              SUM(s.total) AS total,
              MAX(s.perfect_card) AS perfect_card,
              MAX(COALESCE(u.streak, 0)) AS streak
       FROM scores s
       INNER JOIN events e ON e.id = s.event_id
       LEFT JOIN users u ON u.discord_id = s.user_id
       WHERE e.guild_id = ?
       GROUP BY s.user_id
       ORDER BY points DESC,
                (CAST(SUM(s.correct) AS REAL) / NULLIF(SUM(s.total), 0)) DESC
       LIMIT ?`
    )
    .all(guildId, limit);
}

export function getWeeklyLeaderboard(guildId, limit = 15) {
  const db = getDb();
  return db
    .prepare(
      `SELECT user_id, points, 0 AS correct, 0 AS total, 0 AS perfect_card
       FROM guild_weekly_scores
       WHERE guild_id = ? AND points > 0
       ORDER BY points DESC
       LIMIT ?`
    )
    .all(guildId, limit);
}

export function resetWeeklyPoints() {
  const db = getDb();
  db.prepare(`UPDATE guild_weekly_scores SET points = 0, updated_at = datetime('now')`).run();
}
