const express = require('express');
const { getDriveService } = require('../drive');
const { withRetry } = require('../retry');

const router = express.Router();

router.get('/:fileId', async (req, res) => {
  try {
    // If a user email was passed (from impersonation flow), use it.
    // Otherwise, use direct service account access.
    const subjectEmail = req.query.u || null;
    const drive = getDriveService(subjectEmail);
    const rangeHeader = req.headers.range;

    console.log(`Stream request for file: ${req.params.fileId}, user: ${subjectEmail || 'SA direct'}, range: ${rangeHeader || 'none'}`);

    const options = {
      fileId: req.params.fileId,
      alt: 'media',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    };

    const driveRequestConfig = {
      responseType: 'stream',
    };

    if (rangeHeader) {
      driveRequestConfig.headers = { Range: rangeHeader };
    }

    const response = await withRetry(() => drive.files.get(options, driveRequestConfig));

    const headers = response.headers;
    console.log('Drive API response headers:', JSON.stringify({
      'content-type': headers['content-type'],
      'content-length': headers['content-length'],
      'content-range': headers['content-range'],
      'accept-ranges': headers['accept-ranges'],
    }));

    // Always set Accept-Ranges so browser knows it can seek
    res.set('Accept-Ranges', 'bytes');
    if (headers['content-type']) res.set('Content-Type', headers['content-type']);
    if (headers['content-length']) res.set('Content-Length', headers['content-length']);
    if (headers['content-range']) res.set('Content-Range', headers['content-range']);

    const status = headers['content-range'] ? 206 : 200;
    res.status(status);

    response.data.pipe(res);

    response.data.on('error', (err) => {
      console.error('Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream failed' });
      }
    });
  } catch (err) {
    console.error('Drive stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file' });
    }
  }
});

module.exports = router;
