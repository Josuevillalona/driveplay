const { getDriveService } = require('../server/drive');

describe('getDriveService', () => {
  it('returns a drive service object with files property', () => {
    const drive = getDriveService();
    expect(drive).toBeDefined();
    expect(drive.files).toBeDefined();
  });
});
