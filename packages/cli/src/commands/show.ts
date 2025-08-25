import { Command } from 'commander';
import { ProfileManager } from '../../../core/src';
import { error, info, profile as profileFormat, header, path, divider } from '../utils/prompt-utils';

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
      
      const profileDir = `${profileManager.getProfilesPath()}/${profileName}`;
      
      console.log(header(`Profile: ${profileFormat(profile.name)}`));
      console.log('');
      
      // Git Configuration
      if (profile.git?.configPath) {
        console.log(info('Git Configuration:'));
        const configFile = profile.git.configPath.replace('${KONTEXT_PROFILE_DIR}/', '');
        console.log(`  Config file: ${configFile}`);
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
      
      // Dotfiles
      if (profile.dotfiles && Object.keys(profile.dotfiles).length > 0) {
        console.log(info('Configuration Files:'));
        for (const [target, source] of Object.entries(profile.dotfiles)) {
          const fileName = source.replace('${KONTEXT_PROFILE_DIR}/', '');
          console.log(`  ${target} → ${fileName}`);
        }
        console.log('');
      }
      
      // Shell Script
      if (profile.environment?.scriptPath) {
        console.log(info('Shell Script:'));
        console.log(`  ${profile.environment.scriptPath}`);
        console.log('');
      }
      
      // Hooks
      if (profile.hooks?.onActivate || profile.hooks?.onDeactivate) {
        console.log(info('Hooks:'));
        if (profile.hooks.onActivate) {
          console.log(`  Activation: ${profile.hooks.onActivate}`);
        }
        if (profile.hooks.onDeactivate) {
          console.log(`  Deactivation: ${profile.hooks.onDeactivate}`);
        }
        console.log('');
      }
      
      // Show empty sections
      if (!profile.git?.configPath) {
        console.log(info('Git Configuration: Not configured'));
        console.log('');
      }
      
      if (!profile.environment?.variables || Object.keys(profile.environment.variables).length === 0) {
        console.log(info('Environment Variables: None'));
        console.log('');
      }
      
      if (!profile.dotfiles || Object.keys(profile.dotfiles).length === 0) {
        console.log(info('Configuration Files: None'));
        console.log('');
      }
      
      if (!profile.environment?.scriptPath) {
        console.log(info('Shell Script: None'));
        console.log('');
      }
      
      if (!profile.hooks?.onActivate && !profile.hooks?.onDeactivate) {
        console.log(info('Hooks: None'));
        console.log('');
      }
      
      console.log(divider());
      console.log('');
      console.log(info('Profile Directory:'));
      console.log(`  ${path(profileDir)}/`);
      console.log('');
      console.log(info('Available Actions:'));
      console.log(`  kontext edit ${profileName}     # Edit this profile`);
      console.log(`  kontext switch ${profileName}   # Activate this profile`);
      console.log(`  kontext delete ${profileName}   # Delete this profile`);
      console.log(`  kontext list --detailed         # View all profiles`);
      
    } catch (err) {
      console.error(error(`Failed to show profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });