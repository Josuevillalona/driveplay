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
    // Try direct service account access first (Shared Drive members).
    // Falls back to admin impersonation if the SA can't access the file.
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
    } catch (directErr) {
      const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
      if (!adminEmail) throw directErr;

      userEmail = adminEmail;
      drive = getDriveService(adminEmail);
      const result = await drive.files.get({
        fileId: parsed.fileId,
        fields: 'id,name,mimeType,size',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      file = result.data;
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
    const code = err.code || 500;
    if (code === 404) {
      return res.status(404).json({ error: 'File not found or not accessible' });
    }
    if (code === 403) {
      return res.status(403).json({ error: 'Permission denied for this file' });
    }
    if (code === 401) {
      return res.status(401).json({ error: 'Authentication error. Check service account credentials.' });
    }
    console.error('Error opening file:', err.message);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

module.exports = router;
