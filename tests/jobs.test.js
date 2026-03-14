const request = require('supertest');
const app = require('../server/index');
const { getDriveService } = require('../server/drive');
const thumbnailService = require('../server/thumbnail');

jest.mock('../server/drive');
jest.mock('../server/thumbnail');

// Since config.js is evaluated once at module load time, we mock the module directly
jest.mock('../server/config', () => ({
    sharedDriveId: process.env.SHOULD_FAIL ? undefined : 'test-drive-id'
}));

describe('POST /api/jobs/thumbnails', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    afterEach(() => {
        delete process.env.SHOULD_FAIL;
        jest.resetModules();
    });

    it('fails if SHARED_DRIVE_ID is not configured', async () => {
        // We must reset modules and require app again to get the mocked config changes inside jobs.js
        jest.resetModules();
        process.env.SHOULD_FAIL = '1';

        // Re-require with fresh mocks
        jest.mock('../server/config', () => ({ sharedDriveId: undefined }));
        const freshApp = require('../server/index');

        const res = await request(freshApp).post('/api/jobs/thumbnails');
        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/SHARED_DRIVE_ID/);
    });

    it('scans drive and uploads thumbnails for videos without one', async () => {
        jest.resetModules();
        jest.mock('../server/config', () => ({ sharedDriveId: 'test-drive-id' }));

        // Have to require fresh app because of jest.resetModules
        const freshApp = require('../server/index');
        const { getDriveService: freshGetDriveService } = require('../server/drive');
        const freshThumbnailService = require('../server/thumbnail');

        const mockFiles = [
            { id: 'f1', name: 'v1.mp4', hasThumbnail: false },
            { id: 'f2', name: 'v2.mp4', hasThumbnail: true, contentHints: { thumbnail: {} } },
        ];

        freshGetDriveService.mockReturnValue({
            files: {
                list: jest.fn().mockResolvedValue({
                    data: { files: mockFiles, nextPageToken: null }
                })
            }
        });

        freshThumbnailService.generateThumbnailBase64.mockResolvedValue('fake-base64');
        freshThumbnailService.uploadThumbnailToDrive.mockResolvedValue({});

        const res = await request(freshApp).post('/api/jobs/thumbnails');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Thumbnail batch job started');

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(freshThumbnailService.generateThumbnailBase64).toHaveBeenCalledWith('f1');
        expect(freshThumbnailService.uploadThumbnailToDrive).toHaveBeenCalledWith('f1', 'fake-base64');
        expect(freshThumbnailService.generateThumbnailBase64).not.toHaveBeenCalledWith('f2');
    });
});
