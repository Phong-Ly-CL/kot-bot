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
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    await page.type("#txtUser", userId, { delay: 30 });
    await page.type("#txtPass", password, { delay: 30 });
    await Promise.all([page.waitForNavigation(), page.click("#btnLogin")]);

    await page.click(action === "in" ? "#btnClockIn" : "#btnClockOut");
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
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    await page.type("#txtUser", userId, { delay: 30 });
    await page.type("#txtPass", password, { delay: 30 });
    await Promise.all([page.waitForNavigation(), page.click("#btnLogin")]);

    // Check if currently punched in
    const isPunchedIn = await page.$('#btnClockOut') !== null;
    
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