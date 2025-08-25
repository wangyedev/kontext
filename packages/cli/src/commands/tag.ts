import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'fs';
import { ProfileManager, DirectoryScanner } from '../../../core/src';
import { success, error, warning, info, profile as profileFormat, header, path as pathFormat } from '../utils/prompt-utils';

export const tagCommand = new Command('tag')
  .description('Apply a profile to the current directory, or manage profile associations')
  .argument('[profile]', 'Profile name to apply to this directory (if provided)')
  .action(async (profileName?: string) => {
    // If no profile name is provided, show help
    if (!profileName) {
      tagCommand.help();
      return;
    }
    
    // Otherwise, apply the tag
    try {
      const profileManager = new ProfileManager();
      
      // Validate that the profile exists
      if (!(await profileManager.profileExists(profileName))) {
        console.log(error(`Profile "${profileName}" does not exist`));
        console.log('');
        console.log('Available profiles:');
        const profiles = await profileManager.listProfiles();
        if (profiles.length === 0) {
          console.log('  None found. Create one with: kontext profile new');
        } else {
          profiles.forEach(name => console.log(`  ${profileFormat(name)}`));
        }
        process.exit(1);
      }
      
      const currentDir = process.cwd();
      
      // Check if a profile file already exists
      if (await DirectoryScanner.hasProfileFile(currentDir)) {
        const existingProfile = await DirectoryScanner.getActiveProfile(currentDir);
        
        if (existingProfile === profileName) {
          console.log(info(`This directory is already tagged with the ${profileFormat(profileName)} profile.`));
          return;
        }
        
        console.log(warning(`This directory is already tagged with the ${profileFormat(existingProfile || 'unknown')} profile.`));
        
        const overwriteAnswer = await inquirer.prompt([{
          type: 'confirm',
          name: 'overwrite',
          message: `Replace it with ${profileFormat(profileName)}?`,
          default: false
        }]);
        
        if (!overwriteAnswer.overwrite) {
          console.log(info('Operation cancelled.'));
          return;
        }
        
        // Remove existing profile file first
        await DirectoryScanner.removeProfileFile(currentDir);
      }
      
      // Create the new profile file
      await DirectoryScanner.createProfileFile(currentDir, profileName);
      
      console.log('');
      console.log(success(`✅ Tagged this directory with the '${profileName}' profile.`));
      console.log('');
      console.log(info('📁 Directory:'), pathFormat(currentDir));
      console.log(info('📄 Profile file:'), '.kontext-profile');
      console.log('');
      console.log(info('💡 The profile will automatically activate when you:'));
      console.log('   • Navigate to this directory (cd ...)');
      console.log('   • Navigate to any subdirectory');
      console.log('');
      console.log('Useful commands:');
      console.log(`   kontext status           # Check current profile status`);
      console.log(`   kontext tag remove       # Remove profile association`);
      
    } catch (err) {
      console.error(error(`Failed to tag directory: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// kontext tag remove
const removeCommand = new Command('remove')
  .alias('rm')
  .description('Remove profile association from the current directory')
  .action(async () => {
    try {
      const currentDir = process.cwd();
      
      // Check if a profile file exists
      if (!(await DirectoryScanner.hasProfileFile(currentDir))) {
        console.log(info('No tag found in this directory.'));
        console.log('');
        console.log('To tag this directory with a profile:');
        console.log('   kontext tag <profile-name>');
        return;
      }
      
      // Get the current profile name for display
      const currentProfile = await DirectoryScanner.getActiveProfile(currentDir);
      const profileDisplay = currentProfile ? profileFormat(currentProfile) : 'unknown';
      
      console.log(warning(`This will remove the ${profileDisplay} profile association from this directory.`));
      console.log(info('📁 Directory:'), pathFormat(currentDir));
      console.log('');
      
      const confirmAnswer = await inquirer.prompt([{
        type: 'confirm',
        name: 'remove',
        message: 'Remove the profile tag?',
        default: false
      }]);
      
      if (!confirmAnswer.remove) {
        console.log(info('Operation cancelled.'));
        return;
      }
      
      // Remove the profile file
      await DirectoryScanner.removeProfileFile(currentDir);
      
      console.log('');
      console.log(success('✅ Removed tag from this directory.'));
      console.log('');
      console.log('The profile is no longer associated with this directory.');
      
    } catch (err) {
      console.error(error(`Failed to remove tag: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// kontext tag list --interactive
const listTagsCommand = new Command('list')
  .description('List and manage all profile tags')
  .option('-i, --interactive', 'Interactive dashboard for managing tags')
  .action(async (options) => {
    try {
      console.log(header('Searching for profile tags...'));
      console.log('');
      
      // Find all profile files
      const homeDir = process.env.HOME || process.cwd();
      const profileFiles = await DirectoryScanner.findAllProfileFiles(homeDir);
      
      if (profileFiles.length === 0) {
        console.log(info('No profile tags found in your home directory.'));
        console.log('');
        console.log('To create a tag:');
        console.log('   1. Navigate to your project directory');
        console.log('   2. Run: kontext tag <profile-name>');
        return;
      }
      
      console.log(header(`Found ${profileFiles.length} Profile Tags`));
      console.log('');
      
      if (!options.interactive) {
        // Simple list view
        profileFiles.forEach((file, index) => {
          const relativePath = file.directory.replace(homeDir, '~');
          console.log(`[${index + 1}] ${relativePath} → ${profileFormat(file.profileName)}`);
        });
        console.log('');
        console.log('Use --interactive flag for management options');
        return;
      }
      
      // Interactive dashboard
      let running = true;
      while (running) {
        console.clear();
        console.log(header(`Profile Tags Dashboard (${profileFiles.length} found)`));
        console.log('');
        
        // Display current tags
        const choices = profileFiles.map((file, index) => {
          const relativePath = file.directory.replace(homeDir, '~');
          return {
            name: `[${index + 1}] ${relativePath} → ${file.profileName}`,
            value: index
          };
        });
        
        choices.push(
          { name: '───────────────────────────', value: 'separator' as any },
          { name: '🔄 Refresh list', value: 'refresh' as any },
          { name: '❌ Exit', value: 'exit' as any }
        );
        
        const answer = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'Select a tag to manage:',
          choices,
          pageSize: Math.min(15, choices.length)
        }]);
        
        if (answer.action === 'exit') {
          running = false;
          continue;
        }
        
        if (answer.action === 'refresh') {
          // Refresh the list
          const newProfileFiles = await DirectoryScanner.findAllProfileFiles(homeDir);
          profileFiles.splice(0, profileFiles.length, ...newProfileFiles);
          continue;
        }
        
        if (answer.action === 'separator') {
          continue;
        }
        
        // Handle tag selection
        const selectedFile = profileFiles[answer.action as number];
        if (!selectedFile) continue;
        
        console.log('');
        console.log(info('📁 Directory:'), pathFormat(selectedFile.directory));
        console.log(info('📄 Profile:'), profileFormat(selectedFile.profileName));
        console.log(info('🔗 Tag file:'), selectedFile.path);
        console.log('');
        
        const actionAnswer = await inquirer.prompt([{
          type: 'list',
          name: 'tagAction',
          message: 'What would you like to do?',
          choices: [
            { name: '🗂️  Open directory in terminal', value: 'open' },
            { name: '🗑️  Delete tag file', value: 'delete' },
            { name: '↩️  Back to list', value: 'back' }
          ]
        }]);
        
        if (actionAnswer.tagAction === 'back') {
          continue;
        }
        
        if (actionAnswer.tagAction === 'open') {
          console.log('');
          console.log(info('To navigate to this directory, run:'));
          console.log(`cd "${selectedFile.directory}"`);
          console.log('');
          
          await inquirer.prompt([{
            type: 'input',
            name: 'continue',
            message: 'Press Enter to continue...'
          }]);
          continue;
        }
        
        if (actionAnswer.tagAction === 'delete') {
          console.log('');
          console.log(warning(`⚠️  This will delete the tag file: ${selectedFile.path}`));
          console.log('The profile association will be removed from this directory.');
          console.log('');
          
          const confirmAnswer = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Delete this tag file?',
            default: false
          }]);
          
          if (confirmAnswer.confirm) {
            try {
              await fs.promises.unlink(selectedFile.path);
              console.log('');
              console.log(success('✅ Tag file deleted successfully.'));
              
              // Remove from our local list
              const index = profileFiles.indexOf(selectedFile);
              if (index > -1) {
                profileFiles.splice(index, 1);
              }
              
            } catch (err) {
              console.log('');
              console.log(error(`Failed to delete tag file: ${err instanceof Error ? err.message : 'Unknown error'}`));
            }
            
            await inquirer.prompt([{
              type: 'input',
              name: 'continue',
              message: 'Press Enter to continue...'
            }]);
          }
        }
      }
      
      console.log('');
      console.log(info('Tag management complete.'));
      
    } catch (err) {
      console.error(error(`Failed to list tags: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Add subcommands to the tag command
tagCommand.addCommand(removeCommand);
tagCommand.addCommand(listTagsCommand);