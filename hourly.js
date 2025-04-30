const fs = require('fs');
const { google } = require('googleapis');
const { chromium } = require('playwright');

const sheetId = process.env.GOOGLE_SHEET_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './storageState.json' });
  const page = await context.newPage();

  try {
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
      await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
      const html = await page.content();
      fs.writeFileSync('page-content.html', html);
      console.log("📸 Screenshot and HTML saved.");
    } catch (captureErr) {
      console.error("⚠️ Could not capture screenshot or HTML:", captureErr.message);
    }
  } finally {
    await browser.close();
  }
})();
