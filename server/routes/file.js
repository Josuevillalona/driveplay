const express = require('express');
const { getDriveService } = require('../drive');

const router = express.Router();

router.get('/:fileId/meta', async (req, res) => {
  try {
    const drive = getDriveService();
    const { data } = await drive.files.get({
      fileId: req.params.fileId,
      fields: 'id,name,mimeType,size',
      supportsAllDrives: true,
    });

    res.json({
      id: data.id,
      name: data.name,
      mimeType: data.mimeType,
      size: data.size,
    });
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('Error fetching file metadata:', err.message);
    res.status(500).json({ error: 'Failed to fetch file metadata' });
  }
});

module.exports = router;
