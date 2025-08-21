import { Command } from 'commander';
import { ProfileManager, DirectoryScanner } from '../../../core/src';
import { success, error, info, header, path, divider, command } from '../utils/prompt-utils';
import * as fs from 'fs';

export const configCommand = new Command('config')
  .description('Show configuration information and helpful commands')
  .action(async () => {
    try {
      const profileManager = new ProfileManager();
      
      console.log(header('Kontext Configuration'));
      console.log('');
      
      // Profile directory info
      const profilesPath = profileManager.getProfilesPath();
      console.log(info('Profiles Directory:'));
      console.log(`  ${path(profilesPath)}`);
      
      // Check if directory exists
      if (fs.existsSync(profilesPath)) {
        const profiles = await profileManager.listProfiles();
        console.log(`  Contains ${profiles.length} profile(s): ${profiles.join(', ')}`);
      } else {
        console.log('  ⚠️  Directory does not exist yet (will be created when you create your first profile)');
      }
      console.log('');
      
      // Current directory context
      const activeProfile = await DirectoryScanner.getActiveProfile();
      const profileFilePath = await DirectoryScanner.findProfileFile();
      
      console.log(info('Current Directory Context:'));
      if (activeProfile && profileFilePath) {
        console.log(`  Active profile: ${activeProfile}`);
        console.log(`  Profile file: ${path(profileFilePath)}`);
        console.log(`  Context directory: ${path(DirectoryScanner.getProfileFileDirectory(profileFilePath))}`);
      } else {
        console.log('  No active profile in current directory');
        console.log('  💡 Create a .kontext-profile file to enable automatic switching');
      }
      console.log('');
      
      console.log(divider());
      console.log('');
      
      // Common commands
      console.log(info('Common Commands:'));
      console.log('  Profile Management:');
      console.log(`    ${command('kontext list')}              # List all profiles`);
      console.log(`    ${command('kontext new <name>')}        # Create a new profile`);
      console.log(`    ${command('kontext show <name>')}       # View profile details`);
      console.log(`    ${command('kontext edit <name>')}       # Edit profile in editor`);
      console.log('');
      
      console.log('  Directory Setup:');
      console.log(`    ${command('echo "work" > .kontext-profile')}  # Associate current directory with "work" profile`);
      console.log(`    ${command('kontext current')}                 # Check current profile status`);
      console.log('');
      
      console.log('  Manual Switching:');
      console.log(`    ${command('kontext switch <name>')}     # Manually activate a profile`);
      console.log('');
      
      // Configuration file locations
      console.log(info('Important File Locations:'));
      console.log(`  Profiles: ${path(profilesPath + '/<name>.yml')}`);
      console.log(`  Directory markers: ${path('.kontext-profile')} (in project directories)`);
      console.log(`  Shell integration: Added to your shell config (${path('~/.zshrc')}, ${path('~/.bashrc')}, etc.)`);
      console.log('');
      
      console.log(info('Need Help?'));
      console.log(`  ${command('kontext --help')}             # Show all available commands`);
      console.log(`  ${command('kontext <command> --help')}   # Get help for specific commands`);
      
    } catch (err) {
      console.error(error(`Failed to show configuration: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });