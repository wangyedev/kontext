import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Profile } from './types';
import { HookManager } from './hook-manager';
import { ConfigFileManager } from './config-file-manager';

export class EnvironmentManager {
  private static currentProfile: string | null = null;
  private static envFileVariables: Map<string, string[]> = new Map();

  /**
   * Applies environment configuration from a profile
   */
  static async applyProfile(profile: Profile, profileDir: string): Promise<string[]> {
    const commands: string[] = [];
    const envVariables: string[] = [];
    
    // Apply dotfiles first
    if (profile.dotfiles) {
      await ConfigFileManager.applyDotfiles(profileDir, profile.dotfiles);
    }
    
    // Configure git if needed
    if (profile.git?.configPath) {
      const resolvedConfigPath = ConfigFileManager.resolveProfilePath(profileDir, profile.git.configPath);
      await ConfigFileManager.configureGit(profile.name, resolvedConfigPath);
    }
    
    // Load .env file variables first
    if (profile.environment?.envFile) {
      const envFilePath = ConfigFileManager.resolveProfilePath(profileDir, profile.environment.envFile);
      
      if (await this.fileExists(envFilePath)) {
        const envFileVars = await this.parseEnvFile(envFilePath);
        for (const [key, value] of Object.entries(envFileVars)) {
          commands.push(`export ${key}="${value}"`);
          envVariables.push(key);
        }
      } else {
        console.warn(`Warning: Environment file not found: ${envFilePath}`);
      }
    }
    
    // Apply environment variables (can override .env file variables)
    if (profile.environment?.variables) {
      for (const [key, value] of Object.entries(profile.environment.variables)) {
        commands.push(`export ${key}="${value}"`);
        if (!envVariables.includes(key)) {
          envVariables.push(key);
        }
      }
    }
    
    // Store env variables for cleanup
    if (envVariables.length > 0) {
      this.envFileVariables.set(profile.name, envVariables);
    }
    
    // Source shell script if specified
    if (profile.environment?.scriptPath) {
      const scriptPath = this.resolveScriptPath(profile.environment.scriptPath, profileDir);
      
      if (await this.fileExists(scriptPath)) {
        commands.push(`source "${scriptPath}"`);
      } else {
        console.warn(`Warning: Script file not found: ${scriptPath}`);
      }
    }
    
    // Set current profile tracking
    this.currentProfile = profile.name;
    commands.push(`export KONTEXT_CURRENT_PROFILE="${profile.name}"`);
    commands.push(`export KONTEXT_PROFILE_DIR="${profileDir}"`);
    
    return commands;
  }

  /**
   * Clears current environment profile
   */
  static async clearProfile(profile?: Profile): Promise<string[]> {
    const commands: string[] = [];
    
    // Remove dotfiles
    if (profile?.dotfiles) {
      await ConfigFileManager.removeDotfiles(profile.dotfiles);
    }
    
    // Remove git configuration
    if (profile?.name) {
      await ConfigFileManager.removeGitConfig(profile.name);
    }
    
    // Unset environment variables from .env file and profile config
    if (profile?.name) {
      const storedVars = this.envFileVariables.get(profile.name);
      if (storedVars) {
        for (const key of storedVars) {
          commands.push(`unset ${key}`);
        }
        this.envFileVariables.delete(profile.name);
      }
    }
    
    // Unset profile tracking
    commands.push('unset KONTEXT_CURRENT_PROFILE');
    commands.push('unset KONTEXT_PROFILE_DIR');
    this.currentProfile = null;
    
    return commands;
  }

  /**
   * Gets the currently active profile name
   */
  static getCurrentProfile(): string | null {
    return process.env.KONTEXT_CURRENT_PROFILE || this.currentProfile;
  }

  /**
   * Generates shell script content for profile activation
   */
  static generateActivationScript(profile: Profile, profileDir: string): string {
    const commands = [
      '#!/bin/bash',
      `# Kontext profile activation script for: ${profile.name}`,
      '',
    ];
    
    // Set profile directory first
    commands.push('# Set profile directory');
    commands.push(`export KONTEXT_PROFILE_DIR="${profileDir}"`);
    commands.push('');
    
    // Execute activation hook first
    if (profile.hooks?.onActivate) {
      const hookPath = ConfigFileManager.resolveProfilePath(profileDir, profile.hooks.onActivate);
      commands.push('# Execute activation hook');
      commands.push(`if [ -f "${hookPath}" ]; then`);
      commands.push(`  export KONTEXT_PROFILE="${profile.name}"`);
      commands.push(`  export KONTEXT_HOOK_TYPE="activate"`);
      commands.push(`  bash "${hookPath}" 2>/dev/null || echo "Warning: Activation hook failed" >&2`);
      commands.push('else');
      commands.push(`  echo "Warning: Activation hook not found: ${hookPath}" >&2`);
      commands.push('fi');
      commands.push('');
    }
    
    // Add .env file variables first
    if (profile.environment?.envFile) {
      const envFilePath = ConfigFileManager.resolveProfilePath(profileDir, profile.environment.envFile);
      commands.push('# Load .env file variables');
      commands.push(`if [ -f "${envFilePath}" ]; then`);
      commands.push(`  while IFS='=' read -r key value; do`);
      commands.push(`    # Skip empty lines and comments`);
      commands.push(`    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue`);
      commands.push(`    # Remove quotes if present`);
      commands.push(`    value=\${value#\\"}; value=\${value%\\"}`);
      commands.push(`    value=\${value#\\'}; value=\${value%\\'}`);
      commands.push(`    export "$key"="$value"`);
      commands.push(`  done < "${envFilePath}"`);
      commands.push('else');
      commands.push(`  echo "Warning: Environment file not found: ${envFilePath}" >&2`);
      commands.push('fi');
      commands.push('');
    }
    
    // Add environment variables (can override .env file variables)
    if (profile.environment?.variables) {
      commands.push('# Environment variables');
      for (const [key, value] of Object.entries(profile.environment.variables)) {
        commands.push(`export ${key}="${this.escapeShellValue(value)}"`);
      }
      commands.push('');
    }
    
    // Add script sourcing
    if (profile.environment?.scriptPath) {
      const scriptPath = this.resolveScriptPath(profile.environment.scriptPath, profileDir);
      commands.push('# Source profile script');
      commands.push(`if [ -f "${scriptPath}" ]; then`);
      commands.push(`  source "${scriptPath}"`);
      commands.push('else');
      commands.push(`  echo "Warning: Profile script not found: ${scriptPath}" >&2`);
      commands.push('fi');
      commands.push('');
    }
    
    // Set profile tracking
    commands.push('# Set current profile');
    commands.push(`export KONTEXT_CURRENT_PROFILE="${profile.name}"`);
    
    return commands.join('\n');
  }

  /**
   * Generates shell script content for profile deactivation
   */
  static generateDeactivationScript(profile?: Profile, profileDir?: string): string {
    const commands = [
      '#!/bin/bash',
      '# Kontext profile deactivation script',
      '',
    ];
    
    // Unset .env file variables first
    if (profile?.environment?.envFile && profileDir) {
      const envFilePath = ConfigFileManager.resolveProfilePath(profileDir, profile.environment.envFile);
      commands.push('# Unset .env file variables');
      commands.push(`if [ -f "${envFilePath}" ]; then`);
      commands.push(`  while IFS='=' read -r key value; do`);
      commands.push(`    # Skip empty lines and comments`);
      commands.push(`    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue`);
      commands.push(`    unset "$key"`);
      commands.push(`  done < "${envFilePath}"`);
      commands.push('fi');
      commands.push('');
    }
    
    // Unset environment variables if we know what they are
    if (profile?.environment?.variables) {
      commands.push('# Unset environment variables');
      for (const key of Object.keys(profile.environment.variables)) {
        commands.push(`unset ${key}`);
      }
      commands.push('');
    }
    
    // Unset profile tracking
    commands.push('# Clear current profile');
    commands.push('unset KONTEXT_CURRENT_PROFILE');
    commands.push('unset KONTEXT_PROFILE_DIR');
    
    // Execute deactivation hook last
    if (profile?.hooks?.onDeactivate && profileDir) {
      const hookPath = ConfigFileManager.resolveProfilePath(profileDir, profile.hooks.onDeactivate);
      commands.push('');
      commands.push('# Execute deactivation hook');
      commands.push(`if [ -f "${hookPath}" ]; then`);
      commands.push(`  export KONTEXT_PROFILE="${profile.name}"`);
      commands.push(`  export KONTEXT_HOOK_TYPE="deactivate"`);
      commands.push(`  bash "${hookPath}" 2>/dev/null || echo "Warning: Deactivation hook failed" >&2`);
      commands.push('else');
      commands.push(`  echo "Warning: Deactivation hook not found: ${hookPath}" >&2`);
      commands.push('fi');
    }
    
    return commands.join('\n');
  }

  /**
   * Creates a temporary script file for shell execution
   */
  static async createTempScript(content: string): Promise<string> {
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `kontext-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.sh`);
    
    await fs.promises.writeFile(scriptPath, content, { mode: 0o755 });
    
    return scriptPath;
  }

  /**
   * Removes a temporary script file
   */
  static async removeTempScript(scriptPath: string): Promise<void> {
    try {
      await fs.promises.unlink(scriptPath);
    } catch (error) {
      // Ignore errors when cleaning up temp files
    }
  }

  /**
   * Validates that environment variables have valid names
   */
  static validateEnvironmentVariables(variables: Record<string, string>): void {
    const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    
    for (const [key, value] of Object.entries(variables)) {
      if (!validNameRegex.test(key)) {
        throw new Error(`Invalid environment variable name: "${key}". Variable names must start with a letter or underscore and contain only letters, numbers, and underscores.`);
      }
      
      if (typeof value !== 'string') {
        throw new Error(`Environment variable "${key}" must have a string value`);
      }
    }
  }

  /**
   * Validates that a script path exists and is readable
   */
  static async validateScriptPath(scriptPath: string): Promise<void> {
    const resolvedPath = this.resolveScriptPath(scriptPath);
    
    if (!(await this.fileExists(resolvedPath))) {
      throw new Error(`Script file not found: ${resolvedPath}`);
    }
    
    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
    } catch {
      throw new Error(`Script file is not readable: ${resolvedPath}`);
    }
  }

  /**
   * Resolves a script path, handling relative paths and tilde expansion
   */
  private static resolveScriptPath(scriptPath: string, profileDir?: string): string {
    // Handle ${KONTEXT_PROFILE_DIR} variables
    if (profileDir && scriptPath.includes('${KONTEXT_PROFILE_DIR}')) {
      return ConfigFileManager.resolveProfilePath(profileDir, scriptPath);
    }
    
    if (scriptPath.startsWith('~/')) {
      return path.join(os.homedir(), scriptPath.slice(2));
    }
    
    if (path.isAbsolute(scriptPath)) {
      return scriptPath;
    }
    
    // For relative paths, resolve from current directory or profile directory
    if (profileDir) {
      return path.resolve(profileDir, scriptPath);
    }
    return path.resolve(scriptPath);
  }

  /**
   * Escapes shell special characters in values
   */
  private static escapeShellValue(value: string): string {
    return value.replace(/["\\$`]/g, '\\$&');
  }

  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parses a .env file and returns key-value pairs
   */
  private static async parseEnvFile(filePath: string): Promise<Record<string, string>> {
    const variables: Record<string, string> = {};
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // Parse KEY=value format
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex === -1) {
          continue; // Skip lines without =
        }
        
        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        if (key) {
          variables[key] = value;
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse .env file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return variables;
  }

  /**
   * Validates that an .env file path is within the profile directory and exists
   */
  static async validateEnvFile(envFile: string, profileDir: string): Promise<void> {
    const resolvedPath = ConfigFileManager.resolveProfilePath(profileDir, envFile);
    
    // Validate path is within profile directory
    ConfigFileManager.validateProfilePath(profileDir, envFile);
    
    // Check if file exists
    if (!(await this.fileExists(resolvedPath))) {
      throw new Error(`Environment file not found: ${resolvedPath}`);
    }
    
    // Check if file is readable
    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
    } catch {
      throw new Error(`Environment file is not readable: ${resolvedPath}`);
    }
  }
}