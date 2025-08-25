import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { Profile, ProfileConfig } from './types';

export class ProfileManager {
  private profilesPath: string;

  constructor(profilesPath?: string) {
    this.profilesPath = profilesPath || path.join(os.homedir(), '.config', 'kontext', 'profiles');
    this.ensureProfilesDirectory();
  }

  private ensureProfilesDirectory(): void {
    if (!fs.existsSync(this.profilesPath)) {
      fs.mkdirSync(this.profilesPath, { recursive: true });
    }
  }

  private getProfileDirectoryPath(profileName: string): string {
    return path.join(this.profilesPath, profileName);
  }

  private getProfileManifestPath(profileName: string): string {
    return path.join(this.getProfileDirectoryPath(profileName), 'profile.yml');
  }

  private validateProfileConfig(config: any): ProfileConfig {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid profile configuration');
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Profile name is required and must be a string');
    }

    return config as ProfileConfig;
  }

  private convertConfigToProfile(config: ProfileConfig): Profile {
    return {
      name: config.name,
      git: config.git ? {
        configPath: config.git.config_path,
      } : undefined,
      environment: config.environment ? {
        variables: config.environment.variables,
        scriptPath: config.environment.script_path,
      } : undefined,
      dotfiles: config.dotfiles,
      hooks: config.hooks ? {
        onActivate: config.hooks.on_activate,
        onDeactivate: config.hooks.on_deactivate,
      } : undefined,
    };
  }

  private convertProfileToConfig(profile: Profile): ProfileConfig {
    return {
      name: profile.name,
      git: profile.git ? {
        config_path: profile.git.configPath,
      } : undefined,
      environment: profile.environment ? {
        variables: profile.environment.variables,
        script_path: profile.environment.scriptPath,
      } : undefined,
      dotfiles: profile.dotfiles,
      hooks: profile.hooks ? {
        on_activate: profile.hooks.onActivate,
        on_deactivate: profile.hooks.onDeactivate,
      } : undefined,
    };
  }

  async createProfile(profile: Profile): Promise<void> {
    const profileDir = this.getProfileDirectoryPath(profile.name);
    const manifestPath = this.getProfileManifestPath(profile.name);
    
    if (fs.existsSync(profileDir)) {
      throw new Error(`Profile "${profile.name}" already exists`);
    }

    // Create profile directory
    await fs.promises.mkdir(profileDir, { recursive: true });

    const config = this.convertProfileToConfig(profile);
    const yamlContent = yaml.dump(config, { 
      indent: 2,
      lineWidth: -1,
      noRefs: true 
    });

    await fs.promises.writeFile(manifestPath, yamlContent, 'utf8');
  }

  async getProfile(profileName: string): Promise<Profile | null> {
    const manifestPath = this.getProfileManifestPath(profileName);
    
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(manifestPath, 'utf8');
      const config = yaml.load(content) as any;
      const validatedConfig = this.validateProfileConfig(config);
      return this.convertConfigToProfile(validatedConfig);
    } catch (error) {
      throw new Error(`Failed to load profile "${profileName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateProfile(profile: Profile): Promise<void> {
    const manifestPath = this.getProfileManifestPath(profile.name);
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Profile "${profile.name}" does not exist`);
    }

    const config = this.convertProfileToConfig(profile);
    const yamlContent = yaml.dump(config, { 
      indent: 2,
      lineWidth: -1,
      noRefs: true 
    });

    await fs.promises.writeFile(manifestPath, yamlContent, 'utf8');
  }

  async deleteProfile(profileName: string): Promise<void> {
    const profileDir = this.getProfileDirectoryPath(profileName);
    
    if (!fs.existsSync(profileDir)) {
      throw new Error(`Profile "${profileName}" does not exist`);
    }

    await fs.promises.rm(profileDir, { recursive: true, force: true });
  }

  async listProfiles(): Promise<string[]> {
    if (!fs.existsSync(this.profilesPath)) {
      return [];
    }

    const items = await fs.promises.readdir(this.profilesPath, { withFileTypes: true });
    const profiles: string[] = [];
    
    for (const item of items) {
      if (item.isDirectory()) {
        const manifestPath = this.getProfileManifestPath(item.name);
        if (fs.existsSync(manifestPath)) {
          profiles.push(item.name);
        }
      }
    }
    
    return profiles;
  }

  async profileExists(profileName: string): Promise<boolean> {
    const manifestPath = this.getProfileManifestPath(profileName);
    return fs.existsSync(manifestPath);
  }

  getProfilesPath(): string {
    return this.profilesPath;
  }
}