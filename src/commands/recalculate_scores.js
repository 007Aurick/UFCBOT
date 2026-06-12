import { SlashCommandBuilder } from 'discord.js';
import { errorEmbed, okEmbed, infoEmbed } from '../utils/embeds.js';
import { isAdminMember } from '../utils/permissions.js';
import { resolveEvent } from '../services/eventQueries.js';
import { allFightsHaveResults, computeEventScores } from '../services/scoring.js';

export const recalculateScoresCommand = {
  data: new SlashCommandBuilder()
    .setName('recalculate_scores')
    .setDescription('[Admin] Recompute scores for an event after result corrections')
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
    if (!allFightsHaveResults(event.id)) {
      await interaction.reply({
        embeds: [errorEmbed('All fights must have results before scores can be calculated.')],
        ephemeral: true,
      });
      return;
    }
    const res = computeEventScores(event.id, interaction.guild);
    await interaction.reply({
      embeds: [
        okEmbed('Recalculation complete', res.summary || 'Done'),
        infoEmbed(
          'Note',
          'Streaks and weekly points are only applied on the first finalization; recalculation updates score rows only.'
        ),
      ],
    });
  },
};
