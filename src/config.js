import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/** @param {string} envName */
function optionalDiscordSnowflake(envName) {
  const raw = process.env[envName];
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (!/^\d{17,22}$/.test(t)) {
    console.warn(
      `[config] ${envName} must be a numeric Discord ID (or leave blank). Ignoring invalid value.`
    );
    return null;
  }
  return t;
}

export const discordToken = requireEnv('DISCORD_TOKEN');
export const discordClientId = requireEnv('DISCORD_CLIENT_ID');
export const discordGuildId = optionalDiscordSnowflake('DISCORD_GUILD_ID');
export const serverTimezone = process.env.SERVER_TIMEZONE || 'UTC';
export const adminRoleId = optionalDiscordSnowflake('DISCORD_ADMIN_ROLE_ID');
export const topPredictorRoleId = optionalDiscordSnowflake('TOP_PREDICTOR_ROLE_ID');
export const databasePath = process.env.DATABASE_PATH || './data/bot.sqlite';
