import express from 'express';
import { punch } from '../services/kot.js';
import { verifySlackSignature } from '../middleware/auth.js';
import { punchInTimes, scheduleOutPunch, scheduledPunchOuts, sendSlackNotification } from '../services/scheduler.js';
import { formatDateTimeJST, formatSecondsToHHMMSS } from '../utils.js';

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

      // Check for cancel: /punch cancel or /punch out cancel
      if (action === 'cancel' || (action === 'out' && textParts[1]?.toLowerCase() === 'cancel')) {
        action = 'out';
        cancelSchedule = true;
      } else if (!['in', 'out', 'status'].includes(action)) {
        return res.json({
          response_type: 'ephemeral',
          text: "❌ Please specify 'in', 'out', 'status', or 'cancel'. Usage: `/punch in` or `/punch out @ HH:MM` or `/punch status` or `/punch cancel`"
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
      console.log(`Successfully punched ${action} for user ${user_id}`);

      // Store punch-in time or clear it on punch-out
      if (action === 'in') {
        punchInTimes.set(user_id, new Date());
        console.log(`Stored punch-in time for user ${user_id}: ${new Date().toISOString()}`);
      } else if (action === 'out') {
        punchInTimes.delete(user_id);
        console.log(`Cleared punch-in time for user ${user_id}`);
      }

      // Send follow-up notification if webhook is configured
      if (SLACK_WEBHOOK_URL) {
        await sendSlackNotification(`✅ Successfully punched ${action} ${action === 'in' ? 'to' : 'from'} KING OF TIME!`);
      }
    } catch (error) {
      console.error(`Punch ${action} error:`, error);

      if (SLACK_WEBHOOK_URL) {
        await sendSlackNotification(`❌ Failed to punch ${action}. Please try again.`);
      }
    }

  } catch (error) {
    console.error('Error processing Slack request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
