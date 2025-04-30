import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const screenshotPath = 'apollo-login-check.png';

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

  await page.waitForTimeout(10000); // Allow time for app to load

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved to ${screenshotPath}`);

  const loggedIn = await page.$('text=My Account') || await page.$('[data-testid="navigation-bar"]');

  if (loggedIn) {
    console.log("✅ Logged in successfully!");
  } else {
    console.log("❌ Not logged in.");
  }

  await browser.close();
})();
