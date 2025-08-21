#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { newCommand } from './commands/new';
import { listCommand } from './commands/list';
import { switchCommand } from './commands/switch';
import { currentCommand } from './commands/current';
import { hookCommand } from './commands/hook';
import { editCommand } from './commands/edit';
import { showCommand } from './commands/show';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('kontext')
  .description('A CLI tool for managing development profiles and automating shell environment switching')
  .version('1.0.0');

// Add commands
program.addCommand(initCommand);
program.addCommand(newCommand);
program.addCommand(listCommand);
program.addCommand(showCommand);
program.addCommand(editCommand);
program.addCommand(switchCommand);
program.addCommand(currentCommand);
program.addCommand(configCommand);
program.addCommand(hookCommand);

// Global error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Unexpected error:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled promise rejection:'), reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();