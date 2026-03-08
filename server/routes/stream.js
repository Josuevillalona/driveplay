const express = require('express');
const { getDriveService } = require('../drive');
const { withRetry } = require('../retry');

const router = express.Router();

router.get('/:fileId', async (req, res) => {
  try {
    const drive = getDriveService();
    const rangeHeader = req.headers.range;

    const options = {
      fileId: req.params.fileId,
      alt: 'media',
      supportsAllDrives: true,
    };

    const driveRequestConfig = {
      responseType: 'stream',
    };

    if (rangeHeader) {
      driveRequestConfig.headers = { Range: rangeHeader };
    }

    const response = await withRetry(() => drive.files.get(options, driveRequestConfig));

    const headers = response.headers;
    if (headers['content-type']) res.set('Content-Type', headers['content-type']);
    if (headers['content-length']) res.set('Content-Length', headers['content-length']);
    if (headers['content-range']) res.set('Content-Range', headers['content-range']);
    if (headers['accept-ranges']) res.set('Accept-Ranges', headers['accept-ranges']);

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
