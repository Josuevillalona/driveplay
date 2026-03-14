require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  sharedDriveId: process.env.SHARED_DRIVE_ID,
};
