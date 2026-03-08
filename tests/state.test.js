const { parseStateParam } = require('../server/state');

describe('parseStateParam', () => {
  it('extracts file ID from valid state JSON', () => {
    const state = JSON.stringify({
      ids: ['abc123'],
      userId: 'user1',
      action: 'open',
    });
    const result = parseStateParam(state);
    expect(result.fileId).toBe('abc123');
    expect(result.userId).toBe('user1');
  });

  it('extracts file ID from URL-encoded state', () => {
    const state = encodeURIComponent(JSON.stringify({
      ids: ['def456'],
      userId: 'user2',
      action: 'open',
    }));
    const result = parseStateParam(state);
    expect(result.fileId).toBe('def456');
  });

  it('extracts file ID from exportIds in valid state JSON (Google Workspace documents)', () => {
    const state = JSON.stringify({
      exportIds: ['xyz789'],
      userId: 'user3',
      action: 'open',
    });
    const result = parseStateParam(state);
    expect(result.fileId).toBe('xyz789');
    expect(result.userId).toBe('user3');
  });

  it('returns null for missing ids', () => {
    const state = JSON.stringify({ userId: 'user1', action: 'open' });
    const result = parseStateParam(state);
    expect(result).toBeNull();
  });

  it('returns null for empty ids array', () => {
    const state = JSON.stringify({ ids: [], userId: 'user1', action: 'open' });
    const result = parseStateParam(state);
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const result = parseStateParam('not-json');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseStateParam('');
    expect(result).toBeNull();
  });
});
