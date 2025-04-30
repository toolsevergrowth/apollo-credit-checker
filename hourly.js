import { chromium } from 'playwright';

const email = process.env.APOLLO_EMAIL;
const password = process.env.APOLLO_PASSWORD;
const screenshot = 'apollo-login-success.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  console.log("🌐 Navigating to login page...");
  await page.goto('https://app.apollo.io/#/login', { waitUntil: 'networkidle' });

  console.log("⌨️ Typing credentials...");
  await page.fill('input[type="email"]', email);
  await page.click('button:has-text("Next")');
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Log In")');

  console.log("⏳ Waiting for dashboard...");
  await page.waitForTimeout(10000); // increase if needed

  await page.screenshot({ path: screenshot });
  console.log(`📸 Screenshot saved to ${screenshot}`);

  const loggedIn = await page.$('text=My Account') || await page.$('[data-testid="navigation-bar"]');
  console.log(loggedIn ? "✅ Login successful!" : "❌ Login may have failed.");

  await browser.close();
})();
