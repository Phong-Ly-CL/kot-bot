import express from 'express';
import { punch, checkWorkingHours } from './kot.js';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Environment variables
const KOT_URL = process.env.KOT_URL || "https://s2.kingtime.jp/independent/recorder/personal/";
const KOT_ID = process.env.KOT_ID;
const KOT_PASS = process.env.KOT_PASS;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const AUTO_PUNCH_OUT_ENABLED = process.env.AUTO_PUNCH_OUT_ENABLED === 'true';
const MAX_WORK_HOURS = parseInt(process.env.MAX_WORK_HOURS) || 10;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Store scheduled punch-outs (in-memory, will reset on restart)
const scheduledPunchOuts = new Map();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'KING OF TIME bot is running!',
    features: {
      autoPunchOut: AUTO_PUNCH_OUT_ENABLED,
      maxHours: MAX_WORK_HOURS
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Keep-alive endpoint for Uptime Robot
app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'awake',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    autoPunchOut: AUTO_PUNCH_OUT_ENABLED
  });
});

// Ping endpoint (alternative for monitoring services)
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Slack slash command handler
app.post('/slack/punch', async (req, res) => {
  try {
    const { command, text = '', user_id } = req.body;

    // Basic verification (in production, verify Slack signature)
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
          const remainingMin = Math.round(remainingMs / 60000);

          return res.json({
            response_type: 'ephemeral',
            text: `⏰ You have a scheduled punch-out at ${schedule.time} JST\n📅 Target: ${schedule.targetDate.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })}\n⏱️ Remaining: ~${remainingMin} minutes`
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
          text: `✅ Cancelled scheduled punch-out at ${schedule.time} JST`
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

// Manual punch endpoint (for testing)
app.post('/punch/:action', async (req, res) => {
  const { action } = req.params;
  
  if (!['in', 'out'].includes(action)) {
    return res.status(400).json({ error: 'Action must be "in" or "out"' });
  }

  if (!KOT_ID || !KOT_PASS) {
    return res.status(400).json({ error: 'KOT credentials not configured' });
  }

  try {
    await punch(KOT_URL, KOT_ID, KOT_PASS, action);
    res.json({ success: true, message: `Punched ${action} successfully` });
  } catch (error) {
    console.error(`Manual punch ${action} error:`, error);
    res.status(500).json({ error: `Failed to punch ${action}` });
  }
});

// Status endpoint
app.get('/status', async (req, res) => {
  if (!KOT_ID || !KOT_PASS) {
    return res.status(400).json({ error: 'KOT credentials not configured' });
  }

  try {
    const status = await checkWorkingHours(KOT_URL, KOT_ID, KOT_PASS);
    res.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Scheduled punch-outs endpoint
app.get('/scheduled', (req, res) => {
  const scheduled = [];

  for (const [userId, schedule] of scheduledPunchOuts.entries()) {
    scheduled.push({
      userId,
      time: schedule.time,
      targetDate: schedule.targetDate,
      createdAt: schedule.createdAt
    });
  }

  res.json({
    count: scheduled.length,
    scheduled
  });
});

// Helper function to send Slack notifications
async function sendSlackNotification(message) {
  if (!SLACK_WEBHOOK_URL) return;

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

// Schedule punch-out function
function scheduleOutPunch(userId, timeString) {
  // Parse time string (HH:MM format)
  const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})$/);

  if (!timeMatch) {
    return { success: false, error: 'Invalid time format. Use HH:MM (e.g., 19:00)' };
  }

  const [, hours, minutes] = timeMatch;
  const hour = parseInt(hours);
  const minute = parseInt(minutes);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { success: false, error: 'Invalid time. Hours: 0-23, Minutes: 0-59' };
  }

  // Create target time in JST (UTC+9)
  const now = new Date();
  const jstOffset = 9 * 60; // JST is UTC+9
  const userOffset = now.getTimezoneOffset();
  const offsetDiff = jstOffset + userOffset;

  // Create target date in JST
  const targetJST = new Date(now.getTime() + offsetDiff * 60 * 1000);
  targetJST.setHours(hour, minute, 0, 0);

  // Convert back to local time
  const targetLocal = new Date(targetJST.getTime() - offsetDiff * 60 * 1000);

  // If time has passed today, schedule for tomorrow
  if (targetLocal <= now) {
    targetLocal.setDate(targetLocal.getDate() + 1);
  }

  const delay = targetLocal.getTime() - now.getTime();

  // Cancel existing scheduled punch-out for this user
  if (scheduledPunchOuts.has(userId)) {
    clearTimeout(scheduledPunchOuts.get(userId).timeoutId);
  }

  // Schedule the punch-out
  const timeoutId = setTimeout(async () => {
    console.log(`Executing scheduled punch-out for user ${userId}`);

    try {
      await punch(KOT_URL, KOT_ID, KOT_PASS, 'out');
      console.log(`Scheduled punch-out successful for user ${userId}`);

      await sendSlackNotification(`✅ Scheduled punch-out completed at ${timeString} JST`);
    } catch (error) {
      console.error(`Scheduled punch-out failed for user ${userId}:`, error);
      await sendSlackNotification(`❌ Scheduled punch-out failed at ${timeString} JST`);
    }

    scheduledPunchOuts.delete(userId);
  }, delay);

  // Store the scheduled punch-out
  scheduledPunchOuts.set(userId, {
    timeoutId,
    time: timeString,
    targetDate: targetLocal,
    createdAt: now
  });

  return {
    success: true,
    time: timeString,
    delay,
    targetDate: targetLocal.toISOString()
  };
}

// Auto punch-out cron job - runs every hour
if (AUTO_PUNCH_OUT_ENABLED) {
  cron.schedule('0 * * * *', async () => {
    console.log('Running auto punch-out check...');
    
    if (!KOT_ID || !KOT_PASS) {
      console.log('KOT credentials not configured for auto punch-out');
      return;
    }

    try {
      const status = await checkWorkingHours(KOT_URL, KOT_ID, KOT_PASS);
      
      if (status.isPunchedIn && status.hoursWorked >= MAX_WORK_HOURS) {
        console.log(`Auto punching out after ${status.hoursWorked.toFixed(2)} hours`);
        
        await punch(KOT_URL, KOT_ID, KOT_PASS, "out");
        
        const message = `🚨 Auto punched out after ${status.hoursWorked.toFixed(2)} hours of work`;
        console.log(message);
        
        await sendSlackNotification(message);
        
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 KING OF TIME bot running on port ${PORT}`);
  console.log(`Auto punch-out: ${AUTO_PUNCH_OUT_ENABLED ? 'ENABLED' : 'DISABLED'}`);
});