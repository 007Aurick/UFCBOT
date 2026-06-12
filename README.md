# UFCBOT

Discord bot for UFC fight predictions. Members pick winners on upcoming cards, compete on leaderboards, and earn points based on fight type.

## Features

- Slash commands for predictions, cards, and leaderboards
- Automatic prediction windows (open/close before each event)
- Import fight cards directly from [ufc.com](https://www.ufc.com)
- Scoring with streak bonuses and weekly/all-time leaderboards
- SQLite storage (no external database required)

## Requirements

- [Node.js](https://nodejs.org/) 20+
- A [Discord application](https://discord.com/developers/applications) with a bot token

## Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/007Aurick/UFCBOT.git
   cd UFCBOT
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `DISCORD_TOKEN` | Yes | Bot token from the Developer Portal |
   | `DISCORD_CLIENT_ID` | Yes | Application ID |
   | `DISCORD_GUILD_ID` | No | Server ID for instant slash-command updates |
   | `SERVER_TIMEZONE` | No | IANA timezone for deadlines (default: `UTC`) |
   | `DISCORD_ADMIN_ROLE_ID` | No | Role allowed to run admin commands |
   | `DATABASE_PATH` | No | SQLite file path (default: `./data/bot.sqlite`) |

3. **Register slash commands**

   ```bash
   npm run deploy-commands
   ```

4. **Start the bot**

   ```bash
   npm start
   ```

   The bot must stay running to appear online in Discord.

## Prediction schedule

For each event, predictions:

- **Open** — 9:00 AM on the last Sunday before the card date
- **Close** — 11:59 PM on the last Friday before the card date

Times use `SERVER_TIMEZONE`. Admins can lock predictions early with `/close_predictions`.

## Scoring

| Fight type | Points |
|------------|--------|
| Prelim | 2 |
| Main card | 5 |
| Title | 10 |

Scores finalize automatically once all fight results are entered. Weekly points reset every Monday at 00:05 server time.

## Commands

### Everyone

| Command | Description |
|---------|-------------|
| `/card` | View a fight card and prediction window |
| `/predict` | Pick a winner for a fight |
| `/leaderboard event` | Event standings |
| `/leaderboard global` | All-time server standings |
| `/leaderboard weekly` | This week's points |
| `/results` | View entered fight results |

### Admin

| Command | Description |
|---------|-------------|
| `/create_event` | Create a new prediction event |
| `/import_ufc_card` | Import fights from a ufc.com event URL |
| `/add_fight` | Manually add a bout |
| `/set_result` | Record a fight winner |
| `/close_predictions` | Manually lock an event |
| `/recalculate_scores` | Recompute scores for an event |

## Example workflow

1. `/create_event` — name, date (`YYYY-MM-DD`), type (Fight Night or PPV)
2. `/import_ufc_card` — paste the ufc.com event URL
3. Members use `/card` and `/predict` before the deadline
4. After the card, `/set_result` for each fight
5. `/leaderboard event` to see who won

**Example prediction:**

```
/predict event: UFC Freedom 250: Topuria vs Gaethje fight: Ilia Topuria vs Justin Gaethje winner: Ilia Topuria
```

## Project structure

```
src/
  commands/       Slash command handlers
  services/       Scoring, deadlines, UFC card import
  database/       SQLite schema and helpers
  events/         Discord event listeners
  index.js        Bot entry point
  deploy-commands.js
```

## Security

Never commit `.env` or database files. Both are listed in `.gitignore`.
