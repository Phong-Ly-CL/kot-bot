import cron from 'node-cron';
import { punch, checkWorkingHours } from './kot.js';
import { punchInTimes, scheduledPunchOuts, sendSlackNotification } from './scheduler.js';

// Auto punch-in scheduled flag
let autoPunchInScheduled = false;

// Schedule auto punch-in
export function scheduleAutoPunchIn() {
  const AUTO_PUNCH_IN_ENABLED = process.env.AUTO_PUNCH_IN_ENABLED === 'true';
  const AUTO_PUNCH_IN_TIME_START = process.env.AUTO_PUNCH_IN_TIME_START || '08:30';
  const AUTO_PUNCH_IN_TIME_END = process.env.AUTO_PUNCH_IN_TIME_END || '09:30';
  const KOT_URL = process.env.KOT_URL;
  const KOT_ID = process.env.KOT_ID;
  const KOT_PASS = process.env.KOT_PASS;

  if (!AUTO_PUNCH_IN_ENABLED) return;

  if (autoPunchInScheduled) {
    console.log('Auto punch-in already scheduled for today');
    return;
  }

  if (!KOT_ID || !KOT_PASS) {
    console.log('KOT credentials not configured for auto punch-in');
    return;
  }

  // Parse start and end times (HH:MM format in JST)
  const [startHour, startMin] = AUTO_PUNCH_IN_TIME_START.split(':').map(Number);
  const [endHour, endMin] = AUTO_PUNCH_IN_TIME_END.split(':').map(Number);

  // Calculate time range in minutes
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Generate random time within range
  const randomMinutes = Math.floor(Math.random() * (endMinutes - startMinutes)) + startMinutes;
  const randomHour = Math.floor(randomMinutes / 60);
  const randomMin = randomMinutes % 60;

  // Create target time in JST
  const now = new Date();
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const targetTime = new Date(jstNow);
  targetTime.setHours(randomHour, randomMin, 0, 0);

  // If target time has passed today, skip (will try tomorrow)
  if (targetTime <= jstNow) {
    console.log(`Auto punch-in time ${randomHour}:${String(randomMin).padStart(2, '0')} already passed for today`);
    return;
  }

  // Calculate delay in milliseconds
  const delay = targetTime - jstNow;
  const timeString = `${String(randomHour).padStart(2, '0')}:${String(randomMin).padStart(2, '0')}`;

  console.log(`🎲 Auto punch-in scheduled at ${timeString} JST (in ${Math.round(delay / 60000)} minutes)`);

  setTimeout(async () => {
    try {
      console.log(`⏰ Executing auto punch-in at ${timeString} JST`);

      // Check if already punched in
      const status = await checkWorkingHours(punchInTimes);
      if (status.isPunchedIn) {
        console.log('Already punched in - skipping auto punch-in');
        autoPunchInScheduled = false;
        return;
      }

      await punch(KOT_URL, KOT_ID, KOT_PASS, "in");

      // Store punch-in time with 'auto-punch-in' user ID
      const autoPunchInUserId = 'auto-punch-in';
      punchInTimes.set(autoPunchInUserId, new Date());

      const message = `✅ Auto punched in at ${timeString} JST`;
      console.log(message);
      await sendSlackNotification(message);

      autoPunchInScheduled = false;
    } catch (error) {
      console.error('Error in auto punch-in:', error);
      autoPunchInScheduled = false;
    }
  }, delay);

  autoPunchInScheduled = true;
}

// Initialize auto punch-in scheduler
export function initAutoPunchIn() {
  const AUTO_PUNCH_IN_ENABLED = process.env.AUTO_PUNCH_IN_ENABLED === 'true';
  const AUTO_PUNCH_IN_TIME_START = process.env.AUTO_PUNCH_IN_TIME_START || '08:30';
  const AUTO_PUNCH_IN_TIME_END = process.env.AUTO_PUNCH_IN_TIME_END || '09:30';

  if (!AUTO_PUNCH_IN_ENABLED) return;

  // Schedule on startup
  scheduleAutoPunchIn();

  // Check daily at midnight JST to schedule next day's punch-in
  cron.schedule('0 0 * * *', () => {
    console.log('Midnight JST - checking if need to schedule auto punch-in');
    scheduleAutoPunchIn();
  }, {
    timezone: 'Asia/Tokyo'
  });

  console.log(`Auto punch-in enabled: random time between ${AUTO_PUNCH_IN_TIME_START} and ${AUTO_PUNCH_IN_TIME_END} JST`);
}

// Initialize auto punch-out scheduler
export function initAutoPunchOut() {
  const AUTO_PUNCH_OUT_ENABLED = process.env.AUTO_PUNCH_OUT_ENABLED === 'true';
  const MAX_WORK_HOURS = parseInt(process.env.MAX_WORK_HOURS) || 10;
  const KOT_URL = process.env.KOT_URL;
  const KOT_ID = process.env.KOT_ID;
  const KOT_PASS = process.env.KOT_PASS;

  if (!AUTO_PUNCH_OUT_ENABLED) return;

  cron.schedule('0 * * * *', async () => {
    console.log('Running auto punch-out check...');

    if (!KOT_ID || !KOT_PASS) {
      console.log('KOT credentials not configured for auto punch-out');
      return;
    }

    try {
      const status = await checkWorkingHours(punchInTimes);

      if (status.isPunchedIn && status.hoursWorked >= MAX_WORK_HOURS) {
        // Check if there's a scheduled punch-out - if yes, respect it
        if (scheduledPunchOuts.size > 0) {
          console.log(`Worked ${status.hoursWorked.toFixed(2)} hours, but scheduled punch-out exists - skipping auto punch-out`);
        } else {
          console.log(`Worked ${status.hoursWorked.toFixed(2)} hours - triggering auto punch-out`);

          await punch(KOT_URL, KOT_ID, KOT_PASS, "out");

          // Clear the punch-in time after successful auto punch-out
          if (status.userId) {
            punchInTimes.delete(status.userId);
          }

          const message = `🚨 Auto punched out after ${status.hoursWorked.toFixed(2)} hours of work`;
          console.log(message);

          await sendSlackNotification(message);
        }
      } else if (status.isPunchedIn) {
        console.log(`Currently punched in for ${status.hoursWorked.toFixed(2)} hours (under ${MAX_WORK_HOURS}h limit)`);
      } else {
        console.log('Not currently punched in');
      }

    } catch (error) {
      console.error('Error in auto punch-out check:', error);
    }
  });

  console.log(`Auto punch-out enabled: will punch out after ${MAX_WORK_HOURS} hours`);
}
