const express = require('express');
const { parseStateParam } = require('../state');
const { getDriveService } = require('../drive');
const { renderPlayerHTML } = require('../player');

const router = express.Router();

router.get('/', async (req, res) => {
  const parsed = parseStateParam(req.query.state);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid or missing state parameter' });
  }

  try {
    // Strategy 1: Try direct service account access first.
    // This works when the SA is a member of the Shared Drive.
    let drive = getDriveService();
    let file;
    let userEmail = null;

    try {
      const result = await drive.files.get({
        fileId: parsed.fileId,
        fields: 'id,name,mimeType,size',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      file = result.data;
      console.log(`Direct SA access succeeded for file: ${file.name}`);
    } catch (directErr) {
      console.log(`Direct SA access failed: ${directErr.message}. Trying impersonation...`);

      // Strategy 2: Impersonate the admin user as fallback.
      // This works for any file the admin has access to.
      const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
      if (!adminEmail) {
        throw new Error('File not accessible. GOOGLE_ADMIN_EMAIL not set for fallback.');
      }

      userEmail = adminEmail;
      drive = getDriveService(adminEmail);
      const result = await drive.files.get({
        fileId: parsed.fileId,
        fields: 'id,name,mimeType,size',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      file = result.data;
      console.log(`Impersonation access succeeded for file: ${file.name} (as ${adminEmail})`);
    }

    const html = renderPlayerHTML({
      fileId: file.id,
      fileName: file.name,
      mimeType: file.mimeType,
      fileSize: file.size,
      userEmail,
    });

    res.type('html').send(html);
  } catch (err) {
    console.error('Error opening file:', err.message);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

module.exports = router;
