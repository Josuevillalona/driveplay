const { google } = require('googleapis');
const config = require('./config');

let driveService = null;

function getDriveService() {
  if (driveService) return driveService;

  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  driveService = google.drive({ version: 'v3', auth });
  return driveService;
}

module.exports = { getDriveService };
