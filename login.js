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

    console.log("🔐 Waiting for Google login button...");
    const googleBtn = page.locator('//button[contains(.,"Log In with Google")]');
    await googleBtn.waitFor({ timeout: 15000 });

    console.log("🔐 Clicking Google login button...");
    await googleBtn.click();

    console.log("📧 Waiting for email input...");
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', process.env.APOLLO_GOOGLE_EMAIL);
    await page.keyboard.press('Enter');

    console.log("🔑 Waiting for password input...");
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await page.fill('input[type="password"]', process.env.APOLLO_GOOGLE_PASSWORD);
    await page.keyboard.press('Enter');

    console.log("⏳ Waiting after password entry...");
    await page.waitForTimeout(10000);

    await page.screenshot({
      path: path.join(screenshotDir, 'apollo-after-login-attempt.png'),
      fullPage: true
    });

    console.log("📸 Screenshot saved. Login process reached post-auth.");
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
