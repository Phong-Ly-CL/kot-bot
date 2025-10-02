import express from 'express';
import { punch, checkWorkingHours } from '../services/kot.js';
import { verifyApiSecret } from '../middleware/auth.js';
import { punchInTimes, scheduledPunchOuts } from '../services/scheduler.js';
import { formatDateTimeJST, formatSecondsToHHMMSS } from '../utils.js';

const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
  const AUTO_PUNCH_IN_ENABLED = process.env.AUTO_PUNCH_IN_ENABLED === 'true';
  const AUTO_PUNCH_IN_TIME_START = process.env.AUTO_PUNCH_IN_TIME_START || '08:30';
  const AUTO_PUNCH_IN_TIME_END = process.env.AUTO_PUNCH_IN_TIME_END || '09:30';
  const AUTO_PUNCH_OUT_ENABLED = process.env.AUTO_PUNCH_OUT_ENABLED === 'true';
  const MAX_WORK_HOURS = parseInt(process.env.MAX_WORK_HOURS) || 10;

  res.json({
    status: 'KING OF TIME bot is running!',
    features: {
      autoPunchIn: AUTO_PUNCH_IN_ENABLED,
      autoPunchInWindow: AUTO_PUNCH_IN_ENABLED ? `${AUTO_PUNCH_IN_TIME_START} - ${AUTO_PUNCH_IN_TIME_END} JST` : null,
      autoPunchOut: AUTO_PUNCH_OUT_ENABLED,
      maxHours: MAX_WORK_HOURS
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Keep-alive endpoint for Uptime Robot
router.get('/keep-alive', (req, res) => {
  const AUTO_PUNCH_OUT_ENABLED = process.env.AUTO_PUNCH_OUT_ENABLED === 'true';

  res.json({
    status: 'awake',
    time: formatDateTimeJST(new Date()),
    uptime: formatSecondsToHHMMSS(process.uptime()),
    autoPunchOut: AUTO_PUNCH_OUT_ENABLED
  });
});

// Ping endpoint (alternative for monitoring services)
router.get('/ping', (req, res) => {
  res.send('pong');
});

// Manual punch endpoint (for testing)
router.post('/punch/:action', verifyApiSecret, async (req, res) => {
  const { action } = req.params;
  const KOT_URL = process.env.KOT_URL;
  const KOT_ID = process.env.KOT_ID;
  const KOT_PASS = process.env.KOT_PASS;

  if (!['in', 'out'].includes(action)) {
    return res.status(400).json({ error: 'Action must be "in" or "out"' });
  }

  if (!KOT_ID || !KOT_PASS) {
    return res.status(400).json({ error: 'KOT credentials not configured' });
  }

  try {
    await punch(KOT_URL, KOT_ID, KOT_PASS, action);

    // Store punch-in time with default user ID for manual punches
    const defaultUserId = 'manual-user';
    if (action === 'in') {
      punchInTimes.set(defaultUserId, new Date());
      console.log(`Stored punch-in time for manual user: ${new Date().toISOString()}`);
    } else if (action === 'out') {
      punchInTimes.delete(defaultUserId);
      console.log(`Cleared punch-in time for manual user`);
    }

    res.json({ success: true, message: `Punched ${action} successfully` });
  } catch (error) {
    console.error(`Manual punch ${action} error:`, error);
    res.status(500).json({ error: `Failed to punch ${action}` });
  }
});

// Status endpoint
router.get('/status', verifyApiSecret, async (req, res) => {
  try {
    const status = await checkWorkingHours(punchInTimes);
    res.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Scheduled punch-outs endpoint
router.get('/scheduled', verifyApiSecret, (req, res) => {
  const scheduled = [];

  for (const [userId, schedule] of scheduledPunchOuts.entries()) {
    scheduled.push({
      userId,
      time: schedule.time,
      targetDate: formatDateTimeJST(schedule.targetDate),
      createdAt: formatDateTimeJST(schedule.createdAt)
    });
  }

  res.json({
    count: scheduled.length,
    scheduled
  });
});

export default router;
