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

    // Determine action
    let action;
    if (command === '/punch-in') {
      action = 'in';
    } else if (command === '/punch-out') {
      action = 'out';
    } else if (command === '/punch') {
      action = text.trim().toLowerCase();
      if (!['in', 'out'].includes(action)) {
        return res.json({
          response_type: 'ephemeral',
          text: "❌ Please specify 'in' or 'out'. Usage: `/punch in` or `/punch out`"
        });
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

    // Immediate response
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