const request = require('supertest');
const app = require('../server/index');
const { getDriveService } = require('../server/drive');

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
