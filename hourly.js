const { chromium } = require('playwright');
const fs = require('fs');
const { google } = require('googleapis');

(async () => {
  const browser = await chromium.launch({ headless: true }); // Change to false for visual debug
  const context = await browser.newContext({ storageState: './storageState.json' });
  const page = await context.newPage();

  try {
    console.log("🌐 Navigating to Apollo > Admin > API > Usage...");
    await page.goto('https://app.apollo.io/#/home?sortByField=latest_reply_received_at', { timeout: 60000 });
    await page.waitForTimeout(7000);

    // Admin Settings
    await page.getByText('Admin Settings', { exact: true }).click();
    await page.waitForTimeout(1000);

    // Click Integrations
    await page.locator('#ma4mqg15').click();
    await page.waitForTimeout(2000);

    // Click API card
    await page.locator('.zp_Y4xXE', { hasText: 'API' }).click();
    await page.waitForTimeout(3000);

    // Click Usage tab
    await page.getByText('Usage', { exact: true }).click();
    await page.waitForTimeout(3000);

    // Wait and extract usage
    await page.waitForSelector('.progress-bar-subtitle', { timeout: 30000 });
    const usageText = await page.locator('.progress-bar-subtitle').first().textContent();

    const match = usageText?.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) throw new Error(`Could not extract usage from text: "${usageText}"`);

    const used = parseInt(match[1], 10);
    const limit = parseInt(match[2], 10);
    const creditsLeft = limit - used;

    console.log(`📊 Used: ${used} / ${limit} → Left: ${creditsLeft}`);
    await pushToGoogleSheet({ creditsLeft });
    console.log("✅ Logged to 'Apollo Daily'.");
  } catch (err) {
    console.error("❌ Error:", err.message);
    fs.mkdirSync('debug-artifacts', { recursive: true });
    fs.writeFileSync('debug-artifacts/dev-usage-error.txt', err.stack || err.message);
    try {
      await page.screenshot({ path: 'debug-artifacts/dev-usage-error.png', fullPage: true });
      console.log("🖼️ Saved screenshot.");
    } catch (screenshotErr) {
      console.error("⚠️ Could not capture screenshot:", screenshotErr.message);
    }
  } finally {
    await browser.close();
  }
})();

async function pushToGoogleSheet({ creditsLeft }) {
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
    range: `Apollo Daily!A${rowNum}:B${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[timestamp, creditsLeft]],
    },
  });

  console.log(`📤 Row ${rowNum} written: [${timestamp}, ${creditsLeft}]`);
}
