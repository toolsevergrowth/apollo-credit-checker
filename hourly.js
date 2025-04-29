const { chromium } = require('playwright');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const APOLLO_EMAIL = process.env.APOLLO_EMAIL;
const APOLLO_PASSWORD = process.env.APOLLO_PASSWORD;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

async function main() {
  console.log("🔐 Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🔐 Navigating to Apollo...");
  await page.goto('https://app.apollo.io/#/login', { waitUntil: 'load' });

  console.log("🔐 Waiting for login form...");
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.fill('input[type="email"]', APOLLO_EMAIL);
  await page.fill('input[type="password"]', APOLLO_PASSWORD);
  await page.click('button[type="submit"]');

  console.log("🔄 Waiting for dashboard to load...");
  await page.waitForTimeout(10000); // Let the login process settle

  console.log("📡 Fetching credit usage JSON...");
  const response = await page.evaluate(async () => {
    const res = await fetch('https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user', {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        min_date: "2025-03-27T11:58:44.000+00:00",
        max_date: "2025-04-27T11:58:45.000+00:00",
        for_current_billing_cycle: true,
        user_ids: [],
        cacheKey: Date.now()
      })
    });
    return await res.json();
  });

  await browser.close();

  const team = response?.team_credit_usage;
  const userId = Object.keys(response?.user_id_to_credit_usage || {})[0];
  const limit = response?.user_id_to_credit_usage?.[userId]?.email?.limit;

  if (!team || !limit) {
    console.error("❌ Could not extract usage or limit");
    console.error(JSON.stringify(response, null, 2));
    process.exit(1);
  }

  const used = team.email + team.direct_dial + team.export + team.ai;
  console.log(`✅ Total used: ${used}`);
  console.log(`🎯 Limit: ${limit}`);

  console.log("📤 Updating Google Sheet...");
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(SERVICE_ACCOUNT);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Sheet1"] || doc.sheetsByIndex[0];

  await sheet.loadCells('A1:B1');
  sheet.getCell(0, 0).value = used;
  sheet.getCell(0, 1).value = limit;
  await sheet.saveUpdatedCells();

  console.log("✅ Google Sheet updated!");
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
