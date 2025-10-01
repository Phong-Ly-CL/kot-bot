import puppeteer from "puppeteer";

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

    console.log("Logging in...");

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

    console.log("Login successful");

    // Click punch in/out button
    const punchSelector =
      action === "in" ? SELECTORS.clockIn : SELECTORS.clockOut;
    const notificationContent =
      action === "in"
        ? NOTIFICATION_CONTENT.clockIn
        : NOTIFICATION_CONTENT.clockOut;

    console.log(`Clicking ${action} button...`);
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

    console.log(`${action.toUpperCase()} completed for ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error during ${action} punch:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

export async function checkWorkingHours(url, userId, password) {
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

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

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if currently punched in by looking for clock-out button
    const isPunchedIn = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, SELECTORS.clockOut);

    if (isPunchedIn) {
      // Get punch-in time - this may need adjustment based on actual UI
      const punchInTime = await page.evaluate(() => {
        // Look for punch-in time display
        const timeElement = document.querySelector(
          ".punch-in-time, .start-time, [data-punch-in]"
        );
        return timeElement ? timeElement.textContent.trim() : null;
      });

      if (punchInTime) {
        const now = new Date();
        const today = now.toDateString();
        const startTime = new Date(`${today} ${punchInTime}`);
        const hoursWorked = (now - startTime) / (1000 * 60 * 60);

        return {
          isPunchedIn: true,
          hoursWorked: hoursWorked,
          punchInTime: startTime,
        };
      }
    }

    return {
      isPunchedIn: false,
      hoursWorked: 0,
      punchInTime: null,
    };
  } catch (error) {
    console.error("Error checking working hours:", error);
    return {
      isPunchedIn: false,
      hoursWorked: 0,
      punchInTime: null,
    };
  } finally {
    await browser.close();
  }
}
