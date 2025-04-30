import { chromium } from 'playwright';

(async () => {
  console.log("🔐 Launching Apollo login session...");

  const browser = await chromium.launchPersistentContext('apollo-session', {
    headless: false,
    viewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  await page.goto('https://app.apollo.io', { waitUntil: 'networkidle' });

  console.log("🔑 Please log in manually. Keep browser open until you see login success.");
})();
