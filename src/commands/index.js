import { predictCommand } from './predict.js';
import { createEventCommand } from './create_event.js';
import { addFightCommand } from './add_fight.js';
import { closePredictionsCommand } from './close_predictions.js';
import { setResultCommand } from './set_result.js';
import { leaderboardCommand } from './leaderboard.js';
import { recalculateScoresCommand } from './recalculate_scores.js';
import { cardCommand } from './card.js';
import { resultsCommand } from './results.js';
import { importUfcCardCommand } from './import_ufc_card.js';

export const commands = [
  predictCommand,
  createEventCommand,
  addFightCommand,
  closePredictionsCommand,
  setResultCommand,
  leaderboardCommand,
  recalculateScoresCommand,
  cardCommand,
  resultsCommand,
  importUfcCardCommand,
];
