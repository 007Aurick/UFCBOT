import { ActivityType } from 'discord.js';

export function registerReady(client) {
  client.once('ready', (c) => {
    console.log(`Logged in as ${c.user.tag}`);
    c.user.setActivity('UFC predictions', { type: ActivityType.Competing });
  });
}
