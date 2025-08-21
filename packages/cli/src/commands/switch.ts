import { Command } from 'commander';
import { ProfileManager, GitConfigManager, EnvironmentManager } from '@kontext/core';
import { success, error, warning, profile as profileFormat } from '../utils/prompt-utils';

export const switchCommand = new Command('switch')
  .description('Manually switch to a specific profile')
  .argument('<profile>', 'Profile name to switch to')
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
      
      // Load the profile
      const profile = await profileManager.getProfile(profileName);
      if (!profile) {
        console.log(error(`Failed to load profile "${profileName}"`));
        process.exit(1);
      }
      
      // Apply git configuration
      if (GitConfigManager.isGitAvailable()) {
        try {
          await GitConfigManager.applyProfile(profile);
        } catch (err) {
          console.log(warning(`Failed to apply Git configuration: ${err instanceof Error ? err.message : 'Unknown error'}`));
        }
      }
      
      // Generate environment activation script
      const activationScript = EnvironmentManager.generateActivationScript(profile);
      
      // For manual switching, we need to output shell commands that can be sourced
      // This is a limitation of CLI tools - they can't directly modify the parent shell
      console.log('# Run the following commands to switch to this profile:');
      console.log('# (or source this output directly)');
      console.log('');
      console.log(activationScript);
      
      console.log('');
      console.log(`# Profile "${profileName}" activated`);
      
    } catch (err) {
      console.error(error(`Failed to switch profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });