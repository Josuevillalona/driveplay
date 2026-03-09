const express = require('express');
const { getDriveService } = require('../drive');
const { withRetry } = require('../retry');

const router = express.Router();

router.get('/:fileId', async (req, res) => {
  try {
    const subjectEmail = req.query.u || null;
    const drive = getDriveService(subjectEmail);
    const rangeHeader = req.headers.range;

    // Fetch metadata for MIME type and size (googleapis doesn't
    // reliably return headers on stream responses).
    const { data: meta } = await drive.files.get({
      fileId: req.params.fileId,
      fields: 'mimeType,size',
      supportsAllDrives: true,
    });

    const fileSize = parseInt(meta.size, 10);
    const mimeType = meta.mimeType || 'video/mp4';

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const response = await withRetry(() =>
        drive.files.get(
          { fileId: req.params.fileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream', headers: { Range: `bytes=${start}-${end}` } }
        )
      );

      res.status(206);
      res.set({
        'Content-Type': mimeType,
        'Content-Length': chunkSize,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
      });

      response.data.pipe(res);
    } else {
      const response = await withRetry(() =>
        drive.files.get(
          { fileId: req.params.fileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream' }
        )
      );

      res.status(200);
      res.set({
        'Content-Type': mimeType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
      });

      response.data.pipe(res);
    }
  } catch (err) {
    if (!res.headersSent) {
      const code = err.code || 500;
      if (code === 404) {
        return res.status(404).json({ error: 'File not found' });
      }
      if (code === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again shortly.' });
      }
      console.error('Drive stream error:', err.message);
      res.status(500).json({ error: 'Failed to stream file' });
    }
  }
});

module.exports = router;
