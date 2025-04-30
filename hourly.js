import { chromium } from 'playwright';
import fs from 'fs';

const storagePath = './storageState.json';

(async () => {
  if (!fs.existsSync(storagePath)) {
    console.error("❌ storageState.json missing!");
    process.exit(1);
  }

  console.log("🔐 Launching browser with saved session...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: storagePath });
  const page = await context.newPage();

  console.log("🌐 Navigating to Apollo...");
  await page.goto('https://app.apollo.io', { waitUntil: 'domcontentloaded' });

  // Take screenshot for debugging
  await page.screenshot({ path: 'apollo-login-check.png', fullPage: true });
  console.log("📸 Screenshot saved to apollo-login-check.png");

  const isLoggedIn = await page.locator('text=Log Out').first().isVisible().catch(() => false);
  console.log(isLoggedIn ? "✅ Session is valid!" : "❌ Not logged in.");

  await browser.close();
})();
