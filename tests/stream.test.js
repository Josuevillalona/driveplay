const request = require('supertest');
const { PassThrough } = require('stream');
const app = require('../server/index');
const { getDriveService } = require('../server/drive');

jest.mock('../server/drive');

function createMockDrive(content, fileSize) {
  const size = fileSize || content.length;
  return {
    files: {
      get: jest.fn().mockImplementation((opts) => {
        if (opts.alt === 'media') {
          // Stream response
          const stream = new PassThrough();
          stream.push(content);
          stream.push(null);
          return Promise.resolve({ data: stream, headers: {} });
        }
        // Metadata response
        return Promise.resolve({
          data: {
            mimeType: 'video/mp4',
            size: String(size),
          },
        });
      }),
    },
  };
}

describe('GET /api/stream/:fileId', () => {
  it('streams full file when no Range header is sent', async () => {
    const content = Buffer.from('fake-video-data');
    getDriveService.mockReturnValue(createMockDrive(content));

    const res = await request(app).get('/api/stream/abc123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(Buffer.from(res.body)).toEqual(content);
  });

  it('forwards Range header and returns 206', async () => {
    const content = Buffer.from('partial-data');
    getDriveService.mockReturnValue(createMockDrive(content, 1000));

    const res = await request(app)
      .get('/api/stream/abc123')
      .set('Range', 'bytes=0-11');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-11/1000');
    expect(res.headers['content-type']).toBe('video/mp4');
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
