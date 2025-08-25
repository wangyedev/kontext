import { Command } from 'commander';
import { ProfileManager, DirectoryScanner } from '../../../core/src';
import { success, error, warning, info, profile as profileFormat } from '../utils/prompt-utils';
import * as readline from 'readline';

async function confirmDeletion(profileName: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`Are you sure you want to delete profile "${profileName}"? This action cannot be undone. (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export const deleteCommand = new Command('delete')
  .alias('remove')
  .description('Delete a profile configuration')
  .argument('<profile>', 'Profile name to delete')
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
      
      // Check if profile is currently active
      const currentProfile = await DirectoryScanner.getActiveProfile();
      if (currentProfile === profileName) {
        console.log(error(`Cannot delete profile "${profileName}" because it is currently active`));
        console.log('');
        console.log('To delete this profile:');
        console.log('1. Switch to a different profile or deactivate the current one');
        console.log('2. Then run the delete command again');
        console.log('');
        console.log('Available commands:');
        console.log(`  kontext switch <other-profile>  # Switch to another profile`);
        console.log(`  kontext profile list           # View all available profiles`);
        process.exit(1);
      }
      
      // Show profile information before deletion
      console.log(warning(`You are about to delete profile: ${profileFormat(profileName)}`));
      console.log('');
      
      try {
        const profile = await profileManager.getProfile(profileName);
        if (profile) {
          console.log(info('Profile configuration:'));
          if (profile.git?.configPath) {
            const configFile = profile.git.configPath.replace('${KONTEXT_PROFILE_DIR}/', '');
            console.log(`  Git: ${configFile}`);
          }
          if (profile.environment?.variables) {
            const varCount = Object.keys(profile.environment.variables).length;
            console.log(`  Environment variables: ${varCount}`);
          }
          if (profile.environment?.scriptPath) {
            console.log(`  Shell script: ${profile.environment.scriptPath}`);
          }
          console.log('');
        }
      } catch (err) {
        // Continue even if we can't load profile details
        console.log(info('Profile details could not be loaded, but the profile file exists.'));
        console.log('');
      }
      
      // Confirmation prompt
      const confirmed = await confirmDeletion(profileName);
      
      if (!confirmed) {
        console.log(info('Profile deletion cancelled.'));
        process.exit(0);
      }
      
      // Delete the profile
      await profileManager.deleteProfile(profileName);
      
      console.log('');
      console.log(success(`Profile ${profileFormat(profileName)} has been deleted successfully!`));
      console.log('');
      console.log('💡 Next steps:');
      console.log('  kontext profile list     # View remaining profiles');
      console.log('  kontext profile new      # Create a new profile');
      
    } catch (err) {
      console.error(error(`Failed to delete profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });