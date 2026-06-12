import { EmbedBuilder, Colors } from 'discord.js';

export function errorEmbed(message) {
  return new EmbedBuilder().setColor(Colors.Red).setDescription(message);
}

export function okEmbed(title, body) {
  return new EmbedBuilder().setColor(Colors.Green).setTitle(title).setDescription(body);
}

export function infoEmbed(title, body) {
  return new EmbedBuilder().setColor(Colors.Blurple).setTitle(title).setDescription(body);
}

export function eventCardEmbed(event, fights, predictionScheduleText) {
  const lines =
    fights.length === 0
      ? '_No fights added yet._'
      : fights
          .map((f) => {
            const tag = f.fight_type === 'title' ? 'TITLE' : f.fight_type === 'main' ? 'MAIN' : 'PRE';
            return `**[${tag}]** ${f.fighter_a} vs ${f.fighter_b}`;
          })
          .join('\n');
  const desc = lines.slice(0, 3900);
  return new EmbedBuilder()
    .setColor(Colors.DarkButNotBlack)
    .setTitle(`UFC — ${event.name}`)
    .setDescription(desc)
    .addFields(
      { name: 'Date', value: event.event_date, inline: true },
      { name: 'Type', value: event.type.toUpperCase(), inline: true },
      { name: 'Predictions', value: predictionScheduleText.slice(0, 1024), inline: false }
    );
}

export function leaderboardEmbed(title, rows, footer) {
  const body =
    rows.length === 0
      ? '_No scores yet._'
      : rows
          .map((r, i) => {
            const acc = r.total > 0 ? ((r.correct / r.total) * 100).toFixed(1) : '0.0';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const perfect = r.perfect_card ? ' 🏆' : '';
            const streakNote = Object.hasOwn(r, 'streak') ? ` · streak ${Number(r.streak)}` : '';
            return `${medal} <@${r.user_id}> — **${r.points}** pts · ${r.correct}/${r.total} correct · ${acc}%${perfect}${streakNote}`;
          })
          .join('\n')
          .slice(0, 4000);
  const e = new EmbedBuilder().setColor(Colors.Gold).setTitle(title).setDescription(body);
  if (footer) e.setFooter({ text: footer });
  return e;
}
