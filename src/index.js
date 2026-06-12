import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { discordToken, serverTimezone } from './config.js';
import { getDb } from './database/db.js';
import { commands } from './commands/index.js';
import { registerReady } from './events/ready.js';
import { registerInteractionCreate } from './events/interactionCreate.js';
import { startLockWatcher } from './services/lockWatcher.js';
import { resetWeeklyPoints } from './services/scoring.js';
import cron from 'node-cron';

getDb();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commandMap = new Collection();
for (const c of commands) {
  commandMap.set(c.data.name, c);
}

registerReady(client);
registerInteractionCreate(client, commandMap);
startLockWatcher(client);

cron.schedule(
  '5 0 * * 1',
  () => {
    try {
      resetWeeklyPoints();
      console.log(`[weekly-reset] Cleared weekly points (${serverTimezone}).`);
    } catch (e) {
      console.error('[weekly-reset]', e);
    }
  },
  { timezone: serverTimezone }
);

process.on('SIGINT', () => {
  client.destroy().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  client.destroy().finally(() => process.exit(0));
});

await client.login(discordToken);
