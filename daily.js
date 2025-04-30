const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

(async () => {
  const screenshotDir = path.resolve('./debug-artifacts');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './storageState.json' });
  const page = await context.newPage();

  try {
    console.log("🧭 Navigating to Apollo credit usage page...");
    await page.goto('https://app.apollo.io/#/settings/credits/current', { timeout: 30000 });
    await page.waitForTimeout(5000);

    const creditText = await page.locator('text=/\\d+ credits of \\d+ credits/').first().textContent();
    const creditMatch = creditText?.match(/(\d+)\s+credits\s+of\s+(\d+)\s+credits/);

    if (!creditMatch) throw new Error(`Unable to extract credit values from text: "${creditText}"`);

    const used = parseInt(creditMatch[1], 10);
    const limit = parseInt(creditMatch[2], 10);
    const creditsLeft = limit - used;

    console.log(`📊 Used: ${used}, Limit: ${limit}, Left: ${creditsLeft}`);

    const result = { used, limit, creditsLeft, timestamp: new Date().toISOString() };
    fs.writeFileSync(path.join(screenshotDir, 'result.json'), JSON.stringify(result, null, 2));

    await page.screenshot({ path: path.join(screenshotDir, 'apollo-credits-page.png'), fullPage: true });

    await pushToGoogleSheet({ used, limit });

    console.log("✅ Done.");
  } catch (err) {
    console.error("❌ Error occurred:", err.message);
    try {
      fs.writeFileSync(path.join(screenshotDir, 'error.txt'), err.stack || err.message);
      await page.screenshot({ path: path.join(screenshotDir, 'apollo-login-failed.png'), fullPage: true });
    } catch (e) {
      console.error("⚠️ Could not save fallback diagnostics:", e.message);
    }
  } finally {
    await browser.close();
  }
})();

async function pushToGoogleSheet({ used, limit }) {
  const creditsLeft = limit - used;
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
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  await jwt.authorize();

  const sheets = google.sheets({ version: 'v4', auth: jwt });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!B:B',
  });

  const rowNum = (readRes.data.values?.length || 0) + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Sheet1!A${rowNum}:B${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[timestamp, creditsLeft]],
    },
  });

  console.log(`📤 Pushed to Google Sheets → Row ${rowNum}: [${timestamp}, ${creditsLeft}]`);
}
