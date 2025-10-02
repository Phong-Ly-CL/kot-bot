import { punch } from './kot.js';

// Store scheduled punch-outs (in-memory, will reset on restart)
export const scheduledPunchOuts = new Map();

// Store punch-in times (in-memory, will reset on restart)
export const punchInTimes = new Map();

// Send Slack notification
export async function sendSlackNotification(message) {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
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
export function scheduleOutPunch(userId, timeString) {
  const KOT_URL = process.env.KOT_URL;
  const KOT_ID = process.env.KOT_ID;
  const KOT_PASS = process.env.KOT_PASS;

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
