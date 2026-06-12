import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';
import { discordToken, discordClientId, discordGuildId } from './config.js';

const body = commands.map((c) => c.data.toJSON());

const rest = new REST({ version: '10' }).setToken(discordToken);

try {
  if (discordGuildId) {
    await rest.put(Routes.applicationGuildCommands(discordClientId, discordGuildId), { body });
    console.log(`Registered ${body.length} guild commands on ${discordGuildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(discordClientId), { body });
    console.log(`Registered ${body.length} global application commands (can take up to an hour to appear).`);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}
