import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { getDb } from '../database/db.js';
import { errorEmbed } from '../utils/embeds.js';
import { resolveEvent } from '../services/eventQueries.js';

export const resultsCommand = {
  data: new SlashCommandBuilder()
    .setName('results')
    .setDescription('Official results recorded for an event')
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
    const rows = db
      .prepare(
        `SELECT f.fighter_a, f.fighter_b, f.fight_type, r.winner
         FROM fights f
         LEFT JOIN results r ON r.fight_id = f.id
         WHERE f.event_id = ?
         ORDER BY f.sort_order, f.id`
      )
      .all(event.id);
    const lines = rows
      .map((r) => {
        const tag = r.fight_type === 'title' ? 'TITLE' : r.fight_type === 'main' ? 'MAIN' : 'PRE';
        const w = r.winner ? `**${r.winner}**` : '_pending_';
        return `[${tag}] ${r.fighter_a} vs ${r.fighter_b} → ${w}`;
      })
      .join('\n')
      .slice(0, 3900);
    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle(`Results — ${event.name}`)
      .setDescription(lines || '_No fights._');
    await interaction.reply({ embeds: [embed] });
  },
};
