import cron from 'node-cron';
import { clearAuditLogs, getLogStats, logger } from '../utils/logger.js';

export function initLogCleanup() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', () => {
    const statsBefore = getLogStats();
    logger.logCode('info', 'LOG001', {
      audit: statsBefore.audit,
      info: statsBefore.info,
      warn: statsBefore.warn,
      error: statsBefore.error
    });

    const result = clearAuditLogs();

    logger.logCode('info', 'LOG002', { cleared: result.clearedCount, retained: result.remainingCount });
  }, {
    timezone: 'Asia/Tokyo'
  });

  logger.logCode('info', 'LOG003');
}
