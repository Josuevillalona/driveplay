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
  });
}

module.exports = app;
