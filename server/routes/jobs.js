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

    // Priority folder: process this folder first before the full drive scan
    const PRIORITY_FOLDER_ID = '1t_jrHabkVTR2tc_e63wAIo2JS_02Vt6n'; // "2025 - figure out issues?"

    // Helper function to encapsulate file processing with retry logic
    async function processFileWithRetry(file) {
        let success = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const base64Data = await generateThumbnailBase64(file.id);
                await uploadThumbnailToDrive(file.id, base64Data);
                jobStatus.processed++;
                success = true;

                // Tiny 100ms breather to prevent locking the Node.js event loop
                await new Promise(resolve => setTimeout(resolve, 100));
                break; // success, stop retrying
            } catch (err) {
                if (err.isQuotaError && attempt < 3) {
                    console.warn(`[Quota] Hit downloadQuotaExceeded for ${file.id}. Waiting 60s before retry (attempt ${attempt}/3)...`);
                    await new Promise(resolve => setTimeout(resolve, 60000));
                } else {
                    console.error(`Failed to generate/upload thumbnail for ${file.id} (attempt ${attempt}):`, err.message);
                    if (attempt === 3) jobStatus.errors++;
                }
            }
        }
    }

    try {
        const drive = getDriveService();

        // ---- PRIORITY PASS: Process the priority folder first ----
        console.log(`[Priority] Scanning priority folder first (ID: ${PRIORITY_FOLDER_ID})...`);
        let priorityPageToken;
        do {
            const priorityOptions = {
                q: `mimeType contains 'video/' and '${PRIORITY_FOLDER_ID}' in parents`,
                corpora: 'drive',
                driveId: driveId,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                fields: 'nextPageToken, files(id, name, hasThumbnail)',
                pageSize: 100,
                ...(priorityPageToken ? { pageToken: priorityPageToken } : {})
            };
            const priorityResult = await drive.files.list(priorityOptions);
            for (const file of priorityResult.data.files) {
                jobStatus.total++;
                // Skip macOS resource fork sidecar files (._filename) - they contain no video data
                if (file.name.startsWith('._')) { jobStatus.skipped++; continue; }
                if (file.hasThumbnail) { jobStatus.skipped++; continue; }
                console.log(`[Priority] Processing: ${file.name} (ID: ${file.id})`);
                await processFileWithRetry(file);
            }
            priorityPageToken = priorityResult.data.nextPageToken;
        } while (priorityPageToken);
        console.log(`[Priority] Priority folder complete. Moving to full drive scan...`);

        // ---- FULL SCAN: Process remaining drive files ----
        let pageToken;
        let queryOptions = {
            q: `mimeType contains 'video/' and not '${PRIORITY_FOLDER_ID}' in parents`,
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
                jobStatus.total++;

                // Skip macOS resource fork sidecar files (._filename) - they contain no video data
                if (file.name.startsWith('._')) {
                    jobStatus.skipped++;
                    continue;
                }

                if (file.hasThumbnail) {
                    // Skip files that already have a thumbnail (Google's native one or our custom one)
                    jobStatus.skipped++;
                    continue;
                }

                console.log(`Processing file: ${file.name} (ID: ${file.id})`);
                await processFileWithRetry(file);
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
