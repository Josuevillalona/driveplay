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
    // We cannot immediately impersonate because the state param only gives us a numeric 'userId'.
    // However, since we authorized the Domain-Wide delegation, we need to pass a valid subject email.
    // For MVP, we will require the admin to set a GOOGLE_IMPERSONATE_EMAIL in their environment
    // variables which will be a super-user/admin email that has access to the Shared Drives.
    const config = require('../config');
    const subjectEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;

    if (!subjectEmail) {
      console.warn('GOOGLE_IMPERSONATE_EMAIL not set. Falling back to default service account access.');
    }

    const drive = getDriveService(subjectEmail);
    const { data: file } = await drive.files.get({
      fileId: parsed.fileId,
      fields: 'id,name,mimeType,size',
      supportsAllDrives: true,
    });

    const html = renderPlayerHTML({
      fileId: file.id,
      fileName: file.name,
      mimeType: file.mimeType,
      fileSize: file.size,
    });

    res.type('html').send(html);
  } catch (err) {
    console.error('Error opening file:', err.message);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

module.exports = router;
