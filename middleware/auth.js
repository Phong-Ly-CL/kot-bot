import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// API Secret authentication middleware
export function verifyApiSecret(req, res, next) {
  const API_SECRET = process.env.API_SECRET;

  if (!API_SECRET) {
    return next();
  }

  const apiSecret = req.headers['x-api-secret'] || req.query.secret;

  if (apiSecret !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized - Invalid or missing API secret' });
  }

  next();
}

// Slack signature verification middleware
export function verifySlackSignature(req, res, next) {
  const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

  if (!SLACK_SIGNING_SECRET) {
    logger.logCode('warn', 'AUTH003');
    return next();
  }

  const slackSignature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];

  if (!slackSignature || !timestamp) {
    return res.status(401).json({ error: 'Unauthorized - Missing Slack signature' });
  }

  // Prevent replay attacks (request older than 5 minutes)
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - timestamp) > 300) {
    return res.status(401).json({ error: 'Unauthorized - Request too old' });
  }

  // Verify signature
  const sigBasestring = `v0:${timestamp}:${req.rawBody}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  if (crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature))) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized - Invalid Slack signature' });
}
