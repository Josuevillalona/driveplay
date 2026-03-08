# DrivePlay MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Node.js proxy that streams Google Drive video files to a Plyr.js web player, integrated via Drive's "Open With" menu for the Own It content team.

**Architecture:** Express server acts as a proxy between the browser video player and Google Drive API. A service account with Domain-Wide Delegation authenticates all requests — no user login. Google's "Open With" sends a file ID via state parameter; the server fetches metadata, then streams byte ranges (HTTP 206) from Drive API to the player.

**Tech Stack:** Node.js, Express, googleapis (Google Drive API v3), Plyr.js, dotenv

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `server/index.js`
- Create: `server/config.js`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `public/.gitkeep`

**Step 1: Initialize project**

```bash
cd /Users/josuevillalonagmail.com/Documents/DrivePlay
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install express googleapis dotenv
npm install --save-dev jest supertest nodemon
```

**Step 3: Create `.gitignore`**

```
node_modules/
.env
```

**Step 4: Create `.env.example`**

```env
PORT=3000
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Step 5: Create `server/config.js`**

```js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
};
```

**Step 6: Create `server/index.js`** (minimal Express server)

```js
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
```

**Step 7: Add scripts to `package.json`**

Update the `scripts` section:
```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "nodemon server/index.js",
    "test": "jest --verbose"
  }
}
```

**Step 8: Write test for health endpoint**

Create `tests/health.test.js`:
```js
const request = require('supertest');
const app = require('../server/index');

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

**Step 9: Run test**

```bash
npm test
```
Expected: PASS

**Step 10: Initialize git and commit**

```bash
git init
git add package.json package-lock.json server/ tests/ .gitignore .env.example public/.gitkeep
git commit -m "feat: project scaffolding with Express server and health endpoint"
```

---

## Task 2: Google Drive Auth Module

**Files:**
- Create: `server/drive.js`
- Create: `tests/drive.test.js`

**Step 1: Write the failing test**

Create `tests/drive.test.js`:
```js
const { getDriveService } = require('../server/drive');

describe('getDriveService', () => {
  it('returns a drive service object with files property', () => {
    const drive = getDriveService();
    expect(drive).toBeDefined();
    expect(drive.files).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/drive.test.js
```
Expected: FAIL — `Cannot find module '../server/drive'`

**Step 3: Write minimal implementation**

Create `server/drive.js`:
```js
const { google } = require('googleapis');
const config = require('./config');

let driveService = null;

function getDriveService() {
  if (driveService) return driveService;

  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  driveService = google.drive({ version: 'v3', auth });
  return driveService;
}

module.exports = { getDriveService };
```

**Step 4: Create a `.env` file for local development**

You will need real service account credentials from GCP to test against real Drive files. For now, create a placeholder `.env`:
```env
PORT=3000
GOOGLE_SERVICE_ACCOUNT_EMAIL=placeholder
GOOGLE_PRIVATE_KEY="placeholder"
```

**Step 5: Run test to verify it passes**

```bash
npm test -- tests/drive.test.js
```
Expected: PASS

**Step 6: Commit**

```bash
git add server/drive.js tests/drive.test.js .env.example
git commit -m "feat: add Google Drive auth module with service account JWT"
```

---

## Task 3: State Parameter Parsing

**Files:**
- Create: `server/state.js`
- Create: `tests/state.test.js`

**Step 1: Write the failing test**

Create `tests/state.test.js`:
```js
const { parseStateParam } = require('../server/state');

describe('parseStateParam', () => {
  it('extracts file ID from valid state JSON', () => {
    const state = JSON.stringify({
      ids: ['abc123'],
      userId: 'user1',
      action: 'open',
    });
    const result = parseStateParam(state);
    expect(result.fileId).toBe('abc123');
    expect(result.userId).toBe('user1');
  });

  it('extracts file ID from URL-encoded state', () => {
    const state = encodeURIComponent(JSON.stringify({
      ids: ['def456'],
      userId: 'user2',
      action: 'open',
    }));
    const result = parseStateParam(state);
    expect(result.fileId).toBe('def456');
  });

  it('returns null for missing ids', () => {
    const state = JSON.stringify({ userId: 'user1', action: 'open' });
    const result = parseStateParam(state);
    expect(result).toBeNull();
  });

  it('returns null for empty ids array', () => {
    const state = JSON.stringify({ ids: [], userId: 'user1', action: 'open' });
    const result = parseStateParam(state);
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const result = parseStateParam('not-json');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseStateParam('');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/state.test.js
```
Expected: FAIL — `Cannot find module '../server/state'`

