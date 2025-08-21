import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

export class HookManager {
  /**
   * Executes a hook script with the specified profile and hook type
   */
  static async executeHook(
    hookPath: string, 
    profileName: string, 
    hookType: 'activate' | 'deactivate'
  ): Promise<void> {
    try {
      const resolvedPath = this.resolveHookPath(hookPath);
      
      if (!(await this.fileExists(resolvedPath))) {
        console.warn(`Warning: Hook script not found: ${resolvedPath}`);
        return;
      }

      // Check if file is executable
      try {
        await fs.promises.access(resolvedPath, fs.constants.X_OK);
      } catch {
        // Try to make it executable
        await fs.promises.chmod(resolvedPath, 0o755);
      }

      await this.runHookScript(resolvedPath, profileName, hookType);
    } catch (error) {
      console.warn(`Warning: Hook execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates that a hook path exists and is executable
   */
  static async validateHookPath(hookPath: string): Promise<void> {
    const resolvedPath = this.resolveHookPath(hookPath);
    
    if (!(await this.fileExists(resolvedPath))) {
      throw new Error(`Hook script not found: ${resolvedPath}`);
    }
    
    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
    } catch {
      throw new Error(`Hook script is not readable: ${resolvedPath}`);
    }
  }

  /**
   * Resolves a hook path, handling relative paths and tilde expansion
   */
  static resolveHookPath(hookPath: string): string {
    if (hookPath.startsWith('~/')) {
      return path.join(os.homedir(), hookPath.slice(2));
    }
    
    if (path.isAbsolute(hookPath)) {
      return hookPath;
    }
    
    // For relative paths, resolve from current working directory
    return path.resolve(hookPath);
  }

  /**
   * Executes the hook script with appropriate environment variables
   */
  private static async runHookScript(
    scriptPath: string, 
    profileName: string, 
    hookType: 'activate' | 'deactivate'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        KONTEXT_PROFILE: profileName,
        KONTEXT_HOOK_TYPE: hookType,
      };

      const child = spawn('/bin/bash', [scriptPath], {
        env,
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd: process.cwd(),
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Hook script exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Set a timeout to prevent hanging hooks
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Hook script timed out after 30 seconds'));
      }, 30000);

      child.on('close', () => {
        clearTimeout(timeout);
      });
    });
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