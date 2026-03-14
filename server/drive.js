const { google } = require('googleapis');
const config = require('./config');

/**
 * Creates a Drive service using a specific auth strategy.
 *
 * Strategy 1 (default): Direct service account access — no impersonation.
 *   Works when the service account has been added as a member of a Shared Drive.
 *   This is Google's recommended approach for server-to-server Shared Drive access.
 *
 * Strategy 2 (subject provided): Domain-Wide Delegation impersonation.
 *   The service account acts on behalf of a specific user.
 *   Works for any file that user has access to (My Drive, Shared Drives, shared files).
 */
function getDriveService(subjectEmail = null) {
  const jwtOptions = {
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  };

  if (subjectEmail) {
    jwtOptions.subject = subjectEmail;
  }

  const auth = new google.auth.JWT(jwtOptions);
  return google.drive({ version: 'v3', auth });
}

module.exports = { getDriveService };
