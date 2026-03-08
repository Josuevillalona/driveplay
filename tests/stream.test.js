const request = require('supertest');
const { PassThrough } = require('stream');
const app = require('../server/index');
const { getDriveService } = require('../server/drive');

jest.mock('../server/drive');

function mockDriveStream(content, headers = {}) {
  const stream = new PassThrough();
  stream.push(content);
  stream.push(null);
  return {
    files: {
      get: jest.fn().mockResolvedValue({
        data: stream,
        headers: {
          'content-type': 'video/mp4',
          'content-length': String(content.length),
          ...headers,
        },
      }),
    },
  };
}

describe('GET /api/stream/:fileId', () => {
  it('streams full file when no Range header is sent', async () => {
    const content = Buffer.from('fake-video-data');
    getDriveService.mockReturnValue(mockDriveStream(content));

    const res = await request(app).get('/api/stream/abc123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(Buffer.from(res.body)).toEqual(content);
  });

  it('forwards Range header and returns 206', async () => {
    const content = Buffer.from('partial-data');
    getDriveService.mockReturnValue({
      files: {
        get: jest.fn().mockResolvedValue({
          data: (() => {
            const s = new PassThrough();
            s.push(content);
            s.push(null);
            return s;
          })(),
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-11/1000',
            'content-length': '12',
          },
        }),
      },
    });

    const res = await request(app)
      .get('/api/stream/abc123')
      .set('Range', 'bytes=0-11');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-11/1000');
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
