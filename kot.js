import puppeteer from "puppeteer";

// Chrome launch configuration for Render
const launchOptions = {
  args: [
    "--disable-gpu",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process"
  ],
  headless: true,
};

export async function punch(url, userId, password, action) {
  const browser = await puppeteer.launch(launchOptions);
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for login form and take screenshot for debugging
    await page.waitForSelector('input[name="login_id"], input[id="login_id"], #txtUser', { timeout: 10000 });

    // Try multiple possible selectors
    const userInputSelector = await page.evaluate(() => {
      const selectors = ['input[name="login_id"]', 'input[id="login_id"]', '#txtUser', 'input[type="text"]'];
      for (const sel of selectors) {
        if (document.querySelector(sel)) return sel;
      }
      return null;
    });

    const passInputSelector = await page.evaluate(() => {
      const selectors = ['input[name="password"]', 'input[id="password"]', '#txtPass', 'input[type="password"]'];
      for (const sel of selectors) {
        if (document.querySelector(sel)) return sel;
      }
      return null;
    });

    if (!userInputSelector || !passInputSelector) {
      console.error('Could not find login form selectors');
      throw new Error('Login form not found');
    }

    await page.type(userInputSelector, userId, { delay: 30 });
    await page.type(passInputSelector, password, { delay: 30 });

    // Find and click login button
    const loginButtonSelector = await page.evaluate(() => {
      const selectors = ['button[type="submit"]', 'input[type="submit"]', '#btnLogin', 'button'];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && (btn.textContent.includes('ログイン') || btn.value === 'ログイン' || btn.id === 'btnLogin')) {
          return sel;
        }
      }
      return 'button[type="submit"]';
    });

    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.click(loginButtonSelector)
    ]);

    // Wait for punch buttons to appear
    await page.waitForSelector('input, button, a', { timeout: 10000 });

    // Find punch in/out button
    const punchButtonSelector = action === "in"
      ? await page.evaluate(() => {
          const selectors = ['#btnClockIn', 'input[value*="出勤"]', 'button:has-text("出勤")'];
          for (const sel of selectors) {
            if (document.querySelector(sel)) return sel;
          }
          return null;
        })
      : await page.evaluate(() => {
          const selectors = ['#btnClockOut', 'input[value*="退勤"]', 'button:has-text("退勤")'];
          for (const sel of selectors) {
            if (document.querySelector(sel)) return sel;
          }
          return null;
        });

    if (!punchButtonSelector) {
      console.error('Could not find punch button');
      throw new Error(`Punch ${action} button not found`);
    }

    await page.click(punchButtonSelector);
    await page.waitForTimeout(2000); // Wait for action to complete

    console.log(`${action.toUpperCase()} done for ${userId}`);
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

    // Wait for login form
    await page.waitForSelector('input[name="login_id"], input[id="login_id"], #txtUser', { timeout: 10000 });

    // Find input selectors
    const userInputSelector = await page.evaluate(() => {
      const selectors = ['input[name="login_id"]', 'input[id="login_id"]', '#txtUser', 'input[type="text"]'];
      for (const sel of selectors) {
        if (document.querySelector(sel)) return sel;
      }
      return null;
    });

    const passInputSelector = await page.evaluate(() => {
      const selectors = ['input[name="password"]', 'input[id="password"]', '#txtPass', 'input[type="password"]'];
      for (const sel of selectors) {
        if (document.querySelector(sel)) return sel;
      }
      return null;
    });

    if (!userInputSelector || !passInputSelector) {
      throw new Error('Login form not found');
    }

    await page.type(userInputSelector, userId, { delay: 30 });
    await page.type(passInputSelector, password, { delay: 30 });

    // Find and click login button
    const loginButtonSelector = await page.evaluate(() => {
      const selectors = ['button[type="submit"]', 'input[type="submit"]', '#btnLogin'];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && (btn.textContent?.includes('ログイン') || btn.value === 'ログイン' || btn.id === 'btnLogin')) {
          return sel;
        }
      }
      return 'button[type="submit"]';
    });

    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.click(loginButtonSelector)
    ]);

    await page.waitForTimeout(2000);

    // Check if currently punched in
    const isPunchedIn = await page.evaluate(() => {
      return !!document.querySelector('#btnClockOut, input[value*="退勤"], button:contains("退勤")');
    });
    
    if (isPunchedIn) {
      // Get punch-in time - this may need adjustment based on actual UI
      const punchInTime = await page.evaluate(() => {
        // Look for punch-in time display
        const timeElement = document.querySelector('.punch-in-time, .start-time, [data-punch-in]');
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
          punchInTime: startTime
        };
      }
    }

    return {
      isPunchedIn: false,
      hoursWorked: 0,
      punchInTime: null
    };

  } catch (error) {
    console.error('Error checking working hours:', error);
    return {
      isPunchedIn: false,
      hoursWorked: 0,
      punchInTime: null
    };
  } finally {
    await browser.close();
  }
}