import { chromium } from 'playwright';

const email = process.env.APOLLO_EMAIL;
const password = process.env.APOLLO_PASSWORD;
const screenshot = 'apollo-login-success.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log("🌐 Navigating to Apollo login...");
  await page.goto('https://app.apollo.io/#/login', { waitUntil: 'domcontentloaded' });

  console.log("⌛ Waiting for email input...");
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Next")');

    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Log In")');

    console.log("⏳ Waiting for dashboard...");
    await page.waitForTimeout(10000);
  } catch (err) {
    console.error("❌ Error during login:", err.message);
    await page.screenshot({ path: 'apollo-login-failure.png', fullPage: true });
    console.log("📸 Screenshot saved to apollo-login-failure.png");
    await browser.close();
    process.exit(1);
  }

  await page.screenshot({ path: screenshot });
  console.log(`📸 Screenshot saved to ${screenshot}`);

  const loggedIn = await page.$('text=My Account') || await page.$('[data-testid="navigation-bar"]');
  console.log(loggedIn ? "✅ Login successful!" : "❌ Login may have failed.");

  await browser.close();
})();
