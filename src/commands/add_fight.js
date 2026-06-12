import { SlashCommandBuilder } from 'discord.js';
import { getDb } from '../database/db.js';
import { parseVersus } from '../utils/fighters.js';
import { errorEmbed, okEmbed, eventCardEmbed } from '../utils/embeds.js';
import { formatPredictionSchedule } from '../services/deadline.js';
import { isAdminMember } from '../utils/permissions.js';
import { resolveEvent } from '../services/eventQueries.js';

export const addFightCommand = {
  data: new SlashCommandBuilder()
    .setName('add_fight')
    .setDescription('[Admin] Add a fight to an event')
    .setDMPermission(false)
    .setDefaultMemberPermissions(0)
    .addStringOption((o) =>
      o.setName('event').setDescription('Event').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((o) =>
      o
        .setName('fight_type')
        .setDescription('Fight slot type')
        .setRequired(true)
        .addChoices(
          { name: 'Prelim (+2 pts)', value: 'prelim' },
          { name: 'Main card (+5 pts)', value: 'main' },
          { name: 'Title fight (+10 pts)', value: 'title' }
        )
    )
    .addStringOption((o) =>
      o
        .setName('fighters')
        .setDescription('Matchup: "Fighter A vs Fighter B"')
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!isAdminMember(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });
      return;
    }
    const guildId = interaction.guildId;
    const eventKey = interaction.options.getString('event', true);
    const fightType = interaction.options.getString('fight_type', true);
    const fightersStr = interaction.options.getString('fighters', true);

    const event = resolveEvent(guildId, eventKey);
    if (!event) {
      await interaction.reply({ embeds: [errorEmbed('Unknown event.')], ephemeral: true });
      return;
    }

    const parsed = parseVersus(fightersStr);
    if (!parsed) {
      await interaction.reply({
        embeds: [errorEmbed('Use format `Fighter A vs Fighter B`.')],
        ephemeral: true,
      });
      return;
    }

    const db = getDb();
    const maxRow = db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM fights WHERE event_id = ?`)
      .get(event.id);
    const next = (maxRow?.m ?? -1) + 1;
    try {
      db.prepare(
        `INSERT INTO fights (event_id, fight_type, fighter_a, fighter_b, sort_order) VALUES (?,?,?,?,?)`
      ).run(event.id, fightType, parsed.fighterA, parsed.fighterB, next);
    } catch (e) {
      if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        await interaction.reply({
          embeds: [errorEmbed('This matchup already exists on the event.')],
          ephemeral: true,
        });
        return;
      }
      throw e;
    }

    const fights = db.prepare(`SELECT * FROM fights WHERE event_id = ? ORDER BY sort_order, id`).all(event.id);
    await interaction.reply({
      embeds: [
        okEmbed('Fight added', `${parsed.fighterA} vs ${parsed.fighterB} (${fightType})`),
        eventCardEmbed(event, fights, formatPredictionSchedule(event.event_date)),
      ],
    });
  },
};
