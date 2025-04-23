import { chromium } from 'playwright';
import { google } from 'googleapis';
import fs from 'fs/promises';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const EMAIL = process.env.APOLLO_EMAIL;
const PASSWORD = process.env.APOLLO_PASSWORD;

async function loginAndGetData() {
  console.log('🔐 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Navigating to Apollo...');
  await page.goto('https://app.apollo.io/#/login', { waitUntil: 'domcontentloaded' });

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Log In")');

  await page.waitForLoadState('networkidle');

  console.log('🔄 Fetching credit usage...');
  const response = await page.request.post('https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user', {
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      min_date: '2025-03-27T11:58:44.000+00:00',
      max_date: '2025-04-27T11:58:45.000+00:00',
      for_current_billing_cycle: true,
      user_ids: [],
      cacheKey: Date.now()
    }
  });

  const json = await response.json();
  await browser.close();

  const team = json.team_credit_usage;
  const user = Object.values(json.user_id_to_credit_usage)?.[0];
  if (!user) throw new Error('❌ Failed to extract credit limits');

  const used = team.email + team.direct_dial + team.export + team.ai;
  const limit = user.email.limit;

  console.log(`✅ Total Used: ${used}, Limit: ${limit}`);
  return { used, limit };
}

async function updateGoogleSheet(used, limit) {
  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  console.log('📤 Writing to Google Sheets...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A1:B1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[used, limit]]
    }
  });
}

(async () => {
  try {
    const { used, limit } = await loginAndGetData();
    await updateGoogleSheet(used, limit);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
