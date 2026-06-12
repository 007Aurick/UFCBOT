import { SlashCommandBuilder } from 'discord.js';
import { getDb } from '../database/db.js';
import { fetchUfcCardFromEventPage } from '../services/ufcCardImport.js';
import { formatPredictionSchedule } from '../services/deadline.js';
import { errorEmbed, okEmbed, eventCardEmbed } from '../utils/embeds.js';
import { isAdminMember } from '../utils/permissions.js';
import { resolveEvent } from '../services/eventQueries.js';

export const importUfcCardCommand = {
  data: new SlashCommandBuilder()
    .setName('import_ufc_card')
    .setDescription('[Admin] Import fights from a ufc.com event page into a server event')
    .setDMPermission(false)
    .setDefaultMemberPermissions(0)
    .addStringOption((o) =>
      o
        .setName('event')
        .setDescription('Your bot event')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((o) =>
      o
        .setName('ufc_url')
        .setDescription('e.g. https://www.ufc.com/event/ufc-fight-night-may-30-2026')
        .setRequired(true)
    )
    .addBooleanOption((o) =>
      o
        .setName('replace')
        .setDescription('Remove existing fights first (deletes everyone’s picks for those fights)')
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!isAdminMember(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });
      return;
    }

    const guildId = interaction.guildId;
    const eventKey = interaction.options.getString('event', true);
    const ufcUrl = interaction.options.getString('ufc_url', true);
    const replace = interaction.options.getBoolean('replace') ?? false;

    const event = resolveEvent(guildId, eventKey);
    if (!event) {
      await interaction.reply({ embeds: [errorEmbed('Unknown event.')], ephemeral: true });
      return;
    }

    const db = getDb();
    const existingCount = db
      .prepare(`SELECT COUNT(*) AS c FROM fights WHERE event_id = ?`)
      .get(event.id).c;

    if (existingCount > 0 && !replace) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            `This event already has **${existingCount}** fight(s). Run again with **replace: true** to wipe them and import (this deletes stored picks), or use an empty event.`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    let imported;
    try {
      imported = await fetchUfcCardFromEventPage(ufcUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await interaction.editReply({ embeds: [errorEmbed(msg)] });
      return;
    }

    const insert = db.prepare(
      `INSERT INTO fights (event_id, fight_type, fighter_a, fighter_b, sort_order) VALUES (?,?,?,?,?)`
    );

    try {
      db.transaction(() => {
        if (replace || existingCount > 0) {
          db.prepare(`DELETE FROM fights WHERE event_id = ?`).run(event.id);
        }
        let order = 0;
        for (const f of imported.fights) {
          insert.run(event.id, f.fightType, f.fighterA, f.fighterB, order);
          order += 1;
        }
      })();
    } catch (e) {
      if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              'Import hit a duplicate matchup (same two fighters twice). Try **replace: true** on a clean import, or report if the UFC page lists a duplicate.'
            ),
          ],
        });
        return;
      }
      throw e;
    }

    const fights = db
      .prepare(`SELECT * FROM fights WHERE event_id = ? ORDER BY sort_order, id`)
      .all(event.id);

    await interaction.editReply({
      embeds: [
        okEmbed(
          'Card imported',
          `**${imported.fights.length}** bout(s) from [ufc.com](${imported.sourceUrl}).`
        ),
        eventCardEmbed(event, fights, formatPredictionSchedule(event.event_date)),
      ],
    });
  },
};
