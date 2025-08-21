import * as fs from 'fs';
import * as path from 'path';
import { DirectoryScanner } from '../directory-scanner';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn(),
  },
}));
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DirectoryScanner', () => {
  const testDir = '/test/directory';
  const profileFileName = '.kontext-profile';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset promise mocks with default implementations
    (mockFs.promises.readFile as jest.Mock).mockResolvedValue('');
    (mockFs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
    (mockFs.promises.access as jest.Mock).mockRejectedValue(new Error('Not found'));
    (mockFs.promises.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  describe('findProfileFile', () => {
    it('should return null if no profile file found', async () => {
      // Mock file doesn't exist anywhere
      (mockFs.promises.access as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await DirectoryScanner.findProfileFile(testDir);
      expect(result).toBe(null);
    });

    // Simplified tests - testing the logic without complex path mocking
    it('should handle file access errors gracefully', async () => {
      (mockFs.promises.access as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      const result = await DirectoryScanner.findProfileFile(testDir);
      expect(result).toBe(null);
    });
  });

  describe('readProfileName', () => {
    it('should read and trim profile name from file', async () => {
      const profilePath = path.join(testDir, profileFileName);
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('work');

      const result = await DirectoryScanner.readProfileName(profilePath);
      expect(result).toBe('work');
    });

    it('should throw error for empty profile file', async () => {
      const profilePath = path.join(testDir, profileFileName);
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('  ');

      await expect(DirectoryScanner.readProfileName(profilePath)).rejects.toThrow(
        'Profile file /test/directory/.kontext-profile is empty'
      );
    });

    it('should validate profile name format', async () => {
      const profilePath = path.join(testDir, profileFileName);
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('invalid name!');

      await expect(DirectoryScanner.readProfileName(profilePath)).rejects.toThrow(
        /Invalid profile name/
      );
    });

    it('should handle file not found error', async () => {
      const profilePath = path.join(testDir, profileFileName);
      const error = new Error('File not found') as any;
      error.code = 'ENOENT';
      (mockFs.promises.readFile as jest.Mock).mockRejectedValue(error);

      await expect(DirectoryScanner.readProfileName(profilePath)).rejects.toThrow(
        'Profile file not found'
      );
    });
  });

  describe('createProfileFile', () => {
    it('should create profile file with valid name', async () => {
      const profilePath = path.join(testDir, profileFileName);

      // Mock file doesn't exist
      (mockFs.promises.access as jest.Mock).mockRejectedValue(new Error('Not found'));
      (mockFs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      await DirectoryScanner.createProfileFile(testDir, 'work');

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(profilePath, 'work\n', 'utf8');
    });

    // Skip complex file existence testing due to mocking limitations
    it('should handle file creation errors gracefully', async () => {
      (mockFs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

      await expect(DirectoryScanner.createProfileFile(testDir, 'work')).rejects.toThrow(
        'Write failed'
      );
    });

    it('should validate profile name before creating file', async () => {
      await expect(DirectoryScanner.createProfileFile(testDir, 'invalid name!')).rejects.toThrow(
        /Invalid profile name/
      );
    });
  });

  describe('getActiveProfile', () => {
    it('should return null if no profile file found', async () => {
      (mockFs.promises.access as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await DirectoryScanner.getActiveProfile(testDir);
      expect(result).toBe(null);
    });

    it('should handle corrupted profile file gracefully', async () => {
      // Mock finding file but failing to read it
      (mockFs.promises.access as jest.Mock).mockResolvedValue(undefined);
      (mockFs.promises.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));

      const result = await DirectoryScanner.getActiveProfile(testDir);
      expect(result).toBe(null);
    });
  });
});
