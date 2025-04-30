const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotDir = path.resolve('./debug-artifacts');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: './storageState.json' });
  const page = await context.newPage();

  try {
    console.log("📤 Fetching Apollo credit usage...");
    const response = await page.request.post('https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user', {
      data: {
        min_date: '2025-03-27T11:58:44.000+00:00',
        max_date: '2025-04-27T11:58:45.000+00:00',
        for_current_billing_cycle: true,
        user_ids: [],
        cacheKey: Date.now()
      }
    });

    const body = await response.text();
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

    const result = { used, limit, timestamp: new Date().toISOString() };
    fs.writeFileSync(path.join(screenshotDir, 'result.json'), JSON.stringify(result, null, 2));

    await page.goto('https://app.apollo.io/#/home', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(screenshotDir, 'apollo-dashboard.png'), fullPage: true });

    console.log("✅ Data and screenshot saved.");
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
