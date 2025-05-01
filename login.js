const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotDir = path.resolve('./debug-artifacts');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("🧭 Navigating to Apollo login page...");
    await page.goto('https://app.apollo.io/#/login', { timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log("🔐 Clicking 'Continue with Google'...");
    const googleButton = page.locator('button:has-text("Continue with Google")');
    await googleButton.first().click();

    // Step 1: Wait for Google email input
    console.log("📧 Waiting for email input...");
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', process.env.APOLLO_GOOGLE_EMAIL);
    await page.keyboard.press('Enter');

    // Step 2: Wait for Google password input
    console.log("🔑 Waiting for password input...");
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await page.fill('input[type="password"]', process.env.APOLLO_GOOGLE_PASSWORD);
    await page.keyboard.press('Enter');

    // Optional: Wait longer to allow for 2FA or consent
    console.log("⏳ Waiting for potential 2FA/consent screen...");
    await page.waitForTimeout(10000);

    // Screenshot current page state
    await page.screenshot({
      path: path.join(screenshotDir, 'apollo-after-login-attempt.png'),
      fullPage: true
    });

    console.log("📸 Screenshot captured. Check artifacts to verify login flow.");
  } catch (err) {
    console.error("❌ Error occurred:", err.message);
    try {
      fs.writeFileSync(path.join(screenshotDir, 'error.txt'), err.stack || err.message);
      await page.screenshot({ path: path.join(screenshotDir, 'apollo-login-error.png'), fullPage: true });
    } catch (e) {
      console.error("⚠️ Could not save fallback diagnostics:", e.message);
    }
  } finally {
    await browser.close();
  }
})();
