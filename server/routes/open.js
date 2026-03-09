const express = require('express');
const { parseStateParam } = require('../state');
const { getDriveService } = require('../drive');
const { renderPlayerHTML } = require('../player');
const { getUserEmail } = require('../userLookup');

const router = express.Router();

router.get('/', async (req, res) => {
  const parsed = parseStateParam(req.query.state);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid or missing state parameter' });
  }

  try {
    // Resolve the numeric userId to an email, then impersonate that user.
    // This way, each user's own Drive permissions are respected.
    let subjectEmail = null;
    if (parsed.userId) {
      subjectEmail = await getUserEmail(parsed.userId);
    }

    // Fallback: if we can't resolve the userId, try the admin email
    if (!subjectEmail) {
      subjectEmail = process.env.GOOGLE_ADMIN_EMAIL;
      console.warn('Could not resolve userId; falling back to GOOGLE_ADMIN_EMAIL for impersonation.');
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
      userEmail: subjectEmail,
    });

    res.type('html').send(html);
  } catch (err) {
    console.error('Error opening file:', err.message);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

module.exports = router;
