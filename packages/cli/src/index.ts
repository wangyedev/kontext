#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init";
import { switchCommand } from "./commands/switch";
import { hookCommand } from "./commands/hook";
import { configCommand } from "./commands/config";
import { statusCommand } from "./commands/status";
import { profileCommand } from "./commands/profile";
import { tagCommand } from "./commands/tag";

const program = new Command();

program
  .name("kontext")
  .description(
    "A CLI tool for managing development profiles and automating shell environment switching"
  )
  .version("1.5.0");

// Add command groups
program.addCommand(profileCommand);
program.addCommand(tagCommand);

// Add core commands
program.addCommand(initCommand);
program.addCommand(statusCommand);
program.addCommand(switchCommand);
program.addCommand(configCommand);
program.addCommand(hookCommand);

// Global error handling
process.on("uncaughtException", (error) => {
  console.error(chalk.red("Unexpected error:"), error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("Unhandled promise rejection:"), reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();
