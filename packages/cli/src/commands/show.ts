import { Command } from 'commander';
import { ProfileManager } from '../../../core/src';
import {
  error,
  info,
  profile as profileFormat,
  header,
  path,
  divider,
} from '../utils/prompt-utils';

export const showCommand = new Command('show')
  .description('Display detailed profile configuration')
  .argument('<profile>', 'Profile name to show')
  .action(async (profileName: string) => {
    try {
      const profileManager = new ProfileManager();

      // Check if profile exists
      if (!(await profileManager.profileExists(profileName))) {
        console.log(error(`Profile "${profileName}" does not exist`));
        console.log('Available profiles:');
        const profiles = await profileManager.listProfiles();
        profiles.forEach(name => console.log(`  ${profileFormat(name)}`));
        process.exit(1);
      }

      const profile = await profileManager.getProfile(profileName);
      if (!profile) {
        console.log(error(`Failed to load profile "${profileName}"`));
        process.exit(1);
      }

      const profilePath = `${profileManager.getProfilesPath()}/${profileName}.yml`;

      console.log(header(`Profile: ${profileFormat(profile.name)}`));
      console.log('');

      // Git Configuration
      if (profile.git?.userName || profile.git?.userEmail) {
        console.log(info('Git Configuration:'));
        if (profile.git.userName) {
          console.log(`  Name: ${profile.git.userName}`);
        }
        if (profile.git.userEmail) {
          console.log(`  Email: ${profile.git.userEmail}`);
        }
        console.log('');
      }

      // Environment Variables
      if (profile.environment?.variables && Object.keys(profile.environment.variables).length > 0) {
        console.log(info('Environment Variables:'));
        for (const [key, value] of Object.entries(profile.environment.variables)) {
          console.log(`  ${key}=${value}`);
        }
        console.log('');
      }

      // Shell Script
      if (profile.environment?.scriptPath) {
        console.log(info('Shell Script:'));
        console.log(`  ${profile.environment.scriptPath}`);
        console.log('');
      }

      // Show empty sections
      if (!profile.git?.userName && !profile.git?.userEmail) {
        console.log(info('Git Configuration: Not configured'));
        console.log('');
      }

      if (
        !profile.environment?.variables ||
        Object.keys(profile.environment.variables).length === 0
      ) {
        console.log(info('Environment Variables: None'));
        console.log('');
      }

      if (!profile.environment?.scriptPath) {
        console.log(info('Shell Script: None'));
        console.log('');
      }

      console.log(divider());
      console.log('');
      console.log(info('Configuration File Location:'));
      console.log(`  ${path(profilePath)}`);
      console.log('');
      console.log(info('Available Actions:'));
      console.log(`  kontext edit ${profileName}     # Edit this profile`);
      console.log(`  kontext switch ${profileName}   # Activate this profile`);
      console.log(`  kontext list --detailed         # View all profiles`);
    } catch (err) {
      console.error(
        error(`Failed to show profile: ${err instanceof Error ? err.message : 'Unknown error'}`)
      );
      process.exit(1);
    }
  });
