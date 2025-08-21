import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Profile } from './types';
import { HookManager } from './hook-manager';

export class EnvironmentManager {
  private static currentProfile: string | null = null;

  /**
   * Applies environment configuration from a profile
   */
  static async applyProfile(profile: Profile): Promise<string[]> {
    const commands: string[] = [];
    
    // Apply environment variables
    if (profile.environment?.variables) {
      for (const [key, value] of Object.entries(profile.environment.variables)) {
        commands.push(`export ${key}="${value}"`);
      }
    }
    
    // Source shell script if specified
    if (profile.environment?.scriptPath) {
      const scriptPath = this.resolveScriptPath(profile.environment.scriptPath);
      
      if (await this.fileExists(scriptPath)) {
        commands.push(`source "${scriptPath}"`);
      } else {
        console.warn(`Warning: Script file not found: ${scriptPath}`);
      }
    }
    
    // Set current profile tracking
    this.currentProfile = profile.name;
    commands.push(`export KONTEXT_CURRENT_PROFILE="${profile.name}"`);
    
    return commands;
  }

  /**
   * Clears current environment profile
   */
  static clearProfile(): string[] {
    const commands: string[] = [];
    
    // Unset profile tracking
    commands.push('unset KONTEXT_CURRENT_PROFILE');
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
  static generateActivationScript(profile: Profile): string {
    const commands = [
      '#!/bin/bash',
      `# Kontext profile activation script for: ${profile.name}`,
      '',
    ];
    
    // Execute activation hook first
    if (profile.hooks?.onActivate) {
      const hookPath = HookManager.resolveHookPath(profile.hooks.onActivate);
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
    
    // Add environment variables
    if (profile.environment?.variables) {
      commands.push('# Environment variables');
      for (const [key, value] of Object.entries(profile.environment.variables)) {
        commands.push(`export ${key}="${this.escapeShellValue(value)}"`);
      }
      commands.push('');
    }
    
    // Add script sourcing
    if (profile.environment?.scriptPath) {
      const scriptPath = this.resolveScriptPath(profile.environment.scriptPath);
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
  static generateDeactivationScript(profile?: Profile): string {
    const commands = [
      '#!/bin/bash',
      '# Kontext profile deactivation script',
      '',
    ];
    
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
    
    // Execute deactivation hook last
    if (profile?.hooks?.onDeactivate) {
      const hookPath = HookManager.resolveHookPath(profile.hooks.onDeactivate);
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
    const scriptPath = path.join(tempDir, `kontext-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sh`);
    
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
  private static resolveScriptPath(scriptPath: string): string {
    if (scriptPath.startsWith('~/')) {
      return path.join(os.homedir(), scriptPath.slice(2));
    }
    
    if (path.isAbsolute(scriptPath)) {
      return scriptPath;
    }
    
    // For relative paths, resolve from the profiles directory
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
}