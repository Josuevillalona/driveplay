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
            const buffer = Buffer.concat(chunks);
            const base64 = buffer.toString('base64');
            // Format as URL-safe base64 string
            resolve(base64);
        });
        outStream.on('error', reject);

        // Provide the Google Drive URL to ffmpeg, passing the auth token to headers.
        // This allows ffmpeg to intelligently seek via HTTP Range requests without downloading the massive file.
        const command = ffmpeg(videoUrl)
            .inputOptions([
                '-headers', `Authorization: Bearer ${token}\r\n`
            ])
            // Seek 5 seconds into the video. Format can be a simple number.
            .seekInput(5)
            // We only want to process 1 frame
            .frames(1)
            // Resize to a thumbnail-friendly size, keeping aspect ratio
            .size('640x?')
            // Output to PNG format on a pipe
            .format('image2pipe')
            .outputOptions(['-vcodec png'])
            .on('error', (err) => {
                console.error(`FFmpeg error for ${fileId}:`, err.message);
                reject(err);
            })
            .on('end', () => {
                console.log(`FFmpeg finished for ${fileId}.`);
            });

        // Add a 45-second timeout so a stuck Google Drive stream doesn't hang the Node process permanently
        command.timeout(45);
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
