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
    console.log("🧭 Navigating to Apollo credit usage page...");
    await page.goto('https://app.apollo.io/#/settings/credits/current', { timeout: 30000 });
    await page.waitForTimeout(5000); // wait for page to settle

    // ⬇️ Extract credit usage text
    const creditText = await page.locator('text=/\\d+ credits of \\d+ credits/').first().textContent();

    const creditMatch = creditText?.match(/(\d+)\s+credits\s+of\s+(\d+)\s+credits/);
    if (!creditMatch) throw new Error(`Unable to extract credit values from text: "${creditText}"`);

    const used = parseInt(creditMatch[1], 10);
    const limit = parseInt(creditMatch[2], 10);

    console.log(`📊 Extracted from page — Used: ${used}, Limit: ${limit}`);

    const result = { used, limit, source: 'dom', timestamp: new Date().toISOString() };
    fs.writeFileSync(path.join(screenshotDir, 'result.json'), JSON.stringify(result, null, 2));

    await page.screenshot({ path: path.join(screenshotDir, 'apollo-credits-page.png'), fullPage: true });

    console.log("✅ DOM data and screenshot saved.");
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
