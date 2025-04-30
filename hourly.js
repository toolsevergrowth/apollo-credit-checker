const fs = require('fs');
const { google } = require('googleapis');
const { chromium: baseChromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')();

baseChromium.use(StealthPlugin);

const email = process.env.APOLLO_EMAIL;
const password = process.env.APOLLO_PASSWORD;
const sheetId = process.env.GOOGLE_SHEET_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

(async () => {
  const browser = await baseChromium.launchPersistentContext('/tmp/apollo-user', {
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await browser.newPage();

  try {
    console.log("🌐 Navigating to Apollo login page...");
    await page.goto('https://app.apollo.io/#/login', { waitUntil: 'networkidle' });

    console.log("🔘 Clicking 'Log in with Google'...");
    await page.waitForSelector('button:has-text("Log in with Google")', { timeout: 15000 });
    await page.click('button:has-text("Log in with Google")');

    console.log("📧 Typing Gmail email...");
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Next")');

    console.log("🔑 Typing Gmail password...");
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Next")');

    console.log("⏳ Waiting for Apollo to redirect...");
    await page.waitForURL('**/app/**', { timeout: 30000 });

    console.log("✅ Logged in via Google!");

    console.log("📤 Fetching credit usage...");
    const res = await page.request.post('https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user', {
      data: {
        min_date: '2025-03-27T11:58:44.000+00:00',
        max_date: '2025-04-27T11:58:45.000+00:00',
        for_current_billing_cycle: true,
        user_ids: [],
        cacheKey: Date.now()
      }
    });

    const body = await res.text();
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      throw new Error(`Invalid JSON response from Apollo:\n${body}`);
    }

    const used = json.team_credit_usage?.email ?? 0;
    const limit = json.user_id_to_credit_usage
      ? Object.values(json.user_id_to_credit_usage)[0].email.limit
      : 0;

    console.log(`📈 Used: ${used}, Limit: ${limit}`);

    console.log("📄 Updating usage in Google Sheet...");
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:B1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[used, limit]]
      }
    });

    console.log("✅ Sheet updated.");
  } catch (err) {
    console.error("❌ Error:", err.message);

    try {
      const screenshotPath = 'error-screenshot.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log("📸 Screenshot saved to:", screenshotPath);
    } catch (screenshotError) {
      console.error("⚠️ Screenshot capture failed:", screenshotError.message);
    }
  } finally {
    await browser.close();
  }
})();
