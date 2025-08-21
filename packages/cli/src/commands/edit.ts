import { Command } from 'commander';
import { ProfileManager } from '../../../core/src';
import { success, error, info, profile as profileFormat, path } from '../utils/prompt-utils';
import { execSync } from 'child_process';
import * as fs from 'fs';

export const editCommand = new Command('edit')
  .description('Edit a profile configuration in your default editor')
  .argument('<profile>', 'Profile name to edit')
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
      
      const profilePath = `${profileManager.getProfilesPath()}/${profileName}.yml`;
      
      if (!fs.existsSync(profilePath)) {
        console.log(error(`Profile file not found: ${profilePath}`));
        process.exit(1);
      }
      
      console.log(info(`Opening ${profileFormat(profileName)} profile for editing...`));
      console.log(`File: ${path(profilePath)}`);
      console.log('');
      
      // Determine the best editor to use
      const editor = process.env.EDITOR || 
                    process.env.VISUAL || 
                    getDefaultEditor();
      
      if (!editor) {
        console.log(error('No editor found. Please set the EDITOR environment variable or install a default editor.'));
        console.log('');
        console.log('You can edit the file manually at:');
        console.log(path(profilePath));
        process.exit(1);
      }
      
      try {
        // Open the file in the editor
        execSync(`${editor} "${profilePath}"`, { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        console.log('');
        console.log(success(`Profile ${profileFormat(profileName)} updated!`));
        console.log('');
        console.log('💡 Pro tip: Use these commands after editing:');
        console.log(`   kontext show ${profileName}     # View the updated configuration`);
        console.log(`   kontext switch ${profileName}   # Test the updated profile`);
        
      } catch (err) {
        console.log(error(`Failed to open editor: ${err instanceof Error ? err.message : 'Unknown error'}`));
        console.log('');
        console.log('You can edit the file manually at:');
        console.log(path(profilePath));
      }
      
    } catch (err) {
      console.error(error(`Failed to edit profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

function getDefaultEditor(): string | null {
  const editors = ['code', 'vim', 'nano', 'vi'];
  
  for (const editor of editors) {
    try {
      execSync(`which ${editor}`, { stdio: 'ignore' });
      return editor;
    } catch {
      // Editor not found, try next one
    }
  }
  
  return null;
}