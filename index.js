import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import slackRoutes from './routes/slack.js';
import { initAutoPunchIn, initAutoPunchOut } from './services/autoPunch.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to capture raw body for Slack signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({
  extended: true,
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Routes
app.use('/', apiRoutes);
app.use('/slack', slackRoutes);

// Initialize auto punch features
initAutoPunchIn();
initAutoPunchOut();

// Start server
app.listen(PORT, () => {
  const AUTO_PUNCH_IN_ENABLED = process.env.AUTO_PUNCH_IN_ENABLED === 'true';
  const AUTO_PUNCH_OUT_ENABLED = process.env.AUTO_PUNCH_OUT_ENABLED === 'true';

  console.log(`🚀 KING OF TIME bot running on port ${PORT}`);
  console.log(`Auto punch-in: ${AUTO_PUNCH_IN_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Auto punch-out: ${AUTO_PUNCH_OUT_ENABLED ? 'ENABLED' : 'DISABLED'}`);
});