**Step 3: Write minimal implementation**

Create `server/state.js`:
```js
function parseStateParam(stateStr) {
  if (!stateStr) return null;

  try {
    // Google may send URL-encoded JSON — try decoding first
    let decoded = stateStr;
    try {
      decoded = decodeURIComponent(stateStr);
    } catch {
      // already decoded, use as-is
    }

    const state = JSON.parse(decoded);

    if (!state.ids || !Array.isArray(state.ids) || state.ids.length === 0) {
      return null;
    }

    return {
      fileId: state.ids[0],
      userId: state.userId || null,
    };
  } catch {
    return null;
  }
}

module.exports = { parseStateParam };
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/state.test.js
```
Expected: PASS — all 6 tests green

**Step 5: Commit**

```bash
git add server/state.js tests/state.test.js
git commit -m "feat: add state parameter parser for Google Drive Open With redirect"
```

---

## Task 4: File Metadata Endpoint

**Files:**
- Create: `server/routes/file.js`
- Create: `tests/file.test.js`
- Modify: `server/index.js`

**Step 1: Write the failing test**

Create `tests/file.test.js`:
```js
const request = require('supertest');
const app = require('../server/index');
const { getDriveService } = require('../server/drive');

// Mock the drive service
jest.mock('../server/drive');

describe('GET /api/file/:fileId/meta', () => {
  it('returns file metadata for a valid file ID', async () => {
    getDriveService.mockReturnValue({
      files: {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 'abc123',
            name: 'test-video.mp4',
            mimeType: 'video/mp4',
            size: '1048576',
          },
        }),
      },
    });

    const res = await request(app).get('/api/file/abc123/meta');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('abc123');
    expect(res.body.name).toBe('test-video.mp4');
    expect(res.body.mimeType).toBe('video/mp4');
    expect(res.body.size).toBe('1048576');
  });

  it('returns 404 for file not found', async () => {
    getDriveService.mockReturnValue({
      files: {
        get: jest.fn().mockRejectedValue({ code: 404 }),
      },
    });

    const res = await request(app).get('/api/file/notfound/meta');
    expect(res.status).toBe(404);
  });

  it('returns 500 for unexpected errors', async () => {
    getDriveService.mockReturnValue({
      files: {
        get: jest.fn().mockRejectedValue(new Error('Network error')),
      },
    });

    const res = await request(app).get('/api/file/abc123/meta');
    expect(res.status).toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/file.test.js
```
Expected: FAIL — 404 on the route (not registered yet)

**Step 3: Write minimal implementation**

Create `server/routes/file.js`:
```js
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
```

**Step 4: Register the route in `server/index.js`**

Add after the static middleware line:
```js
const fileRoutes = require('./routes/file');
app.use('/api/file', fileRoutes);
```

Updated `server/index.js`:
```js
const express = require('express');
const path = require('path');
const config = require('./config');
const fileRoutes = require('./routes/file');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/file', fileRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`DrivePlay running on port ${config.port}`);
  });
}

module.exports = app;
```

**Step 5: Run test to verify it passes**

```bash
npm test -- tests/file.test.js
```
Expected: PASS — all 3 tests green

**Step 6: Commit**

```bash
git add server/routes/file.js server/index.js tests/file.test.js
git commit -m "feat: add file metadata endpoint with Shared Drive support"
```

---

## Task 5: Proxy Streaming Endpoint (Core Feature)

**Files:**
- Create: `server/routes/stream.js`
- Create: `tests/stream.test.js`
- Modify: `server/index.js`

This is the most critical task — the proxy that pipes Range requests to Drive API.

**Step 1: Write the failing test**

