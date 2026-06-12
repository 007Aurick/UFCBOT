import { DateTime } from 'luxon';
import { serverTimezone } from '../config.js';

/**
 * Predictions open: 09:00:00 on the last calendar Sunday strictly before the event date
 * (SERVER_TIMEZONE). Typical Saturday cards → opens the prior Sunday morning.
 *
 * @param {string} eventDateIso - Calendar date of the card (YYYY-MM-DD)
 * @returns {DateTime}
 */
export function getPredictionOpenTime(eventDateIso) {
  const zone = serverTimezone;
  let eventDay = DateTime.fromISO(eventDateIso, { zone });
  if (!eventDay.isValid) {
    throw new Error(`Invalid event date: ${eventDateIso}`);
  }
  eventDay = eventDay.startOf('day');
  let d = eventDay.minus({ days: 1 });
  while (d.weekday !== 7) {
    d = d.minus({ days: 1 });
  }
  return d.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
}

/**
 * Prediction cutoff: 23:59:59.999 on the last calendar Friday strictly before the event date
 * (SERVER_TIMEZONE) — i.e. Friday night before fight night.
 *
 * @param {string} eventDateIso
 * @returns {DateTime}
 */
export function getPredictionDeadline(eventDateIso) {
  const zone = serverTimezone;
  let eventDay = DateTime.fromISO(eventDateIso, { zone });
  if (!eventDay.isValid) {
    throw new Error(`Invalid event date: ${eventDateIso}`);
  }
  eventDay = eventDay.startOf('day');
  let cursor = eventDay.minus({ days: 1 });
  while (cursor.weekday !== 5) {
    cursor = cursor.minus({ days: 1 });
  }
  return cursor.endOf('day');
}

/**
 * @param {string} eventDateIso
 * @param {boolean} manualLocked
 * @param {DateTime} [now]
 */
export function isPredictionsLocked(eventDateIso, manualLocked, now = DateTime.now()) {
  if (manualLocked) return true;
  const z = now.setZone(serverTimezone);
  if (z < getPredictionOpenTime(eventDateIso)) return true;
  if (z > getPredictionDeadline(eventDateIso)) return true;
  return false;
}

/** @returns {'manual'|'not_yet_open'|'deadline'|null} */
export function predictionLockReason(eventDateIso, manualLocked, now = DateTime.now()) {
  if (manualLocked) return 'manual';
  const z = now.setZone(serverTimezone);
  if (z < getPredictionOpenTime(eventDateIso)) return 'not_yet_open';
  if (z > getPredictionDeadline(eventDateIso)) return 'deadline';
  return null;
}

export function formatPredictionSchedule(eventDateIso) {
  const open = getPredictionOpenTime(eventDateIso);
  const close = getPredictionDeadline(eventDateIso);
  const fmt = DateTime.DATETIME_FULL_WITH_SECONDS;
  return `Opens: ${open.toLocaleString(fmt)}\nCloses: ${close.toLocaleString(fmt)}`;
}
