import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { Profile } from './types';

export class GitConfigManager {
  private static readonly KONTEXT_GIT_CONFIG_PATH = path.join(os.homedir(), '.config', 'kontext', 'gitconfig');
  private static readonly KONTEXT_INCLUDE_COMMENT = '# Kontext managed configuration';

  /**
   * Sets up Git includeIf configuration to dynamically include Kontext-managed git config
   */
  static async setupGitInclude(): Promise<void> {
    const globalGitConfig = path.join(os.homedir(), '.gitconfig');
    
    // Ensure the kontext git config directory exists
    const kontextConfigDir = path.dirname(this.KONTEXT_GIT_CONFIG_PATH);
    if (!fs.existsSync(kontextConfigDir)) {
      fs.mkdirSync(kontextConfigDir, { recursive: true });
    }

    // Check if include is already set up
    if (await this.isIncludeSetup()) {
      return;
    }

    // Add include directive to global git config
    const includeConfig = `${this.KONTEXT_INCLUDE_COMMENT}\n[include]\n\tpath = ${this.KONTEXT_GIT_CONFIG_PATH}\n`;
    
    try {
      if (fs.existsSync(globalGitConfig)) {
        const existingContent = await fs.promises.readFile(globalGitConfig, 'utf8');
        await fs.promises.writeFile(globalGitConfig, existingContent + '\n' + includeConfig, 'utf8');
      } else {
        await fs.promises.writeFile(globalGitConfig, includeConfig, 'utf8');
      }
    } catch (error) {
      throw new Error(`Failed to update global git config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if the Kontext include is already set up in the global git config
   */
  static async isIncludeSetup(): Promise<boolean> {
    const globalGitConfig = path.join(os.homedir(), '.gitconfig');
    
    if (!fs.existsSync(globalGitConfig)) {
      return false;
    }

    try {
      const content = await fs.promises.readFile(globalGitConfig, 'utf8');
      return content.includes(this.KONTEXT_GIT_CONFIG_PATH);
    } catch {
      return false;
    }
  }

  /**
   * Applies a profile's git configuration
   * Note: With file-based git config, this is now handled by ConfigFileManager
   */
  static async applyProfile(profile: Profile): Promise<void> {
    if (!profile.git?.configPath) {
      // Clear any existing kontext git config if no git settings in profile
      await this.clearKontextConfig();
      return;
    }

    // File-based git configuration is now handled by ConfigFileManager
    // This method is kept for backward compatibility but does nothing
    // since git config is managed through .gitconfig files
  }

  /**
   * Clears the Kontext-managed git configuration
   */
  static async clearKontextConfig(): Promise<void> {
    if (fs.existsSync(this.KONTEXT_GIT_CONFIG_PATH)) {
      try {
        await fs.promises.unlink(this.KONTEXT_GIT_CONFIG_PATH);
      } catch (error) {
        throw new Error(`Failed to clear Kontext git config: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Gets the current git user configuration
   */
  static async getCurrentGitUser(): Promise<{ name?: string; email?: string }> {
    try {
      const result: { name?: string; email?: string } = {};
      
      try {
        const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
        if (name) result.name = name;
      } catch {
        // Ignore if not set
      }
      
      try {
        const email = execSync('git config user.email', { encoding: 'utf8' }).trim();
        if (email) result.email = email;
      } catch {
        // Ignore if not set
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to get current git user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if git is available on the system
   */
  static isGitAvailable(): boolean {
    try {
      execSync('git --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Removes the Kontext include from the global git config
   */
  static async removeGitInclude(): Promise<void> {
    const globalGitConfig = path.join(os.homedir(), '.gitconfig');
    
    if (!fs.existsSync(globalGitConfig)) {
      return;
    }

    try {
      const content = await fs.promises.readFile(globalGitConfig, 'utf8');
      const lines = content.split('\n');
      const filteredLines: string[] = [];
      let skipNext = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes(this.KONTEXT_INCLUDE_COMMENT)) {
          skipNext = true;
          continue;
        }
        
        if (skipNext && (line.includes('[include]') || line.includes(this.KONTEXT_GIT_CONFIG_PATH))) {
          // Skip include section lines
          if (line.includes(this.KONTEXT_GIT_CONFIG_PATH)) {
            skipNext = false;
          }
          continue;
        }
        
        if (skipNext && line.trim() === '') {
          skipNext = false;
          continue;
        }
        
        skipNext = false;
        filteredLines.push(line);
      }
      
      await fs.promises.writeFile(globalGitConfig, filteredLines.join('\n'), 'utf8');
      
      // Also clear the kontext config file
      await this.clearKontextConfig();
    } catch (error) {
      throw new Error(`Failed to remove git include: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}