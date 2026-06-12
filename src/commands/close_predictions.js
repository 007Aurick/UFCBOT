import { SlashCommandBuilder } from 'discord.js';
import { getDb } from '../database/db.js';
import { errorEmbed, okEmbed } from '../utils/embeds.js';
import { isAdminMember } from '../utils/permissions.js';
import { resolveEvent } from '../services/eventQueries.js';

export const closePredictionsCommand = {
  data: new SlashCommandBuilder()
    .setName('close_predictions')
    .setDescription('[Admin] Manually lock predictions for an event')
    .setDMPermission(false)
    .setDefaultMemberPermissions(0)
    .addStringOption((o) =>
      o.setName('event').setDescription('Event').setRequired(true).setAutocomplete(true)
    ),
  async execute(interaction) {
    if (!isAdminMember(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });
      return;
    }
    const guildId = interaction.guildId;
    const eventKey = interaction.options.getString('event', true);
    const event = resolveEvent(guildId, eventKey);
    if (!event) {
      await interaction.reply({ embeds: [errorEmbed('Unknown event.')], ephemeral: true });
      return;
    }
    const db = getDb();
    db.prepare(`UPDATE events SET manual_locked = 1 WHERE id = ?`).run(event.id);
    await interaction.reply({
      embeds: [okEmbed('Predictions locked', `**${event.name}** is now manually closed for picks.`)],
    });
  },
};
