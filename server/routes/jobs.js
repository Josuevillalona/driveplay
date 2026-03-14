const express = require('express');
const { getDriveService } = require('../drive');
const config = require('../config');
const { generateThumbnailBase64, uploadThumbnailToDrive } = require('../thumbnail');

const router = express.Router();

// A simple in-memory flag to prevent concurrent jobs from running
let isJobRunning = false;
let jobStatus = { processed: 0, errors: 0, skipped: 0, total: 0 };

router.post('/thumbnails', async (req, res) => {
    if (isJobRunning) {
        return res.status(409).json({ error: 'Thumbnail job is already running', status: jobStatus });
    }

    const driveId = config.sharedDriveId;
    if (!driveId) {
        return res.status(500).json({ error: 'SHARED_DRIVE_ID is not configured in environment parameters' });
    }

    isJobRunning = true;
    jobStatus = { processed: 0, errors: 0, skipped: 0, total: 0 };
    res.json({ message: 'Thumbnail batch job started', driveId });

    try {
        const drive = getDriveService();

        // Query to find all video files in the specified shared drive
        let pageToken;
        let queryOptions = {
            q: "mimeType contains 'video/'",
            corpora: 'drive',
            driveId: driveId,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'nextPageToken, files(id, name, hasThumbnail, contentHints)',
            pageSize: 100
        };

        let allVideos = [];
        do {
            if (pageToken) queryOptions.pageToken = pageToken;
            const result = await drive.files.list(queryOptions);
            allVideos = allVideos.concat(result.data.files);
            pageToken = result.data.nextPageToken;
        } while (pageToken);

        jobStatus.total = allVideos.length;
        console.log(`Found ${jobStatus.total} video files in Shared Drive.`);

        // Process sequentially to avoid memory overload from concurrent ffmpeg processes
        for (const file of allVideos) {
            if (file.hasThumbnail) {
                // Skip files that already have a thumbnail (Google's native one or our custom one)
                jobStatus.skipped++;
                continue;
            }

            console.log(`Processing file: ${file.name} (ID: ${file.id})`);
            try {
                const base64Data = await generateThumbnailBase64(file.id);
                await uploadThumbnailToDrive(file.id, base64Data);
                jobStatus.processed++;
            } catch (err) {
                console.error(`Failed to generate/upload thumbnail for ${file.id}:`, err.message);
                jobStatus.errors++;
            }
        }

        console.log('Thumbnail batch job completed.', jobStatus);
    } catch (err) {
        console.error('Fatal error during thumbnail batch job:', err);
    } finally {
        isJobRunning = false;
    }
});

router.get('/thumbnails/status', (req, res) => {
    res.json({ isJobRunning, status: jobStatus });
});

module.exports = router;
