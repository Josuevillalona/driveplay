const ffmpeg = require('fluent-ffmpeg');
const { getDriveService } = require('./drive');
const stream = require('stream');

/**
 * Generates a thumbnail for a given Drive video file.
 * Returns a Base64-encoded PNG string.
 */
async function generateThumbnailBase64(fileId) {
    const drive = getDriveService();

    // Get an access token we can pass directly to ffmpeg
    const authClient = drive.context._options.auth;
    const { token } = await authClient.getAccessToken();

    const videoUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

    return new Promise((resolve, reject) => {
        console.log(`Generating thumbnail for ${fileId}...`);

        // We use a passthrough stream to capture the output image buffer
        const outStream = new stream.PassThrough();
        const chunks = [];

        outStream.on('data', chunk => chunks.push(chunk));

        outStream.on('end', () => {
            clearTimeout(killTimer);
            if (chunks.length === 0) {
                return reject(new Error('Stream ended but no frame data was captured'));
            }
            const buffer = Buffer.concat(chunks);
            resolve(buffer.toString('base64'));
        });
        outStream.on('error', (err) => {
            clearTimeout(killTimer);
            reject(err);
        });

        // Provide the Google Drive URL to ffmpeg, passing the auth token to headers.
        // This allows ffmpeg to intelligently seek via HTTP Range requests without downloading the massive file.
        const command = ffmpeg(videoUrl)
            .inputOptions([
                '-headers', `Authorization: Bearer ${token}\r\n`,
                '-probesize', '500M',     // Limit scanning to 500MB
                '-analyzeduration', '1000M' // Generous buffer for large files with late MOOV atoms
            ])
            // Seek 1 second into the video (lowered from 5s to avoid errors on short clips).
            .seekInput(1)
            // We only want to process 1 frame
            .frames(1)
            // Resize to a thumbnail-friendly size, keeping aspect ratio
            .size('640x?')
            // Output to PNG format on a pipe
            .format('image2pipe')
            .outputOptions([
                '-vcodec png'
            ])
            .on('error', (err) => {
                console.error(`FFmpeg error for ${fileId}:`, err.message);
                clearTimeout(killTimer);
                reject(err);
            })
            .on('end', () => {
                console.log(`FFmpeg command completed for ${fileId}, waiting for stream closure...`);
            });

        // Manual 45-second timeout to kill the FFmpeg process if the Google Drive stream hangs
        const killTimer = setTimeout(() => {
            console.error(`FFmpeg process timed out for ${fileId}`);
            command.kill('SIGKILL'); // Force kill the ffmpeg process
            reject(new Error('FFmpeg processing timed out after 45 seconds'));
        }, 45000);

        command.pipe(outStream, { end: true });
    });
}

/**
 * Uploads a base64 encoded PNG to a file's contentHints in Google Drive.
 */
async function uploadThumbnailToDrive(fileId, base64Data) {
    const drive = getDriveService();
    console.log(`Uploading thumbnail for ${fileId} back to Drive...`);

    const res = await drive.files.update({
        fileId,
        supportsAllDrives: true,
        requestBody: {
            contentHints: {
                thumbnail: {
                    image: base64Data,
                    mimeType: 'image/png'
                }
            }
        }
    });

    return res.data;
}

module.exports = {
    generateThumbnailBase64,
    uploadThumbnailToDrive
};
