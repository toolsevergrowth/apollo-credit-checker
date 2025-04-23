import { chromium } from 'playwright';
import fs from 'fs';
import { google } from 'googleapis';

const email = process.env.APOLLO_EMAIL;
const password = process.env.APOLLO_PASSWORD;
const sheetId = process.env.GOOGLE_SHEET_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

(async () => {
  console.log('🔐 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔐 Navigating to Apollo...');
    await page.goto('https://app.apollo.io/#/login', { timeout: 900000 });
    await page.screenshot({ path: '1_login_page.png' });

    console.log('🔐 Waiting for login form...');
    await page.waitForSelector('input[type="email"]', { timeout: 900000 });

    console.log('🔐 Filling login form...');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.screenshot({ path: '2_filled_login.png' });

    console.log('🔐 Submitting login form...');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 900000 });
    await page.screenshot({ path: '3_after_login.png' });

    console.log('📡 Fetching credit usage via API...');
    const response = await page.request.post('https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user', {
      data: {
        min_date: '2025-03-27T11:58:44.000+00:00',
        max_date: '2025-04-27T11:58:45.000+00:00',
        for_current_billing_cycle: true,
        user_ids: [],
        cacheKey: Date.now()
      },
      headers: {
        'content-type': 'application/json'
      }
    });

    const json = await response.json();
    const totalUsed = json.team_credit_usage.email + json.team_credit_usage.direct_dial + json.team_credit_usage.export + json.team_credit_usage.ai;
    const userId = Object.keys(json.user_id_to_credit_usage)[0];
    const totalLimit = json.user_id_to_credit_usage[userId]?.email?.limit || 0;

    console.log(`✅ Total Used: ${totalUsed}`);
    console.log(`✅ Total Limit: ${totalLimit}`);

    console.log('📄 Updating Google Sheet...');
    const jwtClient = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await jwtClient.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:B1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[totalUsed, totalLimit]],
      },
    });

    console.log('✅ Sheet updated successfully.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: 'error_general.png' });
  } finally {
    await browser.close();
  }
})();
