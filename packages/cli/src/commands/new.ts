import { Command } from 'commander';
import inquirer from 'inquirer';
import { ProfileManager, Profile, EnvironmentManager } from '../../../core/src';
import {
  success,
  error,
  warning,
  info,
  profile as profileFormat,
  header,
} from '../utils/prompt-utils';

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
        const nameAnswer = await inquirer.prompt([
          {
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
            },
          },
        ]);
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
          default: true,
        },
        {
          type: 'input',
          name: 'userName',
          message: 'Git user name:',
          when: answers => answers.setupGit,
          validate: (input: string) => (input.trim() ? true : 'Git user name cannot be empty'),
        },
        {
          type: 'input',
          name: 'userEmail',
          message: 'Git user email:',
          when: answers => answers.setupGit,
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Git user email cannot be empty';
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.trim())) {
              return 'Please enter a valid email address';
            }
            return true;
          },
        },
      ]);

      // Environment variables
      console.log('');
      console.log(info('Environment Variables (optional)'));
      const envAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupEnv',
          message: 'Would you like to add environment variables?',
          default: false,
        },
      ]);

      const environmentVariables: Record<string, string> = {};
      if (envAnswers.setupEnv) {
        console.log('Enter environment variables (press Enter with empty name to finish):');

        let adding = true;
        while (adding) {
          const varAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Variable name:',
            },
            {
              type: 'input',
              name: 'value',
              message: 'Variable value:',
              when: answers => answers.name.trim() !== '',
            },
          ]);

          if (!varAnswers.name.trim()) {
            adding = false;
          } else {
            // Validate variable name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varAnswers.name)) {
              console.log(
                warning(
                  'Invalid variable name. Must start with letter or underscore and contain only letters, numbers, and underscores.'
                )
              );
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
          default: false,
        },
        {
          type: 'input',
          name: 'scriptPath',
          message: 'Path to shell script (absolute or relative):',
          when: answers => answers.setupScript,
          validate: (input: string) => (input.trim() ? true : 'Script path cannot be empty'),
        },
      ]);

      // Validate script path if provided
      if (scriptAnswers.setupScript && scriptAnswers.scriptPath) {
        try {
          await EnvironmentManager.validateScriptPath(scriptAnswers.scriptPath);
        } catch (err) {
          console.log(
            warning(
              `Script validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
            )
          );
          const continueAnswer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continue',
              message: 'Continue creating profile anyway?',
              default: true,
            },
          ]);

          if (!continueAnswer.continue) {
            console.log('Profile creation cancelled.');
            process.exit(0);
          }
        }
      }

      // Create profile object
      const profile: Profile = {
        name: profileName,
        git: gitAnswers.setupGit
          ? {
              userName: gitAnswers.userName,
              userEmail: gitAnswers.userEmail,
            }
          : undefined,
        environment:
          Object.keys(environmentVariables).length > 0 || scriptAnswers.setupScript
            ? {
                variables:
                  Object.keys(environmentVariables).length > 0 ? environmentVariables : undefined,
                scriptPath: scriptAnswers.setupScript ? scriptAnswers.scriptPath : undefined,
              }
            : undefined,
      };

      // Validate environment variables
      if (profile.environment?.variables) {
        try {
          EnvironmentManager.validateEnvironmentVariables(profile.environment.variables);
        } catch (err) {
          console.log(
            error(
              `Environment variable validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
            )
          );
          process.exit(1);
        }
      }

      // Show summary
      console.log('');
      console.log(header('Profile Summary'));
      console.log(`Name: ${profileFormat(profile.name)}`);
      if (profile.git) {
        console.log(`Git user: ${profile.git.userName} <${profile.git.userEmail}>`);
      }
      if (profile.environment?.variables && Object.keys(profile.environment.variables).length > 0) {
        console.log(`Environment variables: ${Object.keys(profile.environment.variables).length}`);
      }
      if (profile.environment?.scriptPath) {
        console.log(`Shell script: ${profile.environment.scriptPath}`);
      }

      // Confirm creation
      console.log('');
      const confirmAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'create',
          message: 'Create this profile?',
          default: true,
        },
      ]);

      if (!confirmAnswer.create) {
        console.log('Profile creation cancelled.');
        process.exit(0);
      }

      // Create the profile
      await profileManager.createProfile(profile);

      console.log('');
      console.log(success(`Profile "${profileName}" created successfully!`));
      console.log('');
      console.log(header("What's Next?"));
      console.log('');
      console.log(info('📁 Profile Location:'));
      console.log(`   ${profileManager.getProfilesPath()}/${profileName}.yml`);
      console.log('');
      console.log(info('🛠️  Useful Commands:'));
      console.log(`   kontext show ${profileName}     # View your new profile`);
      console.log(`   kontext edit ${profileName}     # Edit the profile configuration`);
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
      console.log("   • Subdirectories inherit the parent's profile");
      console.log('   • Use kontext config for more help and examples');
    } catch (err) {
      console.error(
        error(`Failed to create profile: ${err instanceof Error ? err.message : 'Unknown error'}`)
      );
      process.exit(1);
    }
  });
