const fs = require('fs');
const { google } = require('googleapis');
const { chromium: baseChromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')();

baseChromium.use(StealthPlugin);

console.log("🔐 Launching browser with stealth...");

const email = process.env.APOLLO_EMAIL;
const password = process.env.APOLLO_PASSWORD;
const sheetId = process.env.GOOGLE_SHEET_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

(async () => {
  const browser = await baseChromium.launchPersistentContext('/tmp/apollo-user', {
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await browser.newPage();

  try {
    console.log("🔐 Navigating to Apollo login...");
    await page.goto('https://app.apollo.io/#/login', { waitUntil: 'networkidle' });

    console.log("⌨️ Typing email...");
    await page.fill('input[placeholder="Work Email"]', email);

    console.log("⌨️ Typing password...");
    await page.fill('input[placeholder="Enter your password"]', password);

    console.log("🔐 Submitting login form...");
    await page.locator('input[placeholder="Enter your password"]').evaluate(el => {
      el.form.querySelector('button[type="submit"]').click();
    });

    console.log("⏳ Waiting for 2FA screen or dashboard...");

    try {
      await page.waitForSelector('input[placeholder="Enter code"]', { timeout: 10000 });

      console.log("⏳ Waiting up to 60s for 2FA code from Google Sheet A1...");
      const auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      const sheets = google.sheets({ version: 'v4', auth });

      let code = '';
      let attempt = 0;

      while (!code && attempt < 4) {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'Sheet1!A1'
        });

        const val = res.data.values?.[0]?.[0] ?? '';
        if (/^\d{6}$/.test(val)) {
          code = val;
          console.log(`✅ Code found: ${code}`);
          break;
        }

        if (attempt === 1) {
          console.log("🔁 No code after 30s — clicking 'Resend code' again...");
          const resendVisible = await page.isVisible('text=Resend code');
          if (resendVisible) {
            await page.click('text=Resend code');
          } else {
            console.warn("⚠️ Resend button not visible.");
          }
        }

        console.log("⏳ Retrying in 15 seconds...");
        await new Promise(r => setTimeout(r, 15000));
        attempt++;
      }

      if (!code) {
        throw new Error("❌ 2FA code not found in A1 within 60 seconds.");
      }

      console.log("⌨️ Entering 2FA code...");
      await page.fill('input[placeholder="Enter code"]', code);
      await page.click('button:has-text("Continue")');

      console.log("✅ Code submitted. Waiting for dashboard...");
      await page.waitForTimeout(10000);
    } catch (e) {
      console.log("🟢 2FA screen not detected, likely already authenticated.");
    }

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

    console.log("📄 Updating usage in Google Sheet...");
    const writeAuth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const writeSheets = google.sheets({ version: 'v4', auth: writeAuth });

    await writeSheets.spreadsheets.values.update({
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
      const screenshotPath = 'error-screenshot.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log("📸 Screenshot saved to:", screenshotPath);
    } catch (screenshotError) {
      console.error("⚠️ Screenshot capture failed:", screenshotError.message);
    }
  } finally {
    await browser.close();
  }
})();
