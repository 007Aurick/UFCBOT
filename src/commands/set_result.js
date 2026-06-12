import { SlashCommandBuilder } from 'discord.js';
import { getDb } from '../database/db.js';
import { namesMatch, parseVersus } from '../utils/fighters.js';
import { errorEmbed, okEmbed, infoEmbed } from '../utils/embeds.js';
import { isAdminMember } from '../utils/permissions.js';
import { resolveEvent, findFightRow } from '../services/eventQueries.js';
import { allFightsHaveResults, computeEventScores } from '../services/scoring.js';

export const setResultCommand = {
  data: new SlashCommandBuilder()
    .setName('set_result')
    .setDescription('[Admin] Record the official winner for a fight')
    .setDMPermission(false)
    .setDefaultMemberPermissions(0)
    .addStringOption((o) =>
      o.setName('event').setDescription('Event').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((o) =>
      o.setName('fight').setDescription('Matchup: "Fighter A vs Fighter B"').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('winner').setDescription('Official winner as printed on the card').setRequired(true)
    ),
  async execute(interaction) {
    if (!isAdminMember(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });
      return;
    }
    const guildId = interaction.guildId;
    const eventKey = interaction.options.getString('event', true);
    const fightStr = interaction.options.getString('fight', true);
    const winner = interaction.options.getString('winner', true).trim();

    const event = resolveEvent(guildId, eventKey);
    if (!event) {
      await interaction.reply({ embeds: [errorEmbed('Unknown event.')], ephemeral: true });
      return;
    }

    const parsed = parseVersus(fightStr);
    if (!parsed) {
      await interaction.reply({
        embeds: [errorEmbed('Use format `Fighter A vs Fighter B`.')],
        ephemeral: true,
      });
      return;
    }

    const fight = findFightRow(event.id, parsed.fighterA, parsed.fighterB);
    if (!fight) {
      await interaction.reply({
        embeds: [errorEmbed('Fight not found on this event.')],
        ephemeral: true,
      });
      return;
    }

    if (!namesMatch(winner, fight.fighter_a) && !namesMatch(winner, fight.fighter_b)) {
      await interaction.reply({
        embeds: [errorEmbed('Winner must match one of the two fighters.')],
        ephemeral: true,
      });
      return;
    }

    const db = getDb();
    db.prepare(
      `INSERT INTO results (fight_id, winner) VALUES (?, ?)
       ON CONFLICT(fight_id) DO UPDATE SET winner = excluded.winner, set_at = datetime('now')`
    ).run(fight.id, winner);

    const embeds = [
      okEmbed('Result saved', `**${event.name}**\n${fight.fighter_a} vs ${fight.fighter_b}\nWinner: **${winner}**`),
    ];

    if (allFightsHaveResults(event.id)) {
      const res = computeEventScores(event.id, interaction.guild);
      if (res.finalized) {
        embeds.push(infoEmbed('Scores computed', res.summary || 'Leaderboards updated.'));
      } else {
        embeds.push(infoEmbed('Scoring', res.summary || 'Could not finalize scores.'));
      }
    } else {
      embeds.push(
        infoEmbed(
          'Partial card',
          'Results are not complete for this event yet. Scoring runs automatically when every fight has a result.'
        )
      );
    }

    await interaction.reply({ embeds });
  },
};
