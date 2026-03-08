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
    const drive = getDriveService();
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
