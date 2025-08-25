import { Command } from 'commander';
import { DirectoryScanner, ProfileManager, EnvironmentManager, ConfigFileManager } from '../../../core/src';
import { error, profile as profileFormat } from '../utils/prompt-utils';
import * as fs from 'fs';
import * as path from 'path';

export const statusCommand = new Command('status')
  .description('Show detailed status of the active profile or inspect any profile')
  .argument('[profile]', 'Profile name to inspect (optional - shows active profile if not specified)')
  .action(async (profileArg?: string) => {
    try {
      const profileManager = new ProfileManager();
      let profileName: string;
      let isActive = false;
      let source: string | null = null;

      if (profileArg) {
        // Inspect specific profile
        profileName = profileArg;
        if (!(await profileManager.profileExists(profileName))) {
          console.log(error(`Profile "${profileName}" does not exist`));
          console.log('Available profiles:');
          const profiles = await profileManager.listProfiles();
          profiles.forEach(name => console.log(`  ${profileFormat(name)}`));
          process.exit(1);
        }
        
        // Check if this profile is currently active
        const envProfile = EnvironmentManager.getCurrentProfile();
        const dirProfile = await DirectoryScanner.getActiveProfile();
        const activeProfile = envProfile || dirProfile;
        isActive = activeProfile === profileName;
        
        if (isActive) {
          source = envProfile ? 'environment variable' : 'directory profile file';
        }
      } else {
        // Show active profile
        const envProfile = EnvironmentManager.getCurrentProfile();
        const dirProfile = await DirectoryScanner.getActiveProfile();
        
        if (!envProfile && !dirProfile) {
          console.log('❌ No Profile Active');
          console.log('');
          console.log('To activate a profile:');
          console.log('1. Navigate to a directory with a .kontext-profile file, or');
          console.log('2. Use: kontext switch <profile-name>');
          console.log('');
          console.log('Available profiles:');
          const profiles = await profileManager.listProfiles();
          if (profiles.length === 0) {
            console.log('  None found. Create one with: kontext new');
          } else {
            profiles.forEach(name => console.log(`  ${profileFormat(name)}`));
          }
          return;
        }
        
        profileName = envProfile || dirProfile!;
        isActive = true;
        source = envProfile ? 'environment variable' : 'directory profile file';
        
        // Get source file path for directory-based activation
        if (!envProfile) {
          const profileFilePath = await DirectoryScanner.findProfileFile();
          if (profileFilePath) {
            source = profileFilePath;
          }
        }
      }

      const profile = await profileManager.getProfile(profileName);
      if (!profile) {
        console.log(error(`Failed to load profile "${profileName}"`));
        process.exit(1);
      }

      const profileDir = path.join(profileManager.getProfilesPath(), profileName);

      // Header
      const statusIcon = isActive ? '✅' : '❌';
      const statusText = isActive ? 'Active Profile' : 'Profile Preview (NOT ACTIVE)';
      console.log(`${statusIcon} ${statusText}: ${profileFormat(profileName)}`);
      
      if (source) {
        console.log(`   Source: ${source}`);
      }
      console.log('');
      console.log('---');
      console.log('');

      // Git Configuration
      if (profile.git?.configPath) {
        console.log('📝 Git');
        const resolvedConfigPath = ConfigFileManager.resolveProfilePath(profileDir, profile.git.configPath);
        const relativeConfigPath = profile.git.configPath.replace('${KONTEXT_PROFILE_DIR}/', '');
        console.log(`   Active Config: ${relativeConfigPath}`);
        
        // Parse actual git config values
        const gitValues = await parseGitConfig(resolvedConfigPath);
        if (gitValues.name || gitValues.email) {
          if (gitValues.name) {
            console.log(`     ├─ user.name: ${gitValues.name}`);
          }
          if (gitValues.email) {
            const nameExists = gitValues.name ? '└─' : '├─';
            console.log(`     ${nameExists} user.email: ${gitValues.email}`);
          }
        } else {
          console.log('     └─ No user configuration found');
        }
        console.log('');
      } else {
        console.log('📝 Git: Not configured');
        console.log('');
      }

      console.log('---');
      console.log('');

      // Environment Variables
      if (profile.environment?.variables && Object.keys(profile.environment.variables).length > 0) {
        console.log('🌎 Environment Variables');
        const envVars = Object.entries(profile.environment.variables);
        
        for (let i = 0; i < envVars.length; i++) {
          const [key, value] = envVars[i];
          const isLast = i === envVars.length - 1;
          const prefix = isLast ? '└─' : '├─';
          
          // Check if variable is actually set (only for active profiles)
          let statusIndicator = '';
          if (isActive) {
            const currentValue = process.env[key];
            if (currentValue === value) {
              statusIndicator = ' ✅ Active';
            } else if (currentValue !== undefined) {
              statusIndicator = ` ⚠️ Set to "${currentValue}"`;
            } else {
              statusIndicator = ' ❌ Not set';
            }
          }
          
          console.log(`   ${prefix} ${key}="${value}"${statusIndicator}`);
        }
        console.log('');
      } else {
        console.log('🌎 Environment Variables: None');
        console.log('');
      }

      console.log('---');
      console.log('');

      // Managed Dotfiles
      if (profile.dotfiles && Object.keys(profile.dotfiles).length > 0) {
        console.log('🔗 Managed Dotfiles');
        const dotfileEntries = Object.entries(profile.dotfiles);
        
        for (let i = 0; i < dotfileEntries.length; i++) {
          const [target, source] = dotfileEntries[i];
          const isLast = i === dotfileEntries.length - 1;
          const prefix = isLast ? '└─' : '├─';
          const fileName = source.replace('${KONTEXT_PROFILE_DIR}/', '');
          
          // Check symlink status (only for active profiles)
          let statusIndicator = '';
          if (isActive) {
            const symlinkStatus = await checkSymlinkStatus(target, ConfigFileManager.resolveProfilePath(profileDir, source));
            if (symlinkStatus.exists && symlinkStatus.correct) {
              statusIndicator = ' ✅ Active';
            } else if (symlinkStatus.exists) {
              statusIndicator = ` ⚠️ Points to ${symlinkStatus.actualTarget}`;
            } else {
              statusIndicator = ' ❌ Not linked';
            }
          }
          
          console.log(`   ${prefix} ${target} -> ${fileName}${statusIndicator}`);
        }
        console.log('');
      } else {
        console.log('🔗 Managed Dotfiles: None');
        console.log('');
      }

      console.log('---');
      console.log('');

      // Hooks
      if (profile.hooks?.onActivate || profile.hooks?.onDeactivate) {
        console.log('🪝 Hooks');
        if (profile.hooks.onActivate) {
          const hookFile = profile.hooks.onActivate.replace('${KONTEXT_PROFILE_DIR}/', '');
          const hookPath = ConfigFileManager.resolveProfilePath(profileDir, profile.hooks.onActivate);
          const hookExists = fs.existsSync(hookPath);
          const statusIcon = hookExists ? '✅' : '❌';
          console.log(`   ├─ on_activate: ${hookFile} ${statusIcon}`);
        }
        if (profile.hooks.onDeactivate) {
          const hookFile = profile.hooks.onDeactivate.replace('${KONTEXT_PROFILE_DIR}/', '');
          const hookPath = ConfigFileManager.resolveProfilePath(profileDir, profile.hooks.onDeactivate);
          const hookExists = fs.existsSync(hookPath);
          const statusIcon = hookExists ? '✅' : '❌';
          const prefix = profile.hooks.onActivate ? '└─' : '├─';
          console.log(`   ${prefix} on_deactivate: ${hookFile} ${statusIcon}`);
        }
        console.log('');
      } else {
        console.log('🪝 Hooks: None');
        console.log('');
      }

      // Shell Script
      if (profile.environment?.scriptPath) {
        console.log('---');
        console.log('');
        console.log('📜 Shell Script');
        const scriptExists = fs.existsSync(profile.environment.scriptPath);
        const statusIcon = scriptExists ? '✅' : '❌';
        console.log(`   └─ ${profile.environment.scriptPath} ${statusIcon}`);
        console.log('');
      }

      // Footer with helpful actions
      if (!profileArg || isActive) {
        // Show actions for active profile or when no specific profile requested
        console.log('---');
        console.log('');
        console.log('💡 Available Actions:');
        if (isActive) {
          console.log(`   kontext edit ${profileName}     # Edit this profile`);
          console.log(`   kontext switch <profile>     # Switch to another profile`);
        } else {
          console.log(`   kontext switch ${profileName}   # Activate this profile`);
          console.log(`   kontext edit ${profileName}     # Edit this profile`);
        }
        console.log('   kontext list                 # View all profiles');
      }

    } catch (err) {
      console.error(error(`Failed to get profile status: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Helper function to parse git config file
async function parseGitConfig(configPath: string): Promise<{ name?: string; email?: string }> {
  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }

    const content = await fs.promises.readFile(configPath, 'utf8');
    const result: { name?: string; email?: string } = {};

    // Simple parser for [user] section
    const lines = content.split('\n');
    let inUserSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '[user]') {
        inUserSection = true;
        continue;
      }
      
      if (trimmed.startsWith('[') && trimmed !== '[user]') {
        inUserSection = false;
        continue;
      }
      
      if (inUserSection) {
        if (trimmed.startsWith('name =')) {
          result.name = trimmed.substring(6).trim();
        } else if (trimmed.startsWith('email =')) {
          result.email = trimmed.substring(7).trim();
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

// Helper function to check symlink status
async function checkSymlinkStatus(target: string, expectedSource: string): Promise<{
  exists: boolean;
  correct: boolean;
  actualTarget?: string;
}> {
  try {
    const expandedTarget = target.startsWith('~/') 
      ? path.join(process.env.HOME || '', target.slice(2))
      : target;

    if (!fs.existsSync(expandedTarget)) {
      return { exists: false, correct: false };
    }

    const stats = await fs.promises.lstat(expandedTarget);
    if (!stats.isSymbolicLink()) {
      return { exists: true, correct: false, actualTarget: '(not a symlink)' };
    }

    const actualTarget = await fs.promises.readlink(expandedTarget);
    const resolvedActual = path.resolve(path.dirname(expandedTarget), actualTarget);
    const resolvedExpected = path.resolve(expectedSource);

    return {
      exists: true,
      correct: resolvedActual === resolvedExpected,
      actualTarget: resolvedActual !== resolvedExpected ? actualTarget : undefined
    };
  } catch {
    return { exists: false, correct: false };
  }
}