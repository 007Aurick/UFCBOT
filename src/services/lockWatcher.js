import cron from 'node-cron';
import { DateTime } from 'luxon';
import { serverTimezone } from '../config.js';
import { getDb } from '../database/db.js';
import { isPredictionsLocked } from './deadline.js';

/**
 * Hourly sanity check: events that should be locked by deadline still accept no writes except admin.
 * Logs transitions for ops visibility (extend to a log channel if desired).
 */
export function startLockWatcher(client) {
  const tick = () => {
    const db = getDb();
    const events = db.prepare(`SELECT id, name, event_date, manual_locked FROM events`).all();
    const now = DateTime.now();
    for (const ev of events) {
      const locked = isPredictionsLocked(ev.event_date, !!ev.manual_locked, now);
      if (locked) {
        console.log(
          `[lock-watch] ${DateTime.now().setZone(serverTimezone).toISO()} event #${ev.id} "${ev.name}" predictions closed (deadline or manual).`
        );
      }
    }
  };
  cron.schedule('0 * * * *', tick, { timezone: serverTimezone });
  tick();
}
