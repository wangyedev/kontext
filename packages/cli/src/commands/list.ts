import { Command } from 'commander';
import { ProfileManager, DirectoryScanner } from '../../../core/src';
import { success, error, info, profile as profileFormat, header } from '../utils/prompt-utils';

export const listCommand = new Command('list')
  .description('List all available profiles')
  .option('-d, --detailed', 'Show detailed profile information')
  .action(async (options) => {
    try {
      const profileManager = new ProfileManager();
      const profiles = await profileManager.listProfiles();
      
      if (profiles.length === 0) {
        console.log(info('No profiles found.'));
        console.log('Create your first profile with: kontext new');
        return;
      }
      
      console.log(header('Available Profiles'));
      console.log('');
      
      // Get current active profile
      const currentProfile = await DirectoryScanner.getActiveProfile();
      
      if (options.detailed) {
        // Show detailed information
        for (const profileName of profiles) {
          try {
            const profile = await profileManager.getProfile(profileName);
            if (!profile) continue;
            
            const isActive = currentProfile === profileName;
            const marker = isActive ? '→ ' : '  ';
            const formattedName = isActive ? profileFormat(`${profileName} (active)`) : profileFormat(profileName);
            
            console.log(`${marker}${formattedName}`);
            
            if (profile.git?.configPath) {
              const configFile = profile.git.configPath.replace('${KONTEXT_PROFILE_DIR}/', '');
              console.log(`    Git: ${configFile}`);
            }
            
            if (profile.environment?.variables) {
              const varCount = Object.keys(profile.environment.variables).length;
              console.log(`    Environment variables: ${varCount}`);
            }
            
            if (profile.environment?.scriptPath) {
              console.log(`    Shell script: ${profile.environment.scriptPath}`);
            }
            
            console.log('');
          } catch (err) {
            console.log(`  ${profileFormat(profileName)} (error loading: ${err instanceof Error ? err.message : 'unknown'})`);
            console.log('');
          }
        }
      } else {
        // Show simple list
        for (const profileName of profiles) {
          const isActive = currentProfile === profileName;
          const marker = isActive ? '→ ' : '  ';
          const formattedName = isActive ? profileFormat(`${profileName} (active)`) : profileFormat(profileName);
          console.log(`${marker}${formattedName}`);
        }
        console.log('');
        
        if (currentProfile) {
          console.log(info(`Currently active: ${profileFormat(currentProfile)}`));
        } else {
          console.log(info('No profile currently active for this directory'));
        }
        console.log('');
        console.log('Use --detailed flag for more information');
      }
      
    } catch (err) {
      console.error(error(`Failed to list profiles: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });