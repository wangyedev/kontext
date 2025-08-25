import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export interface DotfileBackup {
  originalPath: string;
  backupPath: string;
  wasSymlink: boolean;
  symlinkTarget?: string;
}

export class ConfigFileManager {
  private static backups: Map<string, DotfileBackup> = new Map();

  /**
   * Creates symlinks for dotfiles from profile directory to home directory
   */
  static async applyDotfiles(profileDir: string, dotfiles: Record<string, string>): Promise<void> {
    for (const [targetPath, sourcePath] of Object.entries(dotfiles)) {
      await this.createDotfileSymlink(profileDir, targetPath, sourcePath);
    }
  }

  /**
   * Removes dotfile symlinks and restores original files
   */
  static async removeDotfiles(dotfiles: Record<string, string>): Promise<void> {
    for (const targetPath of Object.keys(dotfiles)) {
      await this.removeDotfileSymlink(targetPath);
    }
  }

  /**
   * Creates a single dotfile symlink with backup of existing file
   */
  private static async createDotfileSymlink(
    profileDir: string, 
    targetPath: string, 
    sourcePath: string
  ): Promise<void> {
    const resolvedTargetPath = this.resolvePath(targetPath);
    const resolvedSourcePath = this.resolveProfilePath(profileDir, sourcePath);

    // Validate source file exists within profile directory
    if (!resolvedSourcePath.startsWith(profileDir)) {
      throw new Error(`Source path must be within profile directory: ${sourcePath}`);
    }

    if (!await this.fileExists(resolvedSourcePath)) {
      throw new Error(`Source dotfile does not exist: ${resolvedSourcePath}`);
    }

    // Create target directory if it doesn't exist
    const targetDir = path.dirname(resolvedTargetPath);
    if (!await this.fileExists(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    // Backup existing file/symlink if it exists
    if (await this.fileExists(resolvedTargetPath)) {
      await this.backupExistingFile(resolvedTargetPath);
    }

    // Create the symlink
    await fs.promises.symlink(resolvedSourcePath, resolvedTargetPath);
  }

  /**
   * Removes a dotfile symlink and restores backup if available
   */
  private static async removeDotfileSymlink(targetPath: string): Promise<void> {
    const resolvedTargetPath = this.resolvePath(targetPath);
    const backup = this.backups.get(resolvedTargetPath);

    // Remove the current symlink
    if (await this.fileExists(resolvedTargetPath)) {
      await fs.promises.unlink(resolvedTargetPath);
    }

    // Restore backup if available
    if (backup) {
      if (backup.wasSymlink && backup.symlinkTarget) {
        // Restore original symlink
        await fs.promises.symlink(backup.symlinkTarget, resolvedTargetPath);
      } else if (await this.fileExists(backup.backupPath)) {
        // Restore original file
        await fs.promises.rename(backup.backupPath, resolvedTargetPath);
      }

      this.backups.delete(resolvedTargetPath);
    }
  }

  /**
   * Backs up an existing file or symlink
   */
  private static async backupExistingFile(filePath: string): Promise<void> {
    const stats = await fs.promises.lstat(filePath);
    const backupPath = `${filePath}.kontext-backup-${Date.now()}`;

    const backup: DotfileBackup = {
      originalPath: filePath,
      backupPath,
      wasSymlink: stats.isSymbolicLink()
    };

    if (stats.isSymbolicLink()) {
      backup.symlinkTarget = await fs.promises.readlink(filePath);
      await fs.promises.unlink(filePath);
    } else {
      await fs.promises.rename(filePath, backupPath);
    }

    this.backups.set(filePath, backup);
  }

  /**
   * Configures git to use profile-specific config via includeIf
   */
  static async configureGit(profileName: string, configPath?: string): Promise<void> {
    if (!configPath) return;

    try {
      // Check if git is available
      execSync('git --version', { stdio: 'ignore' });

      // Set up includeIf configuration for the profile
      const includeSection = `includeIf.gitdir:~/.config/kontext/profiles/${profileName}/.path`;
      execSync(`git config --global "${includeSection}" "${configPath}"`, { stdio: 'ignore' });
    } catch (error) {
      console.warn(`Warning: Failed to configure git for profile ${profileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Removes git configuration for a profile
   */
  static async removeGitConfig(profileName: string): Promise<void> {
    try {
      const includeSection = `includeIf.gitdir:~/.config/kontext/profiles/${profileName}/.path`;
      execSync(`git config --global --unset "${includeSection}"`, { stdio: 'ignore' });
    } catch (error) {
      // Ignore errors when removing git config
    }
  }

  /**
   * Resolves ${KONTEXT_PROFILE_DIR} variables in paths
   */
  static resolveProfilePath(profileDir: string, pathTemplate: string): string {
    return pathTemplate.replace(/\$\{KONTEXT_PROFILE_DIR\}/g, profileDir);
  }

  /**
   * Resolves home directory paths
   */
  private static resolvePath(pathTemplate: string): string {
    if (pathTemplate.startsWith('~/')) {
      return path.join(os.homedir(), pathTemplate.slice(2));
    }
    return path.resolve(pathTemplate);
  }

  /**
   * Validates that a path is within the profile directory
   */
  static validateProfilePath(profileDir: string, pathTemplate: string): void {
    const resolvedPath = this.resolveProfilePath(profileDir, pathTemplate);
    const normalizedProfileDir = path.normalize(profileDir);
    const normalizedPath = path.normalize(resolvedPath);

    if (!normalizedPath.startsWith(normalizedProfileDir)) {
      throw new Error(`Path must be within profile directory: ${pathTemplate}`);
    }
  }

  /**
   * Checks if a file exists
   */
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets backup information for debugging
   */
  static getBackups(): Map<string, DotfileBackup> {
    return new Map(this.backups);
  }

  /**
   * Clears all backups (for cleanup)
   */
  static clearBackups(): void {
    this.backups.clear();
  }
}