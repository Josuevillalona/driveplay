const express = require('express');
const { getDriveService } = require('../drive');
const config = require('../config');
const { generateThumbnailBase64, uploadThumbnailToDrive } = require('../thumbnail');

const router = express.Router();

// A simple in-memory flag to prevent concurrent jobs from running
let isJobRunning = false;
let jobStatus = { processed: 0, errors: 0, skipped: 0, total: 0 };

async function startThumbnailBatch() {
    if (isJobRunning) {
        console.log('Thumbnail job is already running, skipping start request.');
        return;
    }

    const driveId = config.sharedDriveId;
    if (!driveId) {
        console.error('SHARED_DRIVE_ID is not configured in environment parameters');
        return;
    }

    isJobRunning = true;
    jobStatus = { processed: 0, errors: 0, skipped: 0, total: 0 };
    console.log('Thumbnail batch job started internally.');

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

        console.log(`Starting to scan Shared Drive for videos...`);

        // Process page by page instead of loading 19,500 file objects into memory at once
        do {
            if (pageToken) queryOptions.pageToken = pageToken;
            const result = await drive.files.list(queryOptions);
            const videos = result.data.files;

            for (const file of videos) {
                jobStatus.total++; // We count total as we go now since we aren't loading all upfront

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

                    // Throttle: Wait 5 seconds before the next video.
                    // This gives the CPU time to breathe and serve actual requested video streams.
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (err) {
                    console.error(`Failed to generate/upload thumbnail for ${file.id}:`, err.message);
                    jobStatus.errors++;
                }
            }
            pageToken = result.data.nextPageToken;
        } while (pageToken);

        console.log('Thumbnail batch job completed.', jobStatus);
    } catch (err) {
        console.error('Fatal error during thumbnail batch job:', err);
    } finally {
        isJobRunning = false;
    }
}

router.post('/thumbnails', (req, res) => {
    if (isJobRunning) {
        return res.status(409).json({ error: 'Thumbnail job is already running', status: jobStatus });
    }

    const driveId = config.sharedDriveId;
    if (!driveId) {
        return res.status(500).json({ error: 'SHARED_DRIVE_ID is not configured in environment parameters' });
    }

    startThumbnailBatch(); // Fire and forget
    
    res.json({ message: 'Thumbnail batch job started', driveId });
});

router.get('/thumbnails/status', (req, res) => {
    res.json({ isJobRunning, status: jobStatus });
});

router.startThumbnailBatch = startThumbnailBatch;
module.exports = router;
