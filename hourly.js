import { chromium } from 'playwright';
import fs from 'fs';
import { google } from 'googleapis';

// Load env vars
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
    await page.goto('https://app.apollo.io/#/login', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: '1-login-page.png' });

    console.log('🔐 Filling login form...');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.screenshot({ path: '2-filled-login.png' });

    await page.click('button:has-text("Log In")');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '3-after-login.png' });

    console.log('🌐 Extracting CSRF token and cookies...');
    const cookies = await context.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const csrfCookie = cookies.find(c => c.name === 'X-CSRF-TOKEN');
    const csrfToken = csrfCookie?.value;

    if (!csrfToken) throw new Error('❌ CSRF token not found');

    console.log('📊 Fetching credit usage...');
    const response = await page.request.post('https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user', {
      headers: {
        'x-csrf-token': csrfToken,
        'cookie': cookieHeader,
        'content-type': 'application/json'
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
    const { email, direct_dial, export: exp, ai } = json.team_credit_usage;
    const { limit } = json.user_id_to_credit_usage[Object.keys(json.user_id_to_credit_usage)[0]].email;
    const totalUsed = email + direct_dial + exp + ai;

    console.log(`✅ Used: ${totalUsed}, Limit: ${limit}`);

    // Google Sheets Write
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:B1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[totalUsed, limit]]
      }
    });

    console.log('📤 Synced to Google Sheets');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error.png' });
  } finally {
    await browser.close();
  }
})();
