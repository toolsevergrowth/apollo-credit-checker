// hourly.js
import fetch from 'node-fetch';
import { google } from 'googleapis';

const APOLLO_EMAIL = process.env.APOLLO_EMAIL;
const APOLLO_PASSWORD = process.env.APOLLO_PASSWORD;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const loginToApollo = async () => {
  const res = await fetch('https://app.apollo.io/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: APOLLO_EMAIL,
      password: APOLLO_PASSWORD
    })
  });

  if (!res.ok) {
    throw new Error(`Apollo login failed: ${res.status} - ${res.statusText}`);
  }

  const data = await res.json();
  console.log('✅ Apollo login successful');
  return data;
};

const updateSheet = async (timestamp) => {
  const auth = new google.auth.JWT(
    GOOGLE_SERVICE_ACCOUNT.client_email,
    null,
    GOOGLE_SERVICE_ACCOUNT.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[`Updated at: ${timestamp}`]]
    }
  });
  console.log('✅ Sheet1!A1 updated successfully');
};

(async () => {
  console.log('🔍 Checking env vars...');
  console.log('GOOGLE_SHEET_ID=' + (GOOGLE_SHEET_ID ? 'SET' : '')); 
  console.log('GOOGLE_SERVICE_ACCOUNT=' + (GOOGLE_SERVICE_ACCOUNT ? 'SET' : ''));

  try {
    await loginToApollo();
    const timestamp = new Date().toISOString();
    console.log('⏰ Writing timestamp:', timestamp);
    await updateSheet(timestamp);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
