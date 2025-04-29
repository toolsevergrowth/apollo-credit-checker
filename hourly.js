import { chromium } from 'playwright';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

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
    console.log("🔐 Navigating to Apollo...");
    await page.goto('https://app.apollo.io/#/login', { timeout: 15000 });

    console.log("🔐 Waiting for login form...");
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });

    console.log("✍️ Typing email...");
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Next")');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });

    console.log("🔑 Typing password...");
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Log In")');

    console.log("⏳ Waiting for dashboard...");
    await page.waitForTimeout(10000);

    const response = await page.request.post(
      'https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user',
      {
        data: {
          min_date: '2025-03-27T11:58:44.000+00:00',
          max_date: '2025-04-27T11:58:45.000+00:00',
          for_current_billing_cycle: true,
          user_ids: [],
          cacheKey: Date.now()
        }
      }
    );

    const json = await response.json();
    console.log("📦 API Response:", JSON.stringify(json));

    const used = json.team_credit_usage?.email || 0;
    const limit = json.user_id_to_credit_usage
      ? Object.values(json.user_id_to_credit_usage)[0].email.limit
      : 0;

    console.log(`📈 Used: ${used}, Limit: ${limit}`);

    const auth = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Sheet1'];
    await sheet.loadCells('A1:B1');

    sheet.getCell(0, 0).value = used;
    sheet.getCell(0, 1).value = limit;
    await sheet.saveUpdatedCells();

    console.log("✅ Sheet updated successfully.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await browser.close();
  }
})();
