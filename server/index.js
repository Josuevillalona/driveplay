const express = require('express');
const path = require('path');
const config = require('./config');
const fileRoutes = require('./routes/file');
const streamRoutes = require('./routes/stream');
const openRoutes = require('./routes/open');

const jobsRoutes = require('./routes/jobs');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/file', fileRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/open', openRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`DrivePlay running on port ${config.port}`);

    // Internal "Cron" logic: Auto-run thumbnail generation every 60 minutes.
    // This avoids needing Render's paid cron tier.
    if (config.sharedDriveId) {
      console.log('Automated thumbnail generation scheduled internally using setInterval (60m).');

      const runThumbnailJob = () => {
        try {
          const http = require('http');
          const req = http.request({
            host: 'localhost',
            port: config.port,
            path: '/api/jobs/thumbnails',
            method: 'POST'
          }, (res) => {
            console.log(`Internal cron started job - Status: ${res.statusCode}`);
          });
          req.on('error', (err) => console.error('Failed to trigger internal thumbnail job:', err.message));
          req.end();
        } catch (err) {
          console.error('Failed to execute internal thumbnail request:', err.message);
        }
      };

      // Run it 10 seconds after boot to process anything recent
      setTimeout(runThumbnailJob, 10000);

      // Then run it every hour
      setInterval(runThumbnailJob, 60 * 60 * 1000);
    }
  });
}

module.exports = app;
