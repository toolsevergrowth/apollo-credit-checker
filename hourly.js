const { google } = require('googleapis');

// Read env vars
const sheetId = process.env.GOOGLE_SHEET_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

// Authenticate
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Initialize Sheets API client
const sheets = google.sheets({ version: 'v4', auth });

async function run() {
  const now = new Date().toISOString();
  console.log('⏰ Updating Sheet1!A1 with timestamp:', now);

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[`Updated at: ${now}`]],
      },
    });

    console.log('✅ Sheet updated successfully');
  } catch (error) {
    console.error('❌ Failed to update sheet:', error.message);
    process.exit(1);
  }
}

run();
