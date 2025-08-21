import * as os from 'os';
import { execSync } from 'child_process';

export type ShellType = 'bash' | 'zsh' | 'fish' | 'unknown';

export interface ShellInfo {
  type: ShellType;
  configFile: string;
  command: string;
}

/**
 * Detects the user's current shell and returns configuration information
 */
export function detectShell(): ShellInfo {
  const shell = process.env.SHELL || '';
  const shellName = shell.split('/').pop() || '';

  switch (shellName) {
    case 'bash':
      return {
        type: 'bash',
        configFile: '~/.bashrc',
        command: 'bash',
      };

    case 'zsh':
      return {
        type: 'zsh',
        configFile: '~/.zshrc',
        command: 'zsh',
      };

    case 'fish':
      return {
        type: 'fish',
        configFile: '~/.config/fish/config.fish',
        command: 'fish',
      };

    default:
      // Try to detect from parent process if SHELL is not set
      try {
        const parentPid = process.ppid;
        const parentCommand = execSync(`ps -p ${parentPid} -o comm=`, { encoding: 'utf8' }).trim();

        if (parentCommand.includes('bash')) {
          return {
            type: 'bash',
            configFile: '~/.bashrc',
            command: 'bash',
          };
        }

        if (parentCommand.includes('zsh')) {
          return {
            type: 'zsh',
            configFile: '~/.zshrc',
            command: 'zsh',
          };
        }
      } catch {
        // Ignore errors in detection
      }

      return {
        type: 'unknown',
        configFile: '~/.profile',
        command: 'sh',
      };
  }
}

/**
 * Generates shell-specific hook integration command
 */
export function generateHookCommand(shellType: ShellType): string {
  const hookInit = 'eval "$(kontext hook init)"';

  switch (shellType) {
    case 'bash':
      return `echo '${hookInit}' >> ~/.bashrc`;

    case 'zsh':
      return `echo '${hookInit}' >> ~/.zshrc`;

    case 'fish':
      return `echo '${hookInit}' >> ~/.config/fish/config.fish`;

    default:
      return `echo '${hookInit}' >> ~/.profile`;
  }
}

/**
 * Gets the appropriate shell configuration file path
 */
export function getShellConfigPath(shellType: ShellType): string {
  const homeDir = os.homedir();

  switch (shellType) {
    case 'bash':
      return `${homeDir}/.bashrc`;

    case 'zsh':
      return `${homeDir}/.zshrc`;

    case 'fish':
      return `${homeDir}/.config/fish/config.fish`;

    default:
      return `${homeDir}/.profile`;
  }
}
