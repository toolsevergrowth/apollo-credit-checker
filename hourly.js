import { chromium } from 'playwright';
import { google } from 'googleapis';

const email = process.env.APOLLO_EMAIL;
const password = process.env.APOLLO_PASSWORD;
const sheetId = process.env.GOOGLE_SHEET_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

async function writeToSheet(used, limit) {
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const now = new Date().toISOString();

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Sheet1!A1:B1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[used, limit]]
    }
  });
  console.log(`✅ Sheet updated with used: ${used}, limit: ${limit}`);
}

async function extractCreditUsage(page) {
  const response = await page.evaluate(async () => {
    const res = await fetch("https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'x-csrf-token': document.cookie.match(/X-CSRF-TOKEN=([^;]+)/)?.[1] || ''
      },
      body: JSON.stringify({
        min_date: "2025-03-27T11:58:44.000+00:00",
        max_date: "2025-04-27T11:58:45.000+00:00",
        for_current_billing_cycle: true,
        user_ids: [],
        cacheKey: Date.now()
      })
    });
    return res.json();
  });

  const totalUsed = response.team_credit_usage?.email + response.team_credit_usage?.direct_dial + response.team_credit_usage?.export + response.team_credit_usage?.ai;
  const userId = Object.keys(response.user_id_to_credit_usage || {})[0];
  const emailLimit = userId ? response.user_id_to_credit_usage[userId]?.email?.limit : null;

  if (typeof totalUsed === 'number' && typeof emailLimit === 'number') {
    return { totalUsed, emailLimit };
  } else {
    throw new Error('Credit usage data not found.');
  }
}

(async () => {
  console.log('🔐 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Navigating to Apollo...');
  await page.goto('https://app.apollo.io/#/login', { waitUntil: 'networkidle' });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Log In")');

  await page.waitForURL('**/home', { timeout: 15000 });

  const { totalUsed, emailLimit } = await extractCreditUsage(page);
  console.log(`📊 Used: ${totalUsed}, Limit: ${emailLimit}`);

  await writeToSheet(totalUsed, emailLimit);

  await browser.close();
})();
