import { google } from 'googleapis';

// Read env vars
const sheetId = process.env.GOOGLE_SHEET_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

// Authenticate
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function run() {
  const now = new Date().toISOString();
  console.log('⏰ Writing timestamp:', now);

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[`Updated at: ${now}`]],
      },
    });

    console.log('✅ Sheet1!A1 updated successfully');
  } catch (error) {
    console.error('❌ Error updating sheet:', error.message);
    process.exit(1);
  }
}

run();
