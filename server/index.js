const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`DrivePlay running on port ${config.port}`);
  });
}

module.exports = app;
