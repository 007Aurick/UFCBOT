import { listEventsForGuild } from '../services/eventQueries.js';
import { isPredictionsLocked } from '../services/deadline.js';

function eventChoices(events) {
  return events.slice(0, 25).map((e) => ({
    name: `${e.name} (${e.event_date})`.slice(0, 100),
    value: String(e.id),
  }));
}

export function registerInteractionCreate(client, commandMap) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        const guildId = interaction.guildId;
        if (!guildId) {
          await interaction.respond([]);
          return;
        }
        const focused = interaction.options.getFocused(true);
        const events = listEventsForGuild(guildId);

        const cmd = interaction.commandName;
        if (focused.name === 'event' || focused.name === 'event_name') {
          const q = focused.value?.toLowerCase() ?? '';
          const pool =
            cmd === 'predict'
              ? events.filter((e) => !isPredictionsLocked(e.event_date, !!e.manual_locked))
              : events;
          const filtered = q
            ? pool.filter(
                (e) =>
                  e.name.toLowerCase().includes(q) ||
                  e.slug.toLowerCase().includes(q) ||
                  String(e.id).includes(q)
              )
            : pool;
          await interaction.respond(eventChoices(filtered));
          return;
        }

        await interaction.respond([]);
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const handler = commandMap.get(interaction.commandName);
      if (!handler) {
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
        return;
      }
      await handler.execute(interaction);
    } catch (err) {
      console.error(err);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'Something went wrong executing that command.', ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ content: 'Something went wrong executing that command.', ephemeral: true }).catch(() => null);
      }
    }
  });
}
