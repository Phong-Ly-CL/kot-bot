// Centralized log messages with code:message pattern
// Format: CODE: message template

export const LOG_MESSAGES = {
  // System/Server (SYS)
  SYS001: '🚀 KING OF TIME bot running on port {{port}}',
  SYS002: 'Auto punch-in: {{status}}',
  SYS003: 'Auto punch-out: {{status}}',

  // Authentication/Credentials (AUTH)
  AUTH001: 'KOT credentials not configured for auto punch-in',
  AUTH002: 'KOT credentials not configured for auto punch-out',
  AUTH003: 'WARNING: SLACK_SIGNING_SECRET not set - skipping signature verification',

  // Auto Punch-In (APN_IN)
  APN_IN001: 'Auto punch-in already scheduled for today',
  APN_IN002: 'Auto punch-in skipped - weekend ({{day}})',
  APN_IN003: 'Auto punch-in skipped - Japanese public holiday',
  APN_IN004: 'Auto punch-in time {{time}} already passed for today',
  APN_IN005: '🎲 Auto punch-in scheduled at {{time}} JST (in {{minutes}} minutes)',
  APN_IN006: '⏰ Executing auto punch-in at {{time}} JST',
  APN_IN007: 'Already punched in - skipping auto punch-in',
  APN_IN008: '✅ Auto punched in at {{time}} JST',
  APN_IN009: 'Midnight JST - checking if need to schedule auto punch-in',
  APN_IN010: 'Auto punch-in enabled: random time between {{start}} and {{end}} JST',

  // Auto Punch-Out (APN_OUT)
  APN_OUT001: 'Running auto punch-out check...',
  APN_OUT002: 'Worked {{hours}} hours, but scheduled punch-out exists - skipping auto punch-out',
  APN_OUT003: 'Auto punch-out already scheduled',
  APN_OUT004: 'Worked {{hours}} hours - scheduling auto punch-out in {{minutes}} minutes',
  APN_OUT005: 'Already punched out - skipping auto punch-out',
  APN_OUT006: 'Scheduled punch-out exists - skipping auto punch-out',
  APN_OUT007: '🚨 Auto punched out after {{hours}} hours of work',
  APN_OUT008: 'Currently punched in for {{hours}} hours (under {{max}}h limit)',
  APN_OUT009: 'Not currently punched in',
  APN_OUT010: 'Auto punch-out enabled: will punch out after {{maxHours}} hours (with {{minDelay}}-{{maxDelay}} min random delay)',

  // KOT Service (KOT)
  KOT001: 'Logging in...',
  KOT002: 'Login successful',
  KOT003: 'Clicking {{action}} button...',
  KOT004: '{{action}} completed for {{userId}}',

  // Scheduler (SCH)
  SCH001: 'Executing scheduled punch-out for user {{userId}}',
  SCH002: 'Scheduled punch-out successful for user {{userId}}',
  SCH003: '✅ Scheduled punch-out completed at {{time}} JST',
  SCH004: '❌ Scheduled punch-out failed at {{time}} JST',

  // Manual Punch (MAN)
  MAN001: 'Successfully punched {{action}} for user {{userId}}',
  MAN002: 'Stored punch-in time for user {{userId}}: {{timestamp}}',
  MAN003: 'Cleared punch-in time for user {{userId}}',
  MAN004: 'User {{userId}} set remind time {{reminderTime}} - punch-in stored: {{timestamp}}',
  MAN005: 'User {{userId}} reminded time {{reminderTime}} - auto punched out after {{hoursWorked}} hours',

  // Slack Notifications (SLACK)
  SLACK001: 'Failed to send Slack notification: {{error}}',

  // Errors (ERR)
  ERR001: 'Error during {{action}} punch: {{error}}',
  ERR002: 'Error in auto punch-in: {{error}}',
  ERR003: 'Error executing auto punch-out: {{error}}',
  ERR004: 'Error in auto punch-out check: {{error}}',
  ERR005: 'Scheduled punch-out failed for user {{userId}}: {{error}}',
  ERR006: 'Punch {{action}} error: {{error}}',
  ERR007: 'Error processing Slack request: {{error}}',
  ERR008: 'Remind auto punch-out failed for {{action}}: {{error}}',
  ERR009: 'Status check error: {{error}}',
  ERR010: 'Error sending Slack notification: {{error}}'
};

// Helper function to format log message with parameters
export function formatLogMessage(code, params = {}, includeCode = false) {
  let message = LOG_MESSAGES[code];

  if (!message) {
    return `UNKNOWN_CODE:${code}`;
  }

  // Replace all {{param}} placeholders with actual values
  Object.keys(params).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    message = message.replace(regex, params[key]);
  });

  // Return with or without code prefix based on includeCode parameter
  return includeCode ? `${code}: ${message}` : message;
}