Create `tests/stream.test.js`:
```js
const request = require('supertest');
const { PassThrough } = require('stream');
const app = require('../server/index');
const { getDriveService } = require('../server/drive');

jest.mock('../server/drive');

function mockDriveStream(content, headers = {}) {
  const stream = new PassThrough();
  stream.push(content);
  stream.push(null);
  return {
    files: {
      get: jest.fn().mockResolvedValue({
        data: stream,
        headers: {
          'content-type': 'video/mp4',
          'content-length': String(content.length),
          ...headers,
        },
      }),
    },
  };
}

describe('GET /api/stream/:fileId', () => {
  it('streams full file when no Range header is sent', async () => {
    const content = Buffer.from('fake-video-data');
    getDriveService.mockReturnValue(mockDriveStream(content));

    const res = await request(app).get('/api/stream/abc123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(Buffer.from(res.body)).toEqual(content);
  });

  it('forwards Range header and returns 206', async () => {
    const content = Buffer.from('partial-data');
    getDriveService.mockReturnValue({
      files: {
        get: jest.fn().mockResolvedValue({
          data: (() => {
            const s = new PassThrough();
            s.push(content);
            s.push(null);
            return s;
          })(),
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-11/1000',
            'content-length': '12',
          },
        }),
      },
    });

    const res = await request(app)
      .get('/api/stream/abc123')
      .set('Range', 'bytes=0-11');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-11/1000');
  });

  it('returns 500 when Drive API fails', async () => {
    getDriveService.mockReturnValue({
      files: {
        get: jest.fn().mockRejectedValue(new Error('API error')),
      },
    });

    const res = await request(app).get('/api/stream/abc123');
    expect(res.status).toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/stream.test.js
```
Expected: FAIL — route not found

**Step 3: Write the streaming proxy**

Create `server/routes/stream.js`:
```js
const express = require('express');
const { getDriveService } = require('../drive');

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

    const response = await drive.files.get(options, driveRequestConfig);

    // Forward relevant headers from Drive response
    const headers = response.headers;
    if (headers['content-type']) res.set('Content-Type', headers['content-type']);
    if (headers['content-length']) res.set('Content-Length', headers['content-length']);
    if (headers['content-range']) res.set('Content-Range', headers['content-range']);
    if (headers['accept-ranges']) res.set('Accept-Ranges', headers['accept-ranges']);

    // Set status: 206 for partial content, 200 for full
    const status = headers['content-range'] ? 206 : 200;
    res.status(status);

    // Pipe the stream directly — never buffer the full file
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
```

**Step 4: Register the route in `server/index.js`**

Add to `server/index.js`:
```js
const streamRoutes = require('./routes/stream');
app.use('/api/stream', streamRoutes);
```

Updated `server/index.js`:
```js
const express = require('express');
const path = require('path');
const config = require('./config');
const fileRoutes = require('./routes/file');
const streamRoutes = require('./routes/stream');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/file', fileRoutes);
app.use('/api/stream', streamRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`DrivePlay running on port ${config.port}`);
  });
}

module.exports = app;
```

**Step 5: Run test to verify it passes**

```bash
npm test -- tests/stream.test.js
```
Expected: PASS — all 3 tests green

**Step 6: Commit**

```bash
git add server/routes/stream.js server/index.js tests/stream.test.js
git commit -m "feat: add proxy streaming endpoint with Range header support"
```

---

## Task 6: "Open With" Route (Entry Point)

**Files:**
- Create: `server/routes/open.js`
- Create: `tests/open.test.js`
- Modify: `server/index.js`

This is the route Google Drive redirects to when a user clicks "Open with DrivePlay".

**Step 1: Write the failing test**

