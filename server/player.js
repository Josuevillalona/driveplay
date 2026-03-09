function renderPlayerHTML({ fileId, fileName, mimeType, fileSize, userEmail }) {
  const sizeMB = fileSize ? (parseInt(fileSize, 10) / (1024 * 1024)).toFixed(1) : 'Unknown';
  const streamUrl = userEmail
    ? `/api/stream/${encodeURIComponent(fileId)}?u=${encodeURIComponent(userEmail)}`
    : `/api/stream/${encodeURIComponent(fileId)}`;

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
      <source src="${streamUrl}" type="${escapeHtml(mimeType)}" />
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
