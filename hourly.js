const { chromium } = require('playwright');
const fs = require('fs');
const { google } = require('googleapis');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './storageState.json' });
  const page = await context.newPage();

  const artifactDir = 'debug-artifacts';
  fs.mkdirSync(artifactDir, { recursive: true });

  try {
    console.log("🌐 Opening Apollo Integrations page...");
    await page.goto('https://app.apollo.io/#/settings/integrations', { timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${artifactDir}/step-1-integrations.png`, fullPage: true });

    // 🔄 Scroll to load the API card
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1500);

    // 🔍 Find and click the API card
    const cards = await page.locator('.zp_Y4xXE').all();
    let clicked = false;

    for (let i = 0; i < cards.length; i++) {
      const text = await cards[i].textContent();
      if (text?.includes("Programmatically access Apollo")) {
        await cards[i].click();
        clicked = true;
        break;
      }
    }

    if (!clicked) throw new Error("❌ Could not find API card to click.");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${artifactDir}/step-2-api-clicked.png`, fullPage: true });

    // 📊 Click Usage tab
    await page.getByText('Usage', { exact: true }).click();
    await page.waitForTimeout(3000);

    await page.waitForSelector('.progress-bar-subtitle', { timeout: 30000 });
    const usageText = await page.locator('.progress-bar-subtitle').first().textContent();
    const match = usageText?.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) throw new Error(`Could not extract usage from: "${usageText}"`);

    const used = parseInt(match[1], 10);
    const limit = parseInt(match[2], 10);
    const creditsLeft = limit - used;

    console.log(`📊 Used: ${used} of ${limit} → Left: ${creditsLeft}`);
    await page.screenshot({ path: `${artifactDir}/step-3-usage-confirmed.png`, fullPage: true });

    await pushToGoogleSheet({ creditsLeft });
    console.log("✅ Logged to Apollo Daily.");
  } catch (err) {
    console.error("❌ Error:", err.message);
    fs.writeFileSync(`${artifactDir}/error.txt`, err.stack || err.message);
    try {
      await page.screenshot({ path: `${artifactDir}/error.png`, fullPage: true });
    } catch (screenshotErr) {
      console.error("⚠️ Screenshot capture failed:", screenshotErr.message);
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

  console.log(`📤 Wrote to Apollo Daily → Row ${rowNum}: [${timestamp}, ${creditsLeft}]`);
}
