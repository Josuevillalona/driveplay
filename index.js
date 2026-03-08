const app = require('./server/index');
const config = require('./server/config');

app.listen(config.port, () => {
  console.log(`DrivePlay running on port ${config.port}`);
});