Create `tests/open.test.js`:
```js
const request = require('supertest');
const app = require('../server/index');
const { getDriveService } = require('../server/drive');

jest.mock('../server/drive');

describe('GET /open', () => {
  beforeEach(() => {
    getDriveService.mockReturnValue({
      files: {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 'abc123',
            name: 'my-video.mp4',
            mimeType: 'video/mp4',
            size: '5242880',
          },
        }),
      },
    });
  });

  it('renders player page for valid state param', async () => {
    const state = JSON.stringify({
      ids: ['abc123'],
      userId: 'user1',
      action: 'open',
    });

    const res = await request(app).get(`/open?state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('abc123');
    expect(res.text).toContain('my-video.mp4');
  });

  it('returns 400 for missing state param', async () => {
    const res = await request(app).get('/open');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid state param', async () => {
    const res = await request(app).get('/open?state=garbage');
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/open.test.js
```
Expected: FAIL — route not found

**Step 3: Write the open route**

Create `server/routes/open.js`:
```js
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
```

**Step 4: Create the player HTML renderer**

Create `server/player.js`:
```js
function renderPlayerHTML({ fileId, fileName, mimeType, fileSize }) {
  const sizeMB = fileSize ? (parseInt(fileSize, 10) / (1024 * 1024)).toFixed(1) : 'Unknown';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fileName)} — DrivePlay</title>
  <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .file-info {
      padding: 12px 20px;
      background: #111;
      border-bottom: 1px solid #222;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .file-info h1 {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-info .meta {
      font-size: 12px;
      color: #888;
      white-space: nowrap;
    }
    .player-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .player-container video {
      max-width: 100%;
      max-height: calc(100vh - 80px);
    }
    .error-message {
      padding: 40px;
      text-align: center;
      color: #ef4444;
      display: none;
    }
  </style>
</head>
<body>
  <div class="file-info">
    <h1>${escapeHtml(fileName)}</h1>
    <span class="meta">${sizeMB} MB</span>
  </div>
  <div class="player-container">
    <video id="player" controls crossorigin playsinline>
      <source src="/api/stream/${encodeURIComponent(fileId)}" type="${escapeHtml(mimeType)}" />
    </video>
  </div>
  <div class="error-message" id="error">
    Failed to load video. The file may not be accessible.
  </div>
  <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
  <script>
    const player = new Plyr('#player', {
      controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
    });
    document.querySelector('video').addEventListener('error', function() {
      document.getElementById('error').style.display = 'block';
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { renderPlayerHTML };
```

**Step 5: Register the open route in `server/index.js`**

Updated `server/index.js`:
```js
const express = require('express');
const path = require('path');
const config = require('./config');
const fileRoutes = require('./routes/file');
const streamRoutes = require('./routes/stream');
const openRoutes = require('./routes/open');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/file', fileRoutes);
app.use('/api/stream', streamRoutes);
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
```

**Step 6: Run test to verify it passes**

```bash
npm test -- tests/open.test.js
```
Expected: PASS — all 3 tests green

**Step 7: Commit**

```bash
git add server/routes/open.js server/player.js server/index.js tests/open.test.js
git commit -m "feat: add Open With route and player HTML renderer"
```

---

## Task 7: Error Handling — Rate Limit Retry

**Files:**
- Create: `server/retry.js`
- Create: `tests/retry.test.js`

**Step 1: Write the failing test**

Create `tests/retry.test.js`:
```js
const { withRetry } = require('../server/retry');

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds', async () => {
    const err429 = new Error('Rate limited');
    err429.code = 429;

    const fn = jest.fn()
      .mockRejectedValueOnce(err429)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exceeded', async () => {
    const err429 = new Error('Rate limited');
    err429.code = 429;

    const fn = jest.fn().mockRejectedValue(err429);

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow('Rate limited');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry on non-429 errors', async () => {
    const err = new Error('Not found');
    err.code = 404;

    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('Not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/retry.test.js
```
Expected: FAIL — `Cannot find module '../server/retry'`

**Step 3: Write minimal implementation**

Create `server/retry.js`:
```js
async function withRetry(fn, { maxRetries = 3, baseDelay = 1000 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (err.code !== 429 || attempt === maxRetries) {
        throw err;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = { withRetry };
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/retry.test.js
```
Expected: PASS — all 4 tests green

**Step 5: Integrate retry into stream route**

Update `server/routes/stream.js` — wrap the `drive.files.get` call:

Replace:
```js
const response = await drive.files.get(options, driveRequestConfig);
```

With:
```js
const { withRetry } = require('../retry');
// ... inside the handler:
const response = await withRetry(() => drive.files.get(options, driveRequestConfig));
```

Full updated `server/routes/stream.js`:
```js
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
```

**Step 6: Run all tests**

```bash
npm test
```
Expected: ALL PASS

**Step 7: Commit**

```bash
git add server/retry.js server/routes/stream.js tests/retry.test.js
git commit -m "feat: add exponential backoff retry for Drive API 429 rate limits"
```

---

## Task 8: Landing Page (Root Route)

**Files:**
- Create: `public/index.html`

This is a simple page shown when someone visits the root URL directly (not via "Open With"). It explains what DrivePlay is and how to use it.

**Step 1: Create `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DrivePlay</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 20px;
    }
    .container { max-width: 480px; }
    h1 { font-size: 32px; margin-bottom: 12px; }
    p { color: #888; line-height: 1.6; margin-bottom: 16px; }
    .instructions {
      background: #111;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 20px;
      text-align: left;
      margin-top: 24px;
    }
    .instructions h2 { font-size: 14px; color: #888; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .instructions ol { padding-left: 20px; }
    .instructions li { margin-bottom: 8px; line-height: 1.5; color: #ccc; }
  </style>
</head>
<body>
  <div class="container">
    <h1>DrivePlay</h1>
    <p>Stream Google Drive videos instantly. No downloads, no processing errors.</p>
    <div class="instructions">
      <h2>How to use</h2>
      <ol>
        <li>Open Google Drive in Chrome</li>
        <li>Right-click any video file (MP4, MOV)</li>
        <li>Select <strong>Open with &rarr; DrivePlay</strong></li>
        <li>Video plays immediately</li>
      </ol>
    </div>
  </div>
</body>
</html>
```

**Step 2: Test manually**

```bash
npm run dev
# Visit http://localhost:3000 in browser
```
Expected: See the DrivePlay landing page

**Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add landing page with usage instructions"
```

---

## Task 9: Render Deployment Configuration

**Files:**
- Create: `render.yaml`

**Step 1: Create `render.yaml`**

```yaml
services:
  - type: web
    name: driveplay
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: PORT
        value: 3000
      - key: GOOGLE_SERVICE_ACCOUNT_EMAIL
        sync: false
      - key: GOOGLE_PRIVATE_KEY
        sync: false
```

**Step 2: Verify the app starts cleanly**

```bash
npm start
# Should print: "DrivePlay running on port 3000"
# Ctrl+C to stop
```

**Step 3: Run full test suite one final time**

```bash
npm test
```
Expected: ALL PASS — all tests across all files green

**Step 4: Commit**

```bash
git add render.yaml
git commit -m "feat: add Render deployment configuration"
```

---

## Task 10: Manual Integration Test Checklist

This task is not code — it's the validation to run once real GCP credentials are configured.

**Prerequisites (manual GCP setup required):**
1. Create GCP project
2. Enable Google Drive API
3. Create service account
4. Enable Domain-Wide Delegation for the service account
5. In Workspace Admin, grant the service account `drive.readonly` scope
6. Download service account key and set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` in `.env`
7. Enable Google Drive SDK in GCP Console
8. Configure "Drive UI Integration" → set Open URL to `https://<your-render-url>/open`
9. Add MIME types: `video/mp4`, `video/quicktime`
10. Force-install for Own It team via Workspace Admin

**Integration tests to run manually:**

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Visit `https://<url>/health` | `{"status":"ok"}` |
| 2 | Visit `https://<url>/` | Landing page renders |
| 3 | Right-click MP4 in Shared Drive → Open with DrivePlay | Video plays in new tab |
| 4 | Seek to middle of a large (1GB+) file | Seeks within 3 seconds |
| 5 | Right-click MOV in Shared Drive → Open with DrivePlay | Video plays |
| 6 | Open a file from personal My Drive (if applicable) | Either plays or shows clear error |
| 7 | Open two videos simultaneously (two tabs) | Both stream without issues |

---

## Summary — File Tree After All Tasks

```
DrivePlay/
├── .env                    # Local credentials (git-ignored)
├── .env.example            # Template for env vars
├── .gitignore
├── CLAUDE.md               # Project context
├── DrivePlay_PRD.docx.md   # PRD
├── docs/plans/
│   └── 2026-03-08-driveplay-mvp.md  # This plan
├── package.json
├── render.yaml             # Render deployment config
├── public/
│   └── index.html          # Landing page
├── server/
│   ├── index.js            # Express app entry point
│   ├── config.js           # Environment config
│   ├── drive.js            # Google Drive auth (service account)
│   ├── state.js            # State parameter parser
│   ├── player.js           # Player HTML renderer
│   ├── retry.js            # Exponential backoff utility
│   └── routes/
│       ├── file.js         # GET /api/file/:id/meta
│       ├── stream.js       # GET /api/stream/:id (proxy)
│       └── open.js         # GET /open?state=... (entry point)
└── tests/
    ├── health.test.js
    ├── drive.test.js
    ├── state.test.js
    ├── file.test.js
    ├── stream.test.js
    ├── retry.test.js
    └── open.test.js
```
