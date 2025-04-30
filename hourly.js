const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './storageState.json' });
  const page = await context.newPage();

  try {
    console.log("🔐 Navigating to Apollo dashboard...");
    await page.goto('https://app.apollo.io/#/home', { waitUntil: 'networkidle' });

    await page.waitForTimeout(5000); // give the dashboard time to render

    const screenshotPath = 'apollo-dashboard.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved to: ${screenshotPath}`);
  } catch (err) {
    console.error("❌ Login or navigation failed:", err.message);

    try {
      const htmlPath = 'apollo-error-page.html';
      const content = await page.content();
      fs.writeFileSync(htmlPath, content);
      await page.screenshot({ path: 'apollo-login-failed.png', fullPage: true });
      console.log("📸 Error screenshot saved.");
    } catch (e) {
      console.error("⚠️ Could not capture fallback diagnostics:", e.message);
    }
  } finally {
    await browser.close();
  }
})();
