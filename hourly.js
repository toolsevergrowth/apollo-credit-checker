const { chromium } = require('playwright');
const fs = require('fs');
const { google } = require('googleapis');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './storageState.json' });
  const page = await context.newPage();

  try {
    console.log("🌐 Opening Apollo Developer Usage page...");
    await page.goto('https://developer.apollo.io/usage/', { timeout: 30000 });
    await page.waitForTimeout(5000);

    const usageText = await page.locator('text=/\\d+\\s*\\/\\s*\\d+/').first().textContent();
    const match = usageText?.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) throw new Error(`Could not extract usage values from: "${usageText}"`);

    const used = parseInt(match[1], 10);
    const limit = parseInt(match[2], 10);
    const percentUsed = ((used / limit) * 100).toFixed(2);

    console.log(`📊 Developer Usage — Used: ${used}, Limit: ${limit}, Percent: ${percentUsed}%`);

    await pushToGoogleSheet({ used, limit, percentUsed });
    console.log("✅ Data pushed to 'Apollo Daily' sheet.");
  } catch (err) {
    console.error("❌ Error:", err.message);
    fs.writeFileSync('debug-artifacts/dev-usage-error.txt', err.stack || err.message);
  } finally {
    await browser.close();
  }
})();

async function pushToGoogleSheet({ used, limit, percentUsed }) {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');

  const jwt = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  await jwt.authorize();

  const sheets = google.sheets({ version: 'v4', auth: jwt });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Apollo Daily!A:A',
  });

  const rowNum = (readRes.data.values?.length || 0) + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Apollo Daily!A${rowNum}:D${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[timestamp, used, limit, percentUsed]],
    },
  });

  console.log(`📤 Wrote to Apollo Daily → Row ${rowNum}: [${timestamp}, ${used}, ${limit}, ${percentUsed}%]`);
}
