import * as fs from 'fs';
import * as path from 'path';
import { DirectoryScanner } from '../directory-scanner';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DirectoryScanner', () => {
  const mockProfileContent = 'work';
  const testDir = '/test/directory';
  const profileFileName = '.kontext-profile';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fs.promises
    mockFs.promises = {
      ...mockFs.promises,
      readFile: jest.fn(),
      writeFile: jest.fn(),
      access: jest.fn(),
      unlink: jest.fn(),
    };
  });

  describe('findProfileFile', () => {
    it('should find profile file in current directory', async () => {
      const profilePath = path.join(testDir, profileFileName);

      // Mock file exists in current directory
      (mockFs.promises.access as jest.Mock).mockResolvedValueOnce(undefined); // File exists

      const result = await DirectoryScanner.findProfileFile(testDir);
      expect(result).toBe(profilePath);
    });

    it('should find profile file in parent directory', async () => {
      const parentDir = path.dirname(testDir);
      const profilePath = path.join(parentDir, profileFileName);

      // Mock file doesn't exist in current dir, but exists in parent
      (mockFs.promises.access as jest.Mock)
        .mockRejectedValueOnce(new Error('Not found')) // Current dir
        .mockResolvedValueOnce(undefined); // Parent dir

      const result = await DirectoryScanner.findProfileFile(testDir);
      expect(result).toBe(profilePath);
    });

    it('should return null if no profile file found', async () => {
      // Mock file doesn't exist anywhere
      (mockFs.promises.access as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await DirectoryScanner.findProfileFile(testDir);
      expect(result).toBe(null);
    });
  });

  describe('readProfileName', () => {
    it('should read and trim profile name from file', async () => {
      const profilePath = path.join(testDir, profileFileName);
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('  work  \\n');

      const result = await DirectoryScanner.readProfileName(profilePath);
      expect(result).toBe('work');
    });

    it('should throw error for empty profile file', async () => {
      const profilePath = path.join(testDir, profileFileName);
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('  \\n');

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

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(profilePath, 'work\\n', 'utf8');
    });

    it('should throw error if profile file already exists', async () => {
      // Mock file exists
      (mockFs.promises.access as jest.Mock).mockResolvedValue(undefined);

      await expect(DirectoryScanner.createProfileFile(testDir, 'work')).rejects.toThrow(
        'Profile file already exists'
      );
    });

    it('should validate profile name before creating file', async () => {
      await expect(DirectoryScanner.createProfileFile(testDir, 'invalid name!')).rejects.toThrow(
        /Invalid profile name/
      );
    });
  });

  describe('getActiveProfile', () => {
    it('should return profile name from current directory context', async () => {
      const profilePath = path.join(testDir, profileFileName);

      // Mock finding and reading profile file
      (mockFs.promises.access as jest.Mock).mockResolvedValue(undefined);
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('work');

      const result = await DirectoryScanner.getActiveProfile(testDir);
      expect(result).toBe('work');
    });

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
