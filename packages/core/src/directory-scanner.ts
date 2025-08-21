import * as fs from 'fs';
import * as path from 'path';

export class DirectoryScanner {
  private static readonly PROFILE_FILE_NAME = '.kontext-profile';

  /**
   * Scans from the current directory up to the root to find a .kontext-profile file
   */
  static async findProfileFile(startDir?: string): Promise<string | null> {
    const currentDir = startDir || process.cwd();
    let searchDir = path.resolve(currentDir);
    const root = path.parse(searchDir).root;

    while (searchDir !== root) {
      const profilePath = path.join(searchDir, this.PROFILE_FILE_NAME);
      
      if (await this.fileExists(profilePath)) {
        return profilePath;
      }

      const parentDir = path.dirname(searchDir);
      if (parentDir === searchDir) {
        break;
      }
      searchDir = parentDir;
    }

    // Check root directory as well
    const rootProfilePath = path.join(root, this.PROFILE_FILE_NAME);
    if (await this.fileExists(rootProfilePath)) {
      return rootProfilePath;
    }

    return null;
  }

  /**
   * Reads the profile name from a .kontext-profile file
   */
  static async readProfileName(profileFilePath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(profileFilePath, 'utf8');
      const profileName = content.trim();
      
      if (!profileName) {
        throw new Error(`Profile file ${profileFilePath} is empty`);
      }

      // Basic validation for profile name
      if (!/^[a-zA-Z0-9_-]+$/.test(profileName)) {
        throw new Error(`Invalid profile name "${profileName}" in ${profileFilePath}. Profile names must contain only letters, numbers, hyphens, and underscores.`);
      }

      return profileName;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Profile file not found: ${profileFilePath}`);
      }
      throw error;
    }
  }

  /**
   * Creates a .kontext-profile file in the specified directory
   */
  static async createProfileFile(directory: string, profileName: string): Promise<void> {
    const profilePath = path.join(directory, this.PROFILE_FILE_NAME);
    
    if (await this.fileExists(profilePath)) {
      throw new Error(`Profile file already exists in ${directory}`);
    }

    // Validate profile name
    if (!/^[a-zA-Z0-9_-]+$/.test(profileName)) {
      throw new Error(`Invalid profile name "${profileName}". Profile names must contain only letters, numbers, hyphens, and underscores.`);
    }

    await fs.promises.writeFile(profilePath, profileName + '\n', 'utf8');
  }

  /**
   * Gets the directory containing the profile file
   */
  static getProfileFileDirectory(profileFilePath: string): string {
    return path.dirname(profileFilePath);
  }

  /**
   * Checks if a profile file exists in the given directory
   */
  static async hasProfileFile(directory: string): Promise<boolean> {
    const profilePath = path.join(directory, this.PROFILE_FILE_NAME);
    return this.fileExists(profilePath);
  }

  /**
   * Removes a .kontext-profile file from the specified directory
   */
  static async removeProfileFile(directory: string): Promise<void> {
    const profilePath = path.join(directory, this.PROFILE_FILE_NAME);
    
    if (!(await this.fileExists(profilePath))) {
      throw new Error(`No profile file found in ${directory}`);
    }

    await fs.promises.unlink(profilePath);
  }

  /**
   * Finds the active profile for the current directory
   */
  static async getActiveProfile(startDir?: string): Promise<string | null> {
    const profileFilePath = await this.findProfileFile(startDir);
    
    if (!profileFilePath) {
      return null;
    }

    try {
      return await this.readProfileName(profileFilePath);
    } catch (error) {
      // If we can't read the profile file, return null instead of throwing
      console.warn(`Warning: Could not read profile file ${profileFilePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}