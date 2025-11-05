import express from 'express';
import { punch } from '../services/kot.js';
import { verifySlackSignature } from '../middleware/auth.js';
import { punchInTimes, scheduleOutPunch, scheduledPunchOuts, sendSlackNotification } from '../services/scheduler.js';
import { formatDateTimeJST, formatSecondsToHHMMSS } from '../utils.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Slack slash command handler
router.post('/punch', verifySlackSignature, async (req, res) => {
  const KOT_ID = process.env.KOT_ID;
  const KOT_PASS = process.env.KOT_PASS;
  const KOT_URL = process.env.KOT_URL;
  const MAX_WORK_HOURS = parseInt(process.env.MAX_WORK_HOURS) || 10;
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  try {
    const { command, text = '', user_id } = req.body;

    // Basic validation
    if (!command || !user_id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Parse command and check for scheduled time or cancel
    const textParts = text.trim().split(/\s+/);
    let action;
    let scheduledTime = null;
    let cancelSchedule = false;

    if (command === '/punch-in') {
      action = 'in';
    } else if (command === '/punch-out') {
      action = 'out';
      // Check for cancel
      if (textParts[0]?.toLowerCase() === 'cancel') {
        cancelSchedule = true;
      } else {
        // Check for @ time syntax: /punch-out @ 19:00
        const atIndex = textParts.indexOf('@');
        if (atIndex !== -1 && textParts[atIndex + 1]) {
          scheduledTime = textParts[atIndex + 1];
        }
      }
    } else if (command === '/punch') {
      action = textParts[0]?.toLowerCase();

      // Check for status: /punch status
      if (action === 'status') {
        if (scheduledPunchOuts.has(user_id)) {
          const schedule = scheduledPunchOuts.get(user_id);
          const now = new Date();
          const remainingMs = schedule.targetDate - now;
          const remainingSec = Math.floor(remainingMs / 1000);
          const remainingFormatted = formatSecondsToHHMMSS(remainingSec);

          return res.json({
            response_type: 'ephemeral',
            text: `⏰ You have a scheduled punch-out at ${schedule.time} JST\n📅 Target: ${formatDateTimeJST(schedule.targetDate)}\n⏱️ Remaining: ${remainingFormatted}`
          });
        } else {
          return res.json({
            response_type: 'ephemeral',
            text: "ℹ️ No scheduled punch-out found"
          });
        }
      }

      // Check for remind: /punch remind HH:MM
      if (action === 'remind') {
        const timeStr = textParts[1];
        if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
          return res.json({
            response_type: 'ephemeral',
            text: "❌ Invalid time format. Usage: `/punch remind HH:MM` (e.g., `/punch remind 09:00`)"
          });
        }

        try {
          // Parse the time (HH:MM format in JST)
          const [hours, minutes] = timeStr.split(':').map(Number);

          if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return res.json({
              response_type: 'ephemeral',
              text: "❌ Invalid time. Hours must be 0-23, minutes must be 0-59."
            });
          }

          // Create target time in JST for today
          const now = new Date();
          const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
          const punchInTime = new Date(jstNow);
          punchInTime.setHours(hours, minutes, 0, 0);

          // If the time is in the future today, it might be wrong - warn user
          if (punchInTime > jstNow) {
            return res.json({
              response_type: 'ephemeral',
              text: `⚠️ Warning: ${timeStr} is in the future. Are you sure you punched in at this time?\n💡 If you meant earlier today, the time looks correct.\n💡 If you meant to set a past time, please use a time earlier than now (${jstNow.getHours()}:${String(jstNow.getMinutes()).padStart(2, '0')})`
            });
          }

          // Store the punch-in time
          punchInTimes.set(user_id, punchInTime);
          logger.logCode('audit', 'MAN004', { userId: user_id, reminderTime: timeStr, timestamp: punchInTime.toISOString() });

          // Calculate hours worked
          const secondsWorked = (jstNow - punchInTime) / 1000;
          const hoursWorked = secondsWorked / 3600;
          const workDuration = formatSecondsToHHMMSS(secondsWorked);

          return res.json({
            response_type: 'ephemeral',
            text: `✅ Punch-in time set to ${timeStr} JST\n⏱️ Current work duration: ${workDuration} (${hoursWorked.toFixed(2)} hours)\n💡 Auto punch-out will trigger after ${MAX_WORK_HOURS} hours`
          });
        } catch (error) {
          return res.json({
            response_type: 'ephemeral',
            text: `❌ Failed to set punch-in time: ${error.message}`
          });
        }
      }

      // Check for cancel: /punch cancel or /punch out cancel
      if (action === 'cancel' || (action === 'out' && textParts[1]?.toLowerCase() === 'cancel')) {
        action = 'out';
        cancelSchedule = true;
      } else if (!['in', 'out', 'status', 'remind'].includes(action)) {
        return res.json({
          response_type: 'ephemeral',
          text: "❌ Please specify 'in', 'out', 'status', 'remind', or 'cancel'. Usage: `/punch in` or `/punch out @ HH:MM` or `/punch status` or `/punch remind HH:MM` or `/punch cancel`"
        });
      } else if (action === 'out') {
        // Check for @ time syntax: /punch out @ 19:00
        const atIndex = textParts.indexOf('@');
        if (atIndex !== -1 && textParts[atIndex + 1]) {
          scheduledTime = textParts[atIndex + 1];
        }
      }
    } else {
      return res.status(400).json({ error: 'Unknown command' });
    }

    // Check credentials
    if (!KOT_ID || !KOT_PASS) {
      return res.json({
        response_type: 'ephemeral',
        text: "❌ KING OF TIME credentials not configured."
      });
    }

    // Handle cancel scheduled punch-out
    if (cancelSchedule) {
      if (scheduledPunchOuts.has(user_id)) {
        const schedule = scheduledPunchOuts.get(user_id);
        clearTimeout(schedule.timeoutId);
        scheduledPunchOuts.delete(user_id);

        return res.json({
          response_type: 'ephemeral',
          text: `✅ Cancelled scheduled punch-out at ${schedule.time} JST\n💡 Auto punch-out (after ${MAX_WORK_HOURS}h) is now active`
        });
      } else {
        return res.json({
          response_type: 'ephemeral',
          text: "❌ No scheduled punch-out found to cancel"
        });
      }
    }

    // Handle scheduled punch-out
    if (scheduledTime && action === 'out') {
      try {
        const scheduleResult = scheduleOutPunch(user_id, scheduledTime);

        if (scheduleResult.success) {
          return res.json({
            response_type: 'ephemeral',
            text: `⏰ Scheduled punch out at ${scheduleResult.time} JST (${scheduleResult.delay}ms from now)`
          });
        } else {
          return res.json({
            response_type: 'ephemeral',
            text: `❌ ${scheduleResult.error}`
          });
        }
      } catch (error) {
        return res.json({
          response_type: 'ephemeral',
          text: `❌ Failed to schedule: ${error.message}`
        });
      }
    }

    // Immediate response for instant punch
    res.json({
      response_type: 'ephemeral',
      text: `⏰ Punching ${action}... Please wait...`
    });

    // Perform punch operation
    try {
      await punch(KOT_URL, KOT_ID, KOT_PASS, action);
      logger.logCode('audit', 'MAN001', { action, userId: user_id });

      // Store punch-in time or clear it on punch-out
      if (action === 'in') {
        punchInTimes.set(user_id, new Date());
        logger.logCode('audit', 'MAN002', { userId: user_id, timestamp: new Date().toISOString() });
      } else if (action === 'out') {
        punchInTimes.delete(user_id);
        logger.logCode('audit', 'MAN003', { userId: user_id });
      }

      // Send follow-up notification if webhook is configured
      if (SLACK_WEBHOOK_URL) {
        await sendSlackNotification(`✅ Successfully punched ${action} ${action === 'in' ? 'to' : 'from'} KING OF TIME!`);
      }
    } catch (error) {
      logger.logCode('error', 'ERR006', { action, error: error.message });

      if (SLACK_WEBHOOK_URL) {
        await sendSlackNotification(`❌ Failed to punch ${action}. Please try again.`);
      }
    }

  } catch (error) {
    logger.logCode('error', 'ERR007', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
