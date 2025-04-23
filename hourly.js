import fetch from 'node-fetch';
import { google } from 'googleapis';

const APOLLO_EMAIL = process.env.APOLLO_EMAIL;
const APOLLO_PASSWORD = process.env.APOLLO_PASSWORD;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

// 1. Apollo Login
console.log('🔐 Logging into Apollo...');
const loginResponse = await fetch('https://app.apollo.io/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: APOLLO_EMAIL, password: APOLLO_PASSWORD }),
});

if (!loginResponse.ok) {
  console.error(`❌ Apollo login failed with status ${loginResponse.status}: ${await loginResponse.text()}`);
  process.exit(1);
}

const cookies = loginResponse.headers.raw()['set-cookie']
  .map(cookie => cookie.split(';')[0])
  .join('; ');

// 2. Fetch Credit Usage
console.log('📊 Fetching credit usage data...');
const creditResponse = await fetch('https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': cookies,
  },
  body: JSON.stringify({
    for_current_billing_cycle: true,
    min_date: null,
    max_date: null,
    user_ids: [],
    cacheKey: Date.now().toString(),
  }),
});

if (!creditResponse.ok) {
  console.error(`❌ Failed to fetch credit usage: ${await creditResponse.text()}`);
  process.exit(1);
}

const data = await creditResponse.json();
const totalUsed = data.total_credits_used;
const totalLimit = data.credit_limit.total_credits;
console.log(`✅ Total used: ${totalUsed}, Limit: ${totalLimit}`);

// 3. Update Google Sheet
console.log('📤 Writing to Google Sheets...');
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: GOOGLE_SERVICE_ACCOUNT.client_email,
    private_key: GOOGLE_SERVICE_ACCOUNT.private_key,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

await sheets.spreadsheets.values.update({
  spreadsheetId: GOOGLE_SHEET_ID,
  range: 'Sheet1!A1:B1',
  valueInputOption: 'RAW',
  requestBody: {
    values: [[totalUsed, totalLimit]],
  },
});

console.log('✅ Sheet1!A1:B1 updated successfully.');
