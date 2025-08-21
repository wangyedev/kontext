import chalk from 'chalk';

/**
 * Formats success messages
 */
export function success(message: string): string {
  return chalk.green('✅ ' + message);
}

/**
 * Formats error messages
 */
export function error(message: string): string {
  return chalk.red('❌ ' + message);
}

/**
 * Formats warning messages
 */
export function warning(message: string): string {
  return chalk.yellow('⚠️  ' + message);
}

/**
 * Formats info messages
 */
export function info(message: string): string {
  return chalk.blue('ℹ️  ' + message);
}

/**
 * Formats code blocks
 */
export function code(text: string): string {
  return chalk.bgBlack.white(` ${text} `);
}

/**
 * Formats profile names
 */
export function profile(name: string): string {
  return chalk.cyan.bold(name);
}

/**
 * Formats file paths
 */
export function path(filePath: string): string {
  return chalk.underline(filePath);
}

/**
 * Formats commands
 */
export function command(cmd: string): string {
  return chalk.bgBlue.white(` ${cmd} `);
}

/**
 * Creates a divider line
 */
export function divider(char: string = '─', length: number = 50): string {
  return chalk.gray(char.repeat(length));
}

/**
 * Formats a header with a title
 */
export function header(title: string): string {
  return chalk.bold.underline(title);
}