const express = require('express');
const { getDriveService } = require('../drive');
const { withRetry } = require('../retry');

const router = express.Router();

router.get('/:fileId', async (req, res) => {
  try {
    const subjectEmail = req.query.u || null;
    const drive = getDriveService(subjectEmail);
    const rangeHeader = req.headers.range;

    // First, get file metadata to know the MIME type and size.
    // We need this because the googleapis stream response doesn't
    // reliably return headers.
    const { data: meta } = await drive.files.get({
      fileId: req.params.fileId,
      fields: 'mimeType,size',
      supportsAllDrives: true,
    });

    const fileSize = parseInt(meta.size, 10);
    const mimeType = meta.mimeType || 'video/mp4';

    console.log(`Stream: file=${req.params.fileId}, mime=${mimeType}, size=${fileSize}, range=${rangeHeader || 'none'}`);

    if (rangeHeader) {
      // Parse the range header: "bytes=START-END"
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Request just the byte range from Drive
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
      // Full file download (no range)
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

    // Handle stream errors
    res.on('close', () => {
      // Client disconnected, nothing to do
    });
  } catch (err) {
    console.error('Drive stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file' });
    }
  }
});

module.exports = router;
