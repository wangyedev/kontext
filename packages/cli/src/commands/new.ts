import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { ProfileManager, Profile, EnvironmentManager, HookManager } from '../../../core/src';
import { success, error, warning, info, profile as profileFormat, header } from '../utils/prompt-utils';

export const newCommand = new Command('new')
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
      
      // Dotfiles configuration
      console.log('');
      console.log(info('Configuration Files (optional)'));
      console.log('Select which configuration files you\'d like to manage with this profile:');
      const dotfileAnswers = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedDotfiles',
          message: 'Select configuration files to create:',
          choices: [
            { name: '.npmrc (NPM configuration)', value: 'npmrc' },
            { name: '.gitconfig (Git configuration)', value: 'gitconfig', checked: gitAnswers.setupGit },
            { name: '.env (Environment variables)', value: 'env' },
            { name: '.yarnrc.yml (Yarn configuration)', value: 'yarnrc' },
            { name: 'Custom file', value: 'custom' }
          ]
        },
        {
          type: 'input',
          name: 'customFile',
          message: 'Enter custom file name (e.g., .eslintrc.json):',
          when: (answers) => answers.selectedDotfiles.includes('custom'),
          validate: (input: string) => input.trim() ? true : 'Custom file name cannot be empty'
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
            // Validate variable name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varAnswers.name)) {
              console.log(warning('Invalid variable name. Must start with letter or underscore and contain only letters, numbers, and underscores.'));
              continue;
            }
            
            environmentVariables[varAnswers.name] = varAnswers.value || '';
          }
        }
      }
      
      // Shell script
      console.log('');
      console.log(info('Shell Script (optional)'));
      const scriptAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupScript',
          message: 'Would you like to specify a shell script to source?',
          default: false
        },
        {
          type: 'input',
          name: 'scriptPath',
          message: 'Path to shell script (absolute or relative):',
          when: (answers) => answers.setupScript,
          validate: (input: string) => input.trim() ? true : 'Script path cannot be empty'
        }
      ]);
      
      // Validate script path if provided
      if (scriptAnswers.setupScript && scriptAnswers.scriptPath) {
        try {
          await EnvironmentManager.validateScriptPath(scriptAnswers.scriptPath);
        } catch (err) {
          console.log(warning(`Script validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
          const continueAnswer = await inquirer.prompt([{
            type: 'confirm',
            name: 'continue',
            message: 'Continue creating profile anyway?',
            default: true
          }]);
          
          if (!continueAnswer.continue) {
            console.log('Profile creation cancelled.');
            process.exit(0);
          }
        }
      }
      
      // Hooks configuration
      console.log('');
      console.log(info('Hooks (optional)'));
      console.log('Hooks allow you to run custom scripts when the profile is activated or deactivated.');
      const hooksAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupHooks',
          message: 'Would you like to configure hooks?',
          default: false
        },
        {
          type: 'input',
          name: 'activateHook',
          message: 'Path to activation hook script (runs when profile activates):',
          when: (answers) => answers.setupHooks,
          validate: (input: string) => !input.trim() || input.trim() ? true : 'Hook path cannot be empty if provided'
        },
        {
          type: 'input',
          name: 'deactivateHook',
          message: 'Path to deactivation hook script (runs when profile deactivates):',
          when: (answers) => answers.setupHooks,
          validate: (input: string) => !input.trim() || input.trim() ? true : 'Hook path cannot be empty if provided'
        }
      ]);
      
      // Validate hook paths if provided
      if (hooksAnswers.setupHooks) {
        if (hooksAnswers.activateHook && hooksAnswers.activateHook.trim()) {
          try {
            await HookManager.validateHookPath(hooksAnswers.activateHook.trim());
          } catch (err) {
            console.log(warning(`Activation hook validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
          }
        }
        
        if (hooksAnswers.deactivateHook && hooksAnswers.deactivateHook.trim()) {
          try {
            await HookManager.validateHookPath(hooksAnswers.deactivateHook.trim());
          } catch (err) {
            console.log(warning(`Deactivation hook validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
          }
        }
      }
      
      // Prepare dotfiles mapping
      let dotfiles: Record<string, string> = {};
      const selectedDotfiles = dotfileAnswers.selectedDotfiles || [];
      
      // Always include .gitconfig if git is configured
      if (gitAnswers.setupGit) {
        dotfiles['~/.gitconfig'] = '${KONTEXT_PROFILE_DIR}/.gitconfig';
      }
      
      if (selectedDotfiles.includes('npmrc')) {
        dotfiles['~/.npmrc'] = '${KONTEXT_PROFILE_DIR}/.npmrc';
      }
      if (selectedDotfiles.includes('env')) {
        dotfiles['~/.env'] = '${KONTEXT_PROFILE_DIR}/.env';
      }
      if (selectedDotfiles.includes('yarnrc')) {
        dotfiles['~/.yarnrc.yml'] = '${KONTEXT_PROFILE_DIR}/.yarnrc.yml';
      }
      if (selectedDotfiles.includes('custom') && dotfileAnswers.customFile) {
        const customFile = dotfileAnswers.customFile.trim();
        dotfiles[`~/${customFile}`] = `\${KONTEXT_PROFILE_DIR}/${customFile}`;
      }
      
      // Create profile object
      const profile: Profile = {
        name: profileName,
        git: gitAnswers.setupGit ? {
          configPath: '${KONTEXT_PROFILE_DIR}/.gitconfig'
        } : undefined,
        environment: (Object.keys(environmentVariables).length > 0 || scriptAnswers.setupScript) ? {
          variables: Object.keys(environmentVariables).length > 0 ? environmentVariables : undefined,
          scriptPath: scriptAnswers.setupScript ? scriptAnswers.scriptPath : undefined
        } : undefined,
        dotfiles: Object.keys(dotfiles).length > 0 ? dotfiles : undefined,
        hooks: hooksAnswers.setupHooks && (hooksAnswers.activateHook?.trim() || hooksAnswers.deactivateHook?.trim()) ? {
          onActivate: hooksAnswers.activateHook?.trim() || undefined,
          onDeactivate: hooksAnswers.deactivateHook?.trim() || undefined
        } : undefined
      };
      
      // Validate environment variables
      if (profile.environment?.variables) {
        try {
          EnvironmentManager.validateEnvironmentVariables(profile.environment.variables);
        } catch (err) {
          console.log(error(`Environment variable validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
          process.exit(1);
        }
      }
      
      // Show summary
      console.log('');
      console.log(header('Profile Summary'));
      console.log(`Name: ${profileFormat(profile.name)}`);
      if (profile.git?.configPath) {
        const configFile = profile.git.configPath.replace('${KONTEXT_PROFILE_DIR}/', '');
        console.log(`Git config: ${configFile}`);
      }
      if (profile.environment?.variables && Object.keys(profile.environment.variables).length > 0) {
        console.log(`Environment variables: ${Object.keys(profile.environment.variables).length}`);
      }
      if (profile.environment?.scriptPath) {
        console.log(`Shell script: ${profile.environment.scriptPath}`);
      }
      if (profile.dotfiles && Object.keys(profile.dotfiles).length > 0) {
        console.log(`Configuration files: ${Object.keys(profile.dotfiles).length}`);
      }
      if (profile.hooks?.onActivate) {
        console.log(`Activation hook: ${profile.hooks.onActivate}`);
      }
      if (profile.hooks?.onDeactivate) {
        console.log(`Deactivation hook: ${profile.hooks.onDeactivate}`);
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
      
      // Create dotfiles with default content
      const profileDir = path.join(profileManager.getProfilesPath(), profileName);
      await createDotfiles(profileDir, selectedDotfiles, gitAnswers, dotfileAnswers);
      
      console.log('');
      console.log(success(`Profile "${profileName}" created successfully!`));
      console.log('');
      console.log(header('What\'s Next?'));
      console.log('');
      console.log(info('📁 Profile Location:'));
      console.log(`   ${profileDir}/`);
      console.log('');
      if (Object.keys(dotfiles).length > 0) {
        console.log(info('📄 Configuration Files Created:'));
        Object.keys(dotfiles).forEach(target => {
          const fileName = path.basename(dotfiles[target].replace('${KONTEXT_PROFILE_DIR}/', ''));
          console.log(`   ${fileName}`);
        });
        console.log('');
      }
      console.log(info('🛠️  Useful Commands:'));
      console.log(`   kontext profile show ${profileName}     # View your new profile`);
      console.log(`   kontext profile edit ${profileName}     # Edit the profile configuration`);
      console.log(`   kontext switch ${profileName}   # Test the profile manually`);
      console.log('');
      console.log(info('📂 Set Up Directory Association:'));
      console.log('   1. Navigate to your project directory:');
      console.log('      cd ~/path/to/your/project');
      console.log('');
      console.log(`   2. Create profile association:`);
      console.log(`      echo "${profileName}" > .kontext-profile`);
      console.log('');
      console.log('   3. Test it works:');
      console.log('      kontext current');
      console.log('');
      console.log(info('💡 Pro Tips:'));
      console.log('   • The profile activates automatically when you cd into the directory');
      console.log('   • Configuration files are symlinked when the profile is active');
      console.log('   • Edit dotfiles directly in the profile directory');
      console.log('   • Use kontext config for more help and examples');
      
    } catch (err) {
      console.error(error(`Failed to create profile: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Helper function to create dotfiles with default content
async function createDotfiles(
  profileDir: string, 
  selectedDotfiles: string[], 
  gitAnswers: any, 
  dotfileAnswers: any
): Promise<void> {
  try {
    if (selectedDotfiles.includes('npmrc')) {
      const npmrcContent = `# NPM Configuration for profile\n# Example:\n# registry=https://npm.example.com/\n# //npm.example.com/:_authToken=your-token\n`;
      await fs.promises.writeFile(path.join(profileDir, '.npmrc'), npmrcContent, 'utf8');
    }
    
    if (gitAnswers.setupGit) {
      const gitConfigContent = `[user]\n\tname = ${gitAnswers.userName}\n\temail = ${gitAnswers.userEmail}\n\n# Add your git aliases and configuration here\n# [alias]\n#\tst = status\n#\tco = checkout\n`;
      await fs.promises.writeFile(path.join(profileDir, '.gitconfig'), gitConfigContent, 'utf8');
    }
    
    if (selectedDotfiles.includes('env')) {
      const envContent = `# Environment variables for this profile\n# Example:\n# NODE_ENV=development\n# API_URL=https://api.example.com\n`;
      await fs.promises.writeFile(path.join(profileDir, '.env'), envContent, 'utf8');
    }
    
    if (selectedDotfiles.includes('yarnrc')) {
      const yarnrcContent = `# Yarn configuration\nyarnPath: .yarn/releases/yarn-stable.cjs\nnodeLinker: node-modules\n\n# Example:\n# npmRegistryServer: https://npm.example.com/\n`;
      await fs.promises.writeFile(path.join(profileDir, '.yarnrc.yml'), yarnrcContent, 'utf8');
    }
    
    if (selectedDotfiles.includes('custom') && dotfileAnswers.customFile) {
      const customFile = dotfileAnswers.customFile.trim();
      const customContent = `# Custom configuration file: ${customFile}\n# Add your configuration here\n`;
      await fs.promises.writeFile(path.join(profileDir, customFile), customContent, 'utf8');
    }
  } catch (err) {
    console.warn(warning(`Warning: Failed to create some dotfiles: ${err instanceof Error ? err.message : 'Unknown error'}`));
  }
}