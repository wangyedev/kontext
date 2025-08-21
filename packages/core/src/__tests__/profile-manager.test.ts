import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProfileManager } from '../profile-manager';
import { Profile } from '../types';

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

describe('ProfileManager', () => {
  let profileManager: ProfileManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), 'kontext-test-' + Date.now());
    
    // Reset mocks
    jest.clearAllMocks();

    // Mock fs.existsSync to return false initially
    mockFs.existsSync.mockReturnValue(false);

    // Mock fs.mkdirSync
    mockFs.mkdirSync.mockImplementation(() => '');
    
    // Mock fs.promises methods
    (mockFs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
    (mockFs.promises.readFile as jest.Mock).mockResolvedValue('');
    (mockFs.promises.readdir as jest.Mock).mockResolvedValue([]);
    (mockFs.promises.access as jest.Mock).mockResolvedValue(undefined);
    (mockFs.promises.unlink as jest.Mock).mockResolvedValue(undefined);
    
    profileManager = new ProfileManager(tempDir);
  });

  describe('constructor', () => {
    it('should create profiles directory if it does not exist', () => {
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(tempDir, { recursive: true });
    });

    it('should use default directory if none provided', () => {
      const defaultManager = new ProfileManager();
      expect(defaultManager.getProfilesPath()).toBe(
        path.join(os.homedir(), '.config', 'kontext', 'profiles')
      );
    });
  });

  describe('createProfile', () => {
    const testProfile: Profile = {
      name: 'test',
      git: {
        userName: 'Test User',
        userEmail: 'test@example.com',
      },
      environment: {
        variables: {
          NODE_ENV: 'test',
        },
      },
    };

    beforeEach(() => {
      // Mock fs.promises.writeFile
      (mockFs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    it('should create a new profile successfully', async () => {
      await profileManager.createProfile(testProfile);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        path.join(tempDir, 'test.yml'),
        expect.stringContaining('name: test'),
        'utf8'
      );
    });

    it('should throw error if profile already exists', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await expect(profileManager.createProfile(testProfile)).rejects.toThrow(
        'Profile "test" already exists'
      );
    });
  });

  describe('listProfiles', () => {

    it('should return empty array if profiles directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const profiles = await profileManager.listProfiles();
      expect(profiles).toEqual([]);
    });

    it('should return list of profile names', async () => {
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.promises.readdir as jest.Mock).mockResolvedValue([
        'work.yml',
        'personal.yaml',
        'temp.txt', // Should be filtered out
      ]);

      const profiles = await profileManager.listProfiles();
      expect(profiles).toEqual(['work', 'personal']);
    });
  });

  describe('profileExists', () => {
    it('should return true if profile file exists', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const exists = await profileManager.profileExists('test');
      expect(exists).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(tempDir, 'test.yml'));
    });

    it('should return false if profile file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const exists = await profileManager.profileExists('test');
      expect(exists).toBe(false);
    });
  });
});
