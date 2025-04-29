const { chromium } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs');

console.log("🔐 Launching browser...");

const email = process.env.APOLLO_EMAIL;
const password = process.env.APOLLO_PASSWORD;
const sheetId = process.env.GOOGLE_SHEET_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("🔐 Navigating to Apollo login...");
    await page.goto('https://app.apollo.io/#/login', { waitUntil: 'networkidle' });

    console.log("⌨️ Waiting for email input...");
    await page.waitForSelector('input[placeholder="Work Email"]', { timeout: 40000 });

    console.log("⌨️ Typing email...");
    await page.fill('input[placeholder="Work Email"]', email);

    console.log("⌨️ Typing password...");
    await page.fill('input[placeholder="Enter your password"]', password);

    console.log("🔐 Clicking email login button only...");
    const loginButton = await page.locator('button:has-text("Log In")').first();
    await loginButton.click();

    console.log("⏳ Waiting for Apollo dashboard...");
    await page.waitForURL('**/app/**', { timeout: 20000 });

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

    console.log("📄 Connecting to Google Sheets...");
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
