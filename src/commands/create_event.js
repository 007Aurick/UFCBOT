import { SlashCommandBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import { getDb } from '../database/db.js';
import { serverTimezone } from '../config.js';
import { slugify } from '../utils/fighters.js';
import { errorEmbed, okEmbed, eventCardEmbed } from '../utils/embeds.js';
import { formatPredictionSchedule } from '../services/deadline.js';
import { isAdminMember } from '../utils/permissions.js';
export const createEventCommand = {
  data: new SlashCommandBuilder()
    .setName('create_event')
    .setDescription('[Admin] Create a new UFC prediction event')
    .setDMPermission(false)
    .setDefaultMemberPermissions(0)
    .addStringOption((o) => o.setName('name').setDescription('Display name').setRequired(true))
    .addStringOption((o) =>
      o.setName('date').setDescription('Card date YYYY-MM-DD (server timezone)').setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Card type')
        .setRequired(true)
        .addChoices(
          { name: 'Fight Night', value: 'fightnight' },
          { name: 'PPV', value: 'ppv' }
        )
    ),
  async execute(interaction) {
    if (!isAdminMember(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });
      return;
    }
    const guildId = interaction.guildId;
    const name = interaction.options.getString('name', true).trim();
    const dateStr = interaction.options.getString('date', true).trim();
    const type = interaction.options.getString('type', true);

    const parsed = DateTime.fromISO(dateStr, { zone: serverTimezone });
    if (!parsed.isValid) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid date. Use **YYYY-MM-DD** in the configured server timezone.')],
        ephemeral: true,
      });
      return;
    }

    const slug = slugify(name);
    const db = getDb();
    try {
      const info = db
        .prepare(
          `INSERT INTO events (guild_id, name, slug, event_date, type) VALUES (?, ?, ?, ?, ?)`
        )
        .run(guildId, name, slug, parsed.toISODate(), type);
      const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(info.lastInsertRowid);
      const fights = [];
      const embed = eventCardEmbed(event, fights, formatPredictionSchedule(event.event_date));
      await interaction.reply({ embeds: [okEmbed('Event created', `Slug: **${slug}**`), embed] });
    } catch (e) {
      if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        await interaction.reply({
          embeds: [errorEmbed('An event with this name (slug) already exists in this server.')],
          ephemeral: true,
        });
        return;
      }
      throw e;
    }
  },
};
