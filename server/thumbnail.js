const ffmpeg = require('fluent-ffmpeg');
const { getDriveService } = require('./drive');
const stream = require('stream');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Downloads a file from Drive directly to the server's local disk.
 */
async function downloadFileToDisk(fileId) {
    const drive = getDriveService();
    const tempFilePath = path.join(os.tmpdir(), `${fileId}.mp4`);
    
    // Check if it already exists from a previous crash and delete it
    if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
    }

    const dest = fs.createWriteStream(tempFilePath);
    const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
        res.data
            .on('end', () => resolve(tempFilePath))
            .on('error', err => reject(err))
            .pipe(dest);
    });
}

/**
 * Phase 2: Guaranteed local disk extraction using FFmpeg natively.
 */
async function generateThumbnailBase64Disk(tempFilePath, fileId) {
    return new Promise((resolve, reject) => {
        const outStream = new stream.PassThrough();
        const chunks = [];

        outStream.on('data', chunk => chunks.push(chunk));
        outStream.on('end', () => {
            clearTimeout(killTimer);
            if (chunks.length === 0) {
                return reject(new Error('Disk Extraction: Stream ended but no frame data was captured'));
            }
            const buffer = Buffer.concat(chunks);
            resolve(buffer.toString('base64'));
        });
        outStream.on('error', (err) => {
            clearTimeout(killTimer);
            reject(err);
        });

        const command = ffmpeg(tempFilePath)
            .seekInput(1)
            .frames(1)
            .size('640x?')
            .format('image2pipe')
            .outputOptions([
                '-vcodec png',
                '-threads 1' // Still limit threads to keep background profile low
            ])
            .on('error', (err) => {
                console.error(`[Disk] FFmpeg error for ${fileId}:`, err.message);
                clearTimeout(killTimer);
                reject(err);
            })
            .on('end', () => {
                console.log(`[Disk] FFmpeg command completed for ${fileId}`);
            });

        // 60-second timeout for local processing
        const killTimer = setTimeout(() => {
            console.error(`[Disk] FFmpeg process timed out for ${fileId}`);
            command.kill('SIGKILL');
            reject(new Error('Disk FFmpeg processing timed out after 60 seconds'));
        }, 60000);

        command.pipe(outStream, { end: true });
    });
}

/**
 * Master Orchestrator: Try Stream first, fallback to Disk.
 */
async function generateThumbnailBase64(fileId) {
    const drive = getDriveService();
    const authClient = drive.context._options.auth;
    const { token } = await authClient.getAccessToken();

    try {
        console.log(`[Phase 1] Attempting fast HTTP stream extraction for ${fileId}...`);
        const base64 = await generateThumbnailBase64Stream(fileId, token);
        return base64;
    } catch (streamErr) {
        console.log(`[Phase 1 Failed] Stream extraction failed for ${fileId}: ${streamErr.message}`);
        console.log(`[Phase 2] Falling back to Guaranteed Disk Extraction for ${fileId}...`);
        
        let tempFilePath = null;
        try {
            console.log(`[Disk] Downloading ${fileId} directly to local storage...`);
            tempFilePath = await downloadFileToDisk(fileId);
            
            console.log(`[Disk] Extracting frame natively from ${tempFilePath}...`);
            const base64 = await generateThumbnailBase64Disk(tempFilePath, fileId);
            return base64;
        } catch (diskErr) {
            console.error(`[Phase 2 Failed] Disk extraction totally failed for ${fileId}:`, diskErr.message);
            throw diskErr;
        } finally {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`[Disk] Cleaned up temporary file ${tempFilePath}`);
            }
        }
    }
}

/**
 * Phase 1: Attempt to stream the file using strict HTTP ranges.
 * This is fast and uses zero disk space, but fails on large files with late MOOV atoms.
 */
async function generateThumbnailBase64Stream(fileId, token) {
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
                '-probesize', '50M',     // Limit scanning to 50MB to prevent buffering OOM
                '-analyzeduration', '100M' // Don't buffer entire giant files into memory if MOOV atom is late
            ])
            // Seek 1 second into the video
            .seekInput(1)
            // We only want to process 1 frame
            .frames(1)
            // Resize to a thumbnail-friendly size, keeping aspect ratio
            .size('640x?')
            // Output to PNG format on a pipe
            .format('image2pipe')
            .outputOptions([
                '-vcodec png',
                '-threads 1' // Limit CPU threads to 1 to drastically lower RAM usage and prevent Container OOM crashes
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
