import puppeteer from "puppeteer";
import { formatDateTimeJST, formatSecondsToHHMMSS } from '../utils.js';
import { logger } from '../utils/logger.js';

// Chrome launch configuration for Render
const launchOptions = {
  args: [
    "--disable-gpu",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
  ],
  headless: true,
};

// KING OF TIME selectors
const SELECTORS = {
  id: "#id",
  password: "#password",
  loginButton: ".btn-control-message",
  clockIn: ".record-clock-in",
  clockOut: ".record-clock-out",
  notification: '#notification_wrapper[style="display: none;"]',
};

const NOTIFICATION_CONTENT = {
  login: "データを取得しました",
  clockIn: "出勤が完了しました",
  clockOut: "退勤が完了しました",
};

export async function punch(url, userId, password, action) {
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    logger.logCode('audit', 'KOT001');

    // Wait for login form to be ready
    await page.waitForSelector(SELECTORS.id, { timeout: 10000 });

    // Login
    await page.type(SELECTORS.id, userId);
    await page.type(SELECTORS.password, password);

    await Promise.all([
      page.waitForFunction(
        (selector, content) => {
          const elem = document.querySelector(selector);
          return elem?.textContent?.includes(content);
        },
        { timeout: 10000 },
        SELECTORS.notification,
        NOTIFICATION_CONTENT.login
      ),
      page.click(SELECTORS.loginButton),
    ]);

    logger.logCode('audit', 'KOT002');

    // Click punch in/out button
    const punchSelector =
      action === "in" ? SELECTORS.clockIn : SELECTORS.clockOut;
    const notificationContent =
      action === "in"
        ? NOTIFICATION_CONTENT.clockIn
        : NOTIFICATION_CONTENT.clockOut;

    logger.logCode('audit', 'KOT003', { action });
    await Promise.all([
      page.waitForFunction(
        (selector, content) => {
          const elem = document.querySelector(selector);
          return elem?.textContent?.includes(content);
        },
        { timeout: 10000 },
        SELECTORS.notification,
        notificationContent
      ),
      page.click(punchSelector),
    ]);

    logger.logCode('audit', 'KOT004', { action: action.toUpperCase(), userId });
    return true;
  } catch (error) {
    logger.logCode('error', 'ERR001', { action, error: error.message });
    throw error;
  } finally {
    await browser.close();
  }
}

export async function checkWorkingHours(punchInTimesMap) {
  // Simple check using stored punch-in time
  // Note: This only works for users who punch in via our bot

  // Since we store per-user, but auto punch-out is global,
  // check if ANY user is punched in and over the limit
  for (const [userId, punchInTime] of punchInTimesMap.entries()) {
    const now = new Date();
    const secondsWorked = (now - punchInTime) / 1000;
    const hoursWorked = secondsWorked / 3600;

    return {
      isPunchedIn: true,
      hoursWorked: hoursWorked,
      workDuration: formatSecondsToHHMMSS(secondsWorked),
      punchInTime: formatDateTimeJST(punchInTime),
      userId: userId
    };
  }

  return {
    isPunchedIn: false,
    hoursWorked: 0,
    workDuration: '00:00:00',
    punchInTime: null,
    userId: null
  };
}
