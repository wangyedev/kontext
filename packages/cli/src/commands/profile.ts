import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { ProfileManager, Profile, DirectoryScanner } from '../../../core/src';
import { success, error, warning, info, profile as profileFormat, header, path as pathFormat } from '../utils/prompt-utils';

export const profileCommand = new Command('profile')
  .description('Manage development profiles');

// kontext profile new <name>
const newProfileCommand = new Command('new')
  .description('Create a new profile interactively')
  .argument('[name]', 'Profile name (optional - will prompt if not provided)')
  .action(async (nameArg?: string) => {
    try {
      const profileManager = new ProfileManager();
      
      console.log(header('Create New Profile'));
      console.log('');
      
      // Get profile name
      let profileName: string = nameArg || '';
      if (!profileName) {
        const nameAnswer = await inquirer.prompt([{
          type: 'input',
          name: 'name',
          message: 'What would you like to name this profile?',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Profile name cannot be empty';
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(input.trim())) {
              return 'Profile name must contain only letters, numbers, hyphens, and underscores';
            }
            return true;
          }
        }]);
        profileName = nameAnswer.name.trim();
      }
      
      // Check if profile already exists
      if (await profileManager.profileExists(profileName)) {
        console.log(error(`Profile "${profileName}" already exists`));
        process.exit(1);
      }
      
      // Git configuration
      console.log('');
      console.log(info('Git Configuration (optional)'));
      const gitAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupGit',
          message: 'Would you like to configure Git identity for this profile?',
          default: true
        },
        {
          type: 'input',
          name: 'userName',
          message: 'Git user name:',
          when: (answers) => answers.setupGit,
          validate: (input: string) => input.trim() ? true : 'Git user name cannot be empty'
        },
        {
          type: 'input',
          name: 'userEmail',
          message: 'Git user email:',
          when: (answers) => answers.setupGit,
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Git user email cannot be empty';
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.trim())) {
              return 'Please enter a valid email address';
            }
            return true;
          }
        }
      ]);
      
      // Environment variables
      console.log('');
      console.log(info('Environment Variables (optional)'));
      const envAnswers = await inquirer.prompt([{
        type: 'confirm',
        name: 'setupEnv',
        message: 'Would you like to add environment variables to the profile manifest?',
        default: false
      }]);
      
      let environmentVariables: Record<string, string> = {};
      if (envAnswers.setupEnv) {
        console.log('Enter environment variables (press Enter with empty name to finish):');
        
        let adding = true;
        while (adding) {
          const varAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Variable name:'
            },
            {
              type: 'input',
              name: 'value',
              message: 'Variable value:',
              when: (answers) => answers.name.trim() !== ''
            }
          ]);
          
          if (!varAnswers.name.trim()) {
            adding = false;
          } else {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varAnswers.name)) {
              console.log(warning('Invalid variable name. Must start with letter or underscore and contain only letters, numbers, and underscores.'));
              continue;
            }
            
            environmentVariables[varAnswers.name] = varAnswers.value || '';
          }
        }
      }
      
      // Create profile object
      const profile: Profile = {
        name: profileName,
        git: gitAnswers.setupGit ? {
          configPath: '${KONTEXT_PROFILE_DIR}/.gitconfig'
        } : undefined,
        environment: Object.keys(environmentVariables).length > 0 ? {
          variables: environmentVariables
        } : undefined,
        dotfiles: gitAnswers.setupGit ? {
          '~/.gitconfig': '${KONTEXT_PROFILE_DIR}/.gitconfig'
        } : undefined
      };
      
      // Show summary
      console.log('');
      console.log(header('Profile Summary'));
      console.log(`Name: ${profileFormat(profile.name)}`);
      if (profile.git?.configPath) {
        console.log(`Git config: .gitconfig`);
      }
      if (profile.environment?.variables && Object.keys(profile.environment.variables).length > 0) {
        console.log(`Environment variables: ${Object.keys(profile.environment.variables).length}`);
      }
      
      // Confirm creation
      console.log('');
      const confirmAnswer = await inquirer.prompt([{
        type: 'confirm',
        name: 'create',
        message: 'Create this profile?',
        default: true
      }]);
      
      if (!confirmAnswer.create) {
        console.log('Profile creation cancelled.');
        process.exit(0);
      }
      
      // Create the profile
      await profileManager.createProfile(profile);
      
      // Create .gitconfig file if needed
      if (gitAnswers.setupGit) {
        const profileDir = path.join(profileManager.getProfilesPath(), profileName);
        const gitConfigContent = `[user]\n\tname = ${gitAnswers.userName}\n\temail = ${gitAnswers.userEmail}\n`;
        await fs.promises.writeFile(path.join(profileDir, '.gitconfig'), gitConfigContent, 'utf8');
      }
      
      console.log('');
      console.log(success(`Profile "${profileName}" created successfully!`));
      console.log('');
      console.log(info('✅ Next step: Apply it to a project by running:'));
      console.log(`   cd /path/to/project && kontext tag ${profileName}`);
      
    } catch (err) {
      console.error(error(`Failed to create profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// kontext profile list
const listProfileCommand = new Command('list')
  .description('List all available profiles')
  .option('-d, --detailed', 'Show detailed profile information')
  .action(async (options) => {
    try {
      const profileManager = new ProfileManager();
      const profiles = await profileManager.listProfiles();
      
      if (profiles.length === 0) {
        console.log(info('No profiles found.'));
        console.log('Create your first profile with: kontext profile new');
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
              console.log(`    Git: .gitconfig`);
            }
            
            if (profile.environment?.variables) {
              const varCount = Object.keys(profile.environment.variables).length;
              console.log(`    Environment variables: ${varCount}`);
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

// kontext profile edit <name>
const editProfileCommand = new Command('edit')
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
      
      const profileDir = `${profileManager.getProfilesPath()}/${profileName}`;
      const profilePath = `${profileDir}/profile.yml`;
      
      if (!fs.existsSync(profilePath)) {
        console.log(error(`Profile manifest not found: ${profilePath}`));
        process.exit(1);
      }
      
      console.log(info(`Opening ${profileFormat(profileName)} profile for editing...`));
      console.log(`Directory: ${pathFormat(profileDir)}/`);
      
      // Determine the best editor to use
      const editor = process.env.EDITOR || 
                    process.env.VISUAL || 
                    getDefaultEditor();
      
      if (!editor) {
        console.log(error('No editor found. Please set the EDITOR environment variable or install a default editor.'));
        console.log('');
        console.log('You can edit files manually in the profile directory:');
        console.log(pathFormat(profileDir));
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
        
      } catch (err) {
        console.log(error(`Failed to open editor: ${err instanceof Error ? err.message : 'Unknown error'}`));
        console.log('');
        console.log('You can edit files manually in the profile directory:');
        console.log(pathFormat(profileDir));
      }
      
    } catch (err) {
      console.error(error(`Failed to edit profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// kontext profile delete <name>
const deleteProfileCommand = new Command('delete')
  .alias('remove')
  .description('Delete a profile and all its contents')
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
        console.log('1. Switch to a different profile or navigate away from this directory');
        console.log('2. Then run the delete command again');
        process.exit(1);
      }
      
      // TODO: Check for active tags (will implement in Phase 3)
      console.log(warning(`⚠️  You are about to delete profile: ${profileFormat(profileName)}`));
      console.log('This will permanently delete the profile folder and all its files.');
      console.log('');
      
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
      
    } catch (err) {
      console.error(error(`Failed to delete profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Helper functions
async function confirmDeletion(profileName: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`Are you sure you want to permanently delete the '${profileName}' profile and all its files? [y/N]: `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

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

// Add subcommands to the profile command
profileCommand.addCommand(newProfileCommand);
profileCommand.addCommand(listProfileCommand);
profileCommand.addCommand(editProfileCommand);
profileCommand.addCommand(deleteProfileCommand);