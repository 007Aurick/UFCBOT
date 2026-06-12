import { SlashCommandBuilder } from 'discord.js';
import { getDb } from '../database/db.js';
import { errorEmbed, leaderboardEmbed } from '../utils/embeds.js';
import { resolveEvent } from '../services/eventQueries.js';
import {
  getGlobalLeaderboard,
  getWeeklyLeaderboard,
} from '../services/scoring.js';
import { serverTimezone } from '../config.js';

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View prediction leaderboards')
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('event')
        .setDescription('Leaderboard for a single event')
        .addStringOption((o) =>
          o.setName('event_name').setDescription('Event').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((s) => s.setName('global').setDescription('All-time server leaderboard'))
    .addSubcommand((s) =>
      s.setName('weekly').setDescription('Weekly points (resets Mondays 00:05 server time)')
    ),
  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand(true);
    const db = getDb();

    if (sub === 'event') {
      const eventKey = interaction.options.getString('event_name', true);
      const event = resolveEvent(guildId, eventKey);
      if (!event) {
        await interaction.reply({ embeds: [errorEmbed('Unknown event.')], ephemeral: true });
        return;
      }
      const rows = db
        .prepare(
          `SELECT s.user_id, s.points, s.correct, s.total, s.perfect_card, COALESCE(u.streak, 0) AS streak
           FROM scores s
           LEFT JOIN users u ON u.discord_id = s.user_id
           WHERE s.event_id = ?
           ORDER BY s.points DESC, s.correct DESC
           LIMIT 25`
        )
        .all(event.id);
      const embed = leaderboardEmbed(
        `Event — ${event.name}`,
        rows,
        `Accuracy uses fights that were scored for this event. Timezone: ${serverTimezone}`
      );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'global') {
      const rows = getGlobalLeaderboard(guildId, 25);
      const embed = leaderboardEmbed(
        'Global leaderboard',
        rows,
        `Summed across finalized events in this server. ${serverTimezone}`
      );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'weekly') {
      const rows = getWeeklyLeaderboard(guildId, 25);
      const embed = leaderboardEmbed(
        'Weekly points',
        rows,
        `Points accumulated since the last weekly reset (Mondays 00:05, ${serverTimezone}).`
      );
      await interaction.reply({ embeds: [embed] });
    }
  },
};
