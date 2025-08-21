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

  private getProfileFilePath(profileName: string): string {
    return path.join(this.profilesPath, `${profileName}.yml`);
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
        userName: config.git.user_name,
        userEmail: config.git.user_email,
      } : undefined,
      environment: config.environment ? {
        variables: config.environment.variables,
        scriptPath: config.environment.script_path,
      } : undefined,
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
        user_name: profile.git.userName,
        user_email: profile.git.userEmail,
      } : undefined,
      environment: profile.environment ? {
        variables: profile.environment.variables,
        script_path: profile.environment.scriptPath,
      } : undefined,
      hooks: profile.hooks ? {
        on_activate: profile.hooks.onActivate,
        on_deactivate: profile.hooks.onDeactivate,
      } : undefined,
    };
  }

  async createProfile(profile: Profile): Promise<void> {
    const filePath = this.getProfileFilePath(profile.name);
    
    if (fs.existsSync(filePath)) {
      throw new Error(`Profile "${profile.name}" already exists`);
    }

    const config = this.convertProfileToConfig(profile);
    const yamlContent = yaml.dump(config, { 
      indent: 2,
      lineWidth: -1,
      noRefs: true 
    });

    await fs.promises.writeFile(filePath, yamlContent, 'utf8');
  }

  async getProfile(profileName: string): Promise<Profile | null> {
    const filePath = this.getProfileFilePath(profileName);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const config = yaml.load(content) as any;
      const validatedConfig = this.validateProfileConfig(config);
      return this.convertConfigToProfile(validatedConfig);
    } catch (error) {
      throw new Error(`Failed to load profile "${profileName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateProfile(profile: Profile): Promise<void> {
    const filePath = this.getProfileFilePath(profile.name);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Profile "${profile.name}" does not exist`);
    }

    const config = this.convertProfileToConfig(profile);
    const yamlContent = yaml.dump(config, { 
      indent: 2,
      lineWidth: -1,
      noRefs: true 
    });

    await fs.promises.writeFile(filePath, yamlContent, 'utf8');
  }

  async deleteProfile(profileName: string): Promise<void> {
    const filePath = this.getProfileFilePath(profileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Profile "${profileName}" does not exist`);
    }

    await fs.promises.unlink(filePath);
  }

  async listProfiles(): Promise<string[]> {
    if (!fs.existsSync(this.profilesPath)) {
      return [];
    }

    const files = await fs.promises.readdir(this.profilesPath);
    return files
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
      .map(file => path.basename(file, path.extname(file)));
  }

  async profileExists(profileName: string): Promise<boolean> {
    const filePath = this.getProfileFilePath(profileName);
    return fs.existsSync(filePath);
  }

  getProfilesPath(): string {
    return this.profilesPath;
  }
}