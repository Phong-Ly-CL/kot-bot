import { formatLogMessage } from '../config/logMessages.js';

// Simple logger that outputs messages directly to console
export const logger = {
  // Structured logging with message codes
  logCode: (level, code, params = {}) => {
    const formattedMessage = formatLogMessage(code, params, false);
    const logLevel = level.toUpperCase();

    // Output message directly to console based on level
    switch (logLevel) {
      case 'AUDIT':
        console.log(formattedMessage);
        break;
      case 'INFO':
        console.info(formattedMessage);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      case 'ERROR':
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }
};
