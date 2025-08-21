import { Command } from 'commander';
import { DirectoryScanner, ProfileManager, EnvironmentManager } from '@kontext/core';
import { success, error, info, profile as profileFormat, header } from '../utils/prompt-utils';

export const currentCommand = new Command('current')
  .description('Show the currently active profile')
  .option('-d, --detailed', 'Show detailed profile information')
  .action(async (options) => {
    try {
      // Check environment variable first
      const envProfile = EnvironmentManager.getCurrentProfile();
      
      // Check directory-based profile
      const dirProfile = await DirectoryScanner.getActiveProfile();
      
      if (!envProfile && !dirProfile) {
        console.log(info('No profile currently active'));
        console.log('');
        console.log('To activate a profile:');
        console.log('1. Navigate to a directory with a .kontext-profile file, or');
        console.log('2. Use: kontext switch <profile-name>');
        return;
      }
      
      const activeProfile = envProfile || dirProfile;
      const profileSource = envProfile ? 'environment' : 'directory';
      
      console.log(header('Current Profile'));
      console.log('');
      console.log(`Active profile: ${profileFormat(activeProfile!)}`);
      console.log(`Source: ${profileSource}`);
      
      if (options.detailed) {
        console.log('');
        
        try {
          const profileManager = new ProfileManager();
          const profile = await profileManager.getProfile(activeProfile!);
          
          if (profile) {
            if (profile.git?.userName || profile.git?.userEmail) {
              console.log('Git Configuration:');
              console.log(`  User: ${profile.git.userName || 'Not set'}`);
              console.log(`  Email: ${profile.git.userEmail || 'Not set'}`);
              console.log('');
            }
            
            if (profile.environment?.variables && Object.keys(profile.environment.variables).length > 0) {
              console.log('Environment Variables:');
              for (const [key, value] of Object.entries(profile.environment.variables)) {
                console.log(`  ${key}=${value}`);
              }
              console.log('');
            }
            
            if (profile.environment?.scriptPath) {
              console.log('Shell Script:');
              console.log(`  ${profile.environment.scriptPath}`);
              console.log('');
            }
            
            // Show directory context if available
            if (profileSource === 'directory') {
              const profileFilePath = await DirectoryScanner.findProfileFile();
              if (profileFilePath) {
                const profileDir = DirectoryScanner.getProfileFileDirectory(profileFilePath);
                console.log('Profile Directory:');
                console.log(`  ${profileDir}`);
                console.log('');
              }
            }
          } else {
            console.log(error(`Could not load profile details for "${activeProfile}"`));
          }
        } catch (err) {
          console.log(error(`Failed to load profile details: ${err instanceof Error ? err.message : 'Unknown error'}`));
        }
      }
      
    } catch (err) {
      console.error(error(`Failed to get current profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });