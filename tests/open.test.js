const request = require('supertest');
const app = require('../server/index');
const { getDriveService } = require('../server/drive');

jest.mock('../server/drive');

describe('GET /open', () => {
  beforeEach(() => {
    getDriveService.mockReturnValue({
      files: {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 'abc123',
            name: 'my-video.mp4',
            mimeType: 'video/mp4',
            size: '5242880',
          },
        }),
      },
    });
  });

  it('renders player page for valid state param', async () => {
    const state = JSON.stringify({
      ids: ['abc123'],
      userId: 'user1',
      action: 'open',
    });

    const res = await request(app).get(`/open?state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('abc123');
    expect(res.text).toContain('my-video.mp4');
  });

  it('returns 400 for missing state param', async () => {
    const res = await request(app).get('/open');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid state param', async () => {
    const res = await request(app).get('/open?state=garbage');
    expect(res.status).toBe(400);
  });
});
