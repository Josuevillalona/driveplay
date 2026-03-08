const { withRetry } = require('../server/retry');

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds', async () => {
    const err429 = new Error('Rate limited');
    err429.code = 429;

    const fn = jest.fn()
      .mockRejectedValueOnce(err429)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exceeded', async () => {
    const err429 = new Error('Rate limited');
    err429.code = 429;

    const fn = jest.fn().mockRejectedValue(err429);

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow('Rate limited');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-429 errors', async () => {
    const err = new Error('Not found');
    err.code = 404;

    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('Not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
