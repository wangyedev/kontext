import { Command } from 'commander';
import { GitConfigManager } from '../../../core/src';
import { detectShell, generateHookCommand } from '../utils/shell-detection';
import { success, error, warning, info, header, command, divider } from '../utils/prompt-utils';

export const initCommand = new Command('init')
  .description('Set up Kontext shell integration')
  .action(async () => {
    try {
      console.log(header('Welcome to Kontext!'));
      console.log('');
      console.log('To finish installation, we need to add a hook to your shell configuration.');
      console.log('');

      // Detect shell
      const shellInfo = detectShell();
      console.log(info(`We've detected you are using ${shellInfo.type}.`));
      console.log('');

      // Check if git is available
      if (!GitConfigManager.isGitAvailable()) {
        console.log(warning('Git is not available on your system. Some features will be limited.'));
        console.log('Please install Git to use profile-based Git identity switching.');
        console.log('');
      }

      // Set up git include if git is available
      if (GitConfigManager.isGitAvailable()) {
        try {
          await GitConfigManager.setupGitInclude();
          console.log(success('Git configuration setup completed.'));
        } catch (err) {
          console.log(
            warning(
              `Could not set up Git configuration: ${err instanceof Error ? err.message : 'Unknown error'}`
            )
          );
          console.log('You can run this command again later to set up Git integration.');
        }
        console.log('');
      }

      // Generate hook command
      const hookCommand = generateHookCommand(shellInfo.type);

      console.log(header('Shell Integration Setup'));
      console.log('');
      console.log('Run the following command to add the hook to your shell configuration:');
      console.log('');
      console.log(command(hookCommand));
      console.log('');
      console.log('After running the command, restart your shell or run:');
      console.log(command(`source ${shellInfo.configFile}`));
      console.log('');
      console.log(divider());
      console.log('');
      console.log(success('Setup instructions provided!'));
      console.log('');
      console.log('Next steps:');
      console.log('1. Run the shell configuration command above');
      console.log('2. Restart your shell or source your config file');
      console.log('3. Create your first profile with:', command('kontext new'));
      console.log('4. Navigate to a project directory and create a .kontext-profile file');
      console.log('');
    } catch (err) {
      console.error(
        error(
          `Failed to initialize Kontext: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });
