import { SlashCommandBuilder } from 'discord.js';
import { getDb, upsertUser } from '../database/db.js';
import {
  formatPredictionSchedule,
  isPredictionsLocked,
  predictionLockReason,
} from '../services/deadline.js';
import { namesMatch, parseVersus } from '../utils/fighters.js';
import { errorEmbed, okEmbed } from '../utils/embeds.js';
import { resolveEvent, findFightRow } from '../services/eventQueries.js';

export const predictCommand = {
  data: new SlashCommandBuilder()
    .setName('predict')
    .setDescription('Submit your pick for a fight on an upcoming event')
    .setDMPermission(false)
    .addStringOption((o) =>
      o.setName('event').setDescription('Event name').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((o) =>
      o.setName('fight').setDescription('Matchup, e.g. "Fighter A vs Fighter B"').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('winner').setDescription('Name of the fighter you pick to win').setRequired(true)
    ),
  async execute(interaction) {
    const guildId = interaction.guildId;
    const eventKey = interaction.options.getString('event', true);
    const fightStr = interaction.options.getString('fight', true);
    const winner = interaction.options.getString('winner', true);

    const event = resolveEvent(guildId, eventKey);
    if (!event) {
      await interaction.reply({ embeds: [errorEmbed('Unknown event.')], ephemeral: true });
      return;
    }

    const locked = isPredictionsLocked(event.event_date, !!event.manual_locked);
    if (locked) {
      const reason = predictionLockReason(event.event_date, !!event.manual_locked);
      let msg =
        reason === 'manual'
          ? 'Predictions are locked for this event (manually closed).'
          : reason === 'not_yet_open'
            ? `Predictions are not open yet for this event.\n${formatPredictionSchedule(event.event_date)}`
            : `Predictions are closed for this event (deadline passed).\n${formatPredictionSchedule(event.event_date)}`;
      await interaction.reply({ embeds: [errorEmbed(msg)], ephemeral: true });
      return;
    }

    const parsed = parseVersus(fightStr);
    if (!parsed) {
      await interaction.reply({
        embeds: [errorEmbed('Use format `Fighter A vs Fighter B` for the fight option.')],
        ephemeral: true,
      });
      return;
    }

    const fight = findFightRow(event.id, parsed.fighterA, parsed.fighterB);
    if (!fight) {
      const db = getDb();
      const rows = db
        .prepare(`SELECT fighter_a, fighter_b FROM fights WHERE event_id = ? ORDER BY sort_order, id`)
        .all(event.id);
      let hint = '';
      if (rows.length === 0) {
        hint = '\n\nThis event has **no fights** yet. Use `/import_ufc_card` or `/add_fight` first.';
      } else {
        const lines = rows.map((r) => `${r.fighter_a} vs ${r.fighter_b}`).join('\n');
        hint = `\n\nUse the **fight** field exactly like one of these (copy/paste):\n${lines.slice(0, 3500)}`;
      }
      await interaction.reply({
        embeds: [errorEmbed(`That fight was not found on **${event.name}**.${hint}`)],
        ephemeral: true,
      });
      return;
    }

    const w = winner.trim();
    if (!namesMatch(w, fight.fighter_a) && !namesMatch(w, fight.fighter_b)) {
      await interaction.reply({
        embeds: [errorEmbed('Winner must match one of the two fighters on the card (spelling can differ slightly; comparison is case-insensitive).')],
        ephemeral: true,
      });
      return;
    }

    const db = getDb();
    upsertUser(interaction.user.id, interaction.user.username);
    try {
      db.prepare(
        `INSERT INTO predictions (user_id, fight_id, predicted_winner) VALUES (?, ?, ?)`
      ).run(interaction.user.id, fight.id, w);
    } catch (e) {
      if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        await interaction.reply({
          embeds: [errorEmbed('You already have a prediction for this fight. Edit is not supported yet; ask an admin to reset your pick if needed.')],
          ephemeral: true,
        });
        return;
      }
      throw e;
    }

    await interaction.reply({
      embeds: [
        okEmbed(
          'Prediction saved',
          `**${event.name}**\n${fight.fighter_a} vs ${fight.fighter_b}\nPick: **${w}**`
        ),
      ],
      ephemeral: true,
    });
  },
};
