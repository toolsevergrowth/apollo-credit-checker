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

// click "Next"
const nextBtn = page.locator('button:has-text("Next")');
await nextBtn.waitFor({ timeout: 5000 });
await nextBtn.click();
await page.waitForTimeout(3000);

// now wait for password input
console.log("🔑 Waiting for password input...");
await page.waitForSelector('input[type="password"]', { timeout: 15000 });
await page.fill('input[type="password"]', process.env.APOLLO_GOOGLE_PASSWORD);
await page.keyboard.press('Enter');

    console.log("⏳ Waiting after password entry...");
    await page.waitForTimeout(5000);

    // Optional 2FA: Click "Try another way"
    const tryAnother = page.locator('text=Try another way');
    if (await tryAnother.isVisible({ timeout: 5000 })) {
      console.log("🔁 Clicking 'Try another way'...");
      await tryAnother.click();
      await page.waitForTimeout(3000);

      await page.screenshot({
        path: path.join(screenshotDir, 'apollo-after-try-another-way.png'),
        fullPage: true
      });
      console.log("📸 Screenshot saved after clicking 'Try another way'");
    } else {
      console.log("ℹ️ 'Try another way' not visible. Skipping.");
    }

    // Final screenshot after login flow attempt
    await page.screenshot({
      path: path.join(screenshotDir, 'apollo-after-login-attempt.png'),
      fullPage: true
    });

    console.log("✅ Done. Login attempt flow complete.");
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
