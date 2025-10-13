import cron from 'node-cron';
import { punch, checkWorkingHours } from './kot.js';
import { punchInTimes, scheduledPunchOuts, sendSlackNotification } from './scheduler.js';
import { logger } from '../utils/logger.js';
import pkg from '@holiday-jp/holiday_jp';
const { isHoliday } = pkg;

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
    logger.logCode('audit', 'APN_IN001');
    return;
  }

  if (!KOT_ID || !KOT_PASS) {
    logger.logCode('audit', 'AUTH001');
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

  // Skip auto punch-in on weekends (Saturday = 6, Sunday = 0)
  const dayOfWeek = jstNow.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const dayName = dayOfWeek === 0 ? 'Sunday' : 'Saturday';
    logger.logCode('audit', 'APN_IN002', { day: dayName });
    return;
  }

  // Skip auto punch-in on Japanese public holidays
  if (isHoliday(jstNow)) {
    logger.logCode('audit', 'APN_IN003');
    return;
  }

  const targetTime = new Date(jstNow);
  targetTime.setHours(randomHour, randomMin, 0, 0);

  // If target time has passed today, skip (will try tomorrow)
  const timeString = `${String(randomHour).padStart(2, '0')}:${String(randomMin).padStart(2, '0')}`;
  if (targetTime <= jstNow) {
    logger.logCode('audit', 'APN_IN004', { time: timeString });
    return;
  }

  // Calculate delay in milliseconds
  const delay = targetTime - jstNow;

  logger.logCode('audit', 'APN_IN005', { time: timeString, minutes: Math.round(delay / 60000) });

  setTimeout(async () => {
    try {
      logger.logCode('audit', 'APN_IN006', { time: timeString });

      // Check if already punched in
      const status = await checkWorkingHours(punchInTimes);
      if (status.isPunchedIn) {
        logger.logCode('audit', 'APN_IN007');
        autoPunchInScheduled = false;
        return;
      }

      await punch(KOT_URL, KOT_ID, KOT_PASS, "in");

      // Store punch-in time with 'auto-punch-in' user ID
      const autoPunchInUserId = 'auto-punch-in';
      punchInTimes.set(autoPunchInUserId, new Date());

      logger.logCode('audit', 'APN_IN008', { time: timeString });
      await sendSlackNotification(`✅ Auto punched in at ${timeString} JST`);

      autoPunchInScheduled = false;
    } catch (error) {
      logger.logCode('error', 'ERR002', { error: error.message });
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
    logger.logCode('audit', 'APN_IN009');
    scheduleAutoPunchIn();
  }, {
    timezone: 'Asia/Tokyo'
  });

  logger.logCode('audit', 'APN_IN010', { start: AUTO_PUNCH_IN_TIME_START, end: AUTO_PUNCH_IN_TIME_END });
}

// Track if auto punch-out is scheduled
let autoPunchOutScheduled = false;

// Initialize auto punch-out scheduler
export function initAutoPunchOut() {
  const AUTO_PUNCH_OUT_ENABLED = process.env.AUTO_PUNCH_OUT_ENABLED === 'true';
  const MAX_WORK_HOURS = parseInt(process.env.MAX_WORK_HOURS) || 10;
  const AUTO_PUNCH_OUT_DELAY_MIN = parseInt(process.env.AUTO_PUNCH_OUT_DELAY_MIN) || 0;
  const AUTO_PUNCH_OUT_DELAY_MAX = parseInt(process.env.AUTO_PUNCH_OUT_DELAY_MAX) || 30;
  const KOT_URL = process.env.KOT_URL;
  const KOT_ID = process.env.KOT_ID;
  const KOT_PASS = process.env.KOT_PASS;

  if (!AUTO_PUNCH_OUT_ENABLED) return;

  cron.schedule('*/5 * * * *', async () => {
    logger.logCode('audit', 'APN_OUT001');

    if (!KOT_ID || !KOT_PASS) {
      logger.logCode('audit', 'AUTH002');
      return;
    }

    try {
      const status = await checkWorkingHours(punchInTimes);

      if (status.isPunchedIn && status.hoursWorked >= MAX_WORK_HOURS) {
        // Check if there's a scheduled punch-out - if yes, respect it
        if (scheduledPunchOuts.size > 0) {
          logger.logCode('audit', 'APN_OUT002', { hours: status.hoursWorked.toFixed(2) });
          return;
        }

        // Check if auto punch-out is already scheduled
        if (autoPunchOutScheduled) {
          logger.logCode('audit', 'APN_OUT003');
          return;
        }

        // Generate random delay in minutes
        const delayMinutes = Math.floor(Math.random() * (AUTO_PUNCH_OUT_DELAY_MAX - AUTO_PUNCH_OUT_DELAY_MIN + 1)) + AUTO_PUNCH_OUT_DELAY_MIN;
        const delayMs = delayMinutes * 60 * 1000;

        logger.logCode('audit', 'APN_OUT004', { hours: status.hoursWorked.toFixed(2), minutes: delayMinutes });
        autoPunchOutScheduled = true;

        setTimeout(async () => {
          try {
            // Double-check status before punching out
            const currentStatus = await checkWorkingHours(punchInTimes);

            if (!currentStatus.isPunchedIn) {
              logger.logCode('audit', 'APN_OUT005');
              autoPunchOutScheduled = false;
              return;
            }

            if (scheduledPunchOuts.size > 0) {
              logger.logCode('audit', 'APN_OUT006');
              autoPunchOutScheduled = false;
              return;
            }

            await punch(KOT_URL, KOT_ID, KOT_PASS, "out");

            // Clear the punch-in time after successful auto punch-out
            if (currentStatus.userId) {
              punchInTimes.delete(currentStatus.userId);
            }

            logger.logCode('audit', 'APN_OUT007', { hours: currentStatus.hoursWorked.toFixed(2) });

            await sendSlackNotification(`🚨 Auto punched out after ${currentStatus.hoursWorked.toFixed(2)} hours of work`);
            autoPunchOutScheduled = false;
          } catch (error) {
            logger.logCode('error', 'ERR003', { error: error.message });
            autoPunchOutScheduled = false;
          }
        }, delayMs);

      } else if (status.isPunchedIn) {
        logger.logCode('audit', 'APN_OUT008', { hours: status.hoursWorked.toFixed(2), max: MAX_WORK_HOURS });
      } else {
        logger.logCode('audit', 'APN_OUT009');
      }

    } catch (error) {
      logger.logCode('error', 'ERR004', { error: error.message });
    }
  }, {
    timezone: 'Asia/Tokyo'
  });

  logger.logCode('audit', 'APN_OUT010', { maxHours: MAX_WORK_HOURS, minDelay: AUTO_PUNCH_OUT_DELAY_MIN, maxDelay: AUTO_PUNCH_OUT_DELAY_MAX });
}
