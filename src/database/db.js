import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { databasePath } from '../config.js';

let dbInstance = null;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getDb() {
  if (dbInstance) return dbInstance;
  ensureDir(databasePath);
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  dbInstance = db;
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      streak INTEGER NOT NULL DEFAULT 0,
      last_scored_event_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS guild_weekly_scores (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id),
      FOREIGN KEY (user_id) REFERENCES users(discord_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      event_date TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('fightnight','ppv')),
      manual_locked INTEGER NOT NULL DEFAULT 0,
      scores_finalized_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (guild_id, slug)
    );

    CREATE TABLE IF NOT EXISTS fights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      fight_type TEXT NOT NULL CHECK (fight_type IN ('prelim','main','title')),
      fighter_a TEXT NOT NULL,
      fighter_b TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (event_id, fighter_a, fighter_b)
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      fight_id INTEGER NOT NULL REFERENCES fights(id) ON DELETE CASCADE,
      predicted_winner TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, fight_id)
    );

    CREATE TABLE IF NOT EXISTS results (
      fight_id INTEGER PRIMARY KEY REFERENCES fights(id) ON DELETE CASCADE,
      winner TEXT NOT NULL,
      set_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      points INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      total INTEGER NOT NULL,
      perfect_card INTEGER NOT NULL DEFAULT 0,
      computed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_fights_event ON fights(event_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_fight ON predictions(fight_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
    CREATE INDEX IF NOT EXISTS idx_scores_event ON scores(event_id);
    CREATE INDEX IF NOT EXISTS idx_events_guild ON events(guild_id);
  `);
}

export function upsertUser(discordId, username) {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (discord_id, username) VALUES (?, ?)
     ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username`
  ).run(discordId, username);
}
