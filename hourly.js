import fetch from 'node-fetch';
import { google } from 'googleapis';

const {
  APOLLO_EMAIL,
  APOLLO_PASSWORD,
  GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT
} = process.env;

const sheetId = GOOGLE_SHEET_ID;
const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);

// --- Authenticate with Google Sheets API ---
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// --- Login to Apollo ---
const login = async () => {
  const res = await fetch('https://app.apollo.io/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: APOLLO_EMAIL,
      password: APOLLO_PASSWORD
    })
  });

  const cookies = res.headers.get('set-cookie');
  const csrfToken = res.headers.get('x-csrf-token');

  if (!cookies || !csrfToken) {
    throw new Error('Failed to login to Apollo');
  }

  return { cookies, csrfToken };
};

// --- Fetch credit usage from Apollo ---
const getCreditUsage = async (cookies, csrfToken) => {
  const res = await fetch('https://app.apollo.io/api/v1/credit_usages/credit_usage_by_user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      Cookie: cookies
    },
    body: JSON.stringify({
      min_date: null,
      max_date: null,
      for_current_billing_cycle: true,
      user_ids: [],
      cacheKey: ''
    })
  });

  const json = await res.json();
  const used = json?.total_usage?.used || 0;
  const limit = json?.total_usage?.limit || 0;
  return { used, limit };
};

// --- Write to Google Sheets ---
const updateSheet = async (used, limit) => {
  const values = [[`Used: ${used}`, `Limit: ${limit}`]];
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Sheet1!A1:B1',
    valueInputOption: 'RAW',
    requestBody: { values }
  });
  console.log(`✅ Updated sheet with credits: ${used} / ${limit}`);
};

const main = async () => {
  try {
    const { cookies, csrfToken } = await login();
    const { used, limit } = await getCreditUsage(cookies, csrfToken);
    console.log(`📊 Apollo Credits Used: ${used}`);
    console.log(`📈 Apollo Credit Limit: ${limit}`);
    await updateSheet(used, limit);
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
};

main();
