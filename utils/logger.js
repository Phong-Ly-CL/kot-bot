import { formatLogMessage } from '../config/logMessages.js';

// Log levels (higher number = higher priority)
const LOG_LEVELS = {
  AUDIT: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Store logs with their levels
const logs = [];

// Original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};

// Custom logger that stores logs with levels
export const logger = {
  audit: (...args) => {
    const message = args.join(' ');
    logs.push({ level: LOG_LEVELS.AUDIT, message, timestamp: new Date() });
    originalConsole.log(...args);
  },

  info: (...args) => {
    const message = args.join(' ');
    logs.push({ level: LOG_LEVELS.INFO, message, timestamp: new Date() });
    originalConsole.info(...args);
  },

  warn: (...args) => {
    const message = args.join(' ');
    logs.push({ level: LOG_LEVELS.WARN, message, timestamp: new Date() });
    originalConsole.warn(...args);
  },

  error: (...args) => {
    const message = args.join(' ');
    logs.push({ level: LOG_LEVELS.ERROR, message, timestamp: new Date() });
    originalConsole.error(...args);
  },

  // Structured logging with message codes
  logCode: (level, code, params = {}) => {
    const formattedMessage = formatLogMessage(code, params);
    const logLevel = level.toUpperCase();

    switch (logLevel) {
      case 'AUDIT':
        logger.audit(formattedMessage);
        break;
      case 'INFO':
        logger.info(formattedMessage);
        break;
      case 'WARN':
        logger.warn(formattedMessage);
        break;
      case 'ERROR':
        logger.error(formattedMessage);
        break;
      default:
        logger.audit(formattedMessage);
    }
  }
};

// Clear audit level logs (keeps WARNING and above)
export function clearAuditLogs() {
  const beforeCount = logs.length;

  // Remove logs with level < WARN (i.e., AUDIT and INFO)
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].level < LOG_LEVELS.WARN) {
      logs.splice(i, 1);
    }
  }

  const clearedCount = beforeCount - logs.length;

  if (clearedCount > 0) {
    const message = formatLogMessage('LOG004', { cleared: clearedCount, retained: logs.length });
    originalConsole.log(message);
  }

  return { clearedCount, remainingCount: logs.length };
}

// Get current log stats
export function getLogStats() {
  const stats = {
    total: logs.length,
    audit: 0,
    info: 0,
    warn: 0,
    error: 0
  };

  logs.forEach(log => {
    switch (log.level) {
      case LOG_LEVELS.AUDIT:
        stats.audit++;
        break;
      case LOG_LEVELS.INFO:
        stats.info++;
        break;
      case LOG_LEVELS.WARN:
        stats.warn++;
        break;
      case LOG_LEVELS.ERROR:
        stats.error++;
        break;
    }
  });

  return stats;
}

// Override global console for automatic level detection
export function setupGlobalLogger() {
  console.log = logger.audit;  // Regular console.log is treated as audit level
  console.info = logger.info;
  console.warn = logger.warn;
  console.error = logger.error;
}

// Restore original console
export function restoreConsole() {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}
