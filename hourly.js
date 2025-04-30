import { chromium } from 'playwright';

const fs = require('fs');
const path = require('path');

(async () => {
  console.log("🔐 Launching browser with saved session...");

  const browser = await chromium.launchPersistentContext('', {
    headless: true,
    viewport: { width: 1280, height: 800 },
    storageState: 'storageState.json',
  });

  const page = await browser.newPage();

  console.log("🌐 Navigating to Apollo...");
  await page.goto('https://app.apollo.io/', { waitUntil: 'domcontentloaded' });

  // 🔄 Wait for Apollo app to finish loading (spinner disappears)
  await page.waitForTimeout(10000); // You can adjust this if needed

  // 📸 Save screenshot for debugging
  const screenshotPath = 'apollo-login-check.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved to ${screenshotPath}`);

  // ✅ Login check — adjust selector as needed
  const loggedIn = await page.$('text=My Account') || await page.$('[data-testid="navigation-bar"]');

  if (loggedIn) {
    console.log("✅ Logged in successfully!");
    // Proceed with your automation here...
  } else {
    console.log("❌ Not logged in.");
  }

  await browser.close();
})();
