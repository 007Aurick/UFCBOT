import { SlashCommandBuilder } from 'discord.js';
import { getDb } from '../database/db.js';
import { errorEmbed, eventCardEmbed } from '../utils/embeds.js';
import { formatPredictionSchedule } from '../services/deadline.js';
import { resolveEvent } from '../services/eventQueries.js';

export const cardCommand = {
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('Show the fight card and prediction open/close times for an event')
    .setDMPermission(false)
    .addStringOption((o) =>
      o.setName('event').setDescription('Event').setRequired(true).setAutocomplete(true)
    ),
  async execute(interaction) {
    const guildId = interaction.guildId;
    const eventKey = interaction.options.getString('event', true);
    const event = resolveEvent(guildId, eventKey);
    if (!event) {
      await interaction.reply({ embeds: [errorEmbed('Unknown event.')], ephemeral: true });
      return;
    }
    const db = getDb();
    const fights = db.prepare(`SELECT * FROM fights WHERE event_id = ? ORDER BY sort_order, id`).all(event.id);
    await interaction.reply({
      embeds: [eventCardEmbed(event, fights, formatPredictionSchedule(event.event_date))],
    });
  },
};
