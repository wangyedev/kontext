# Kontext

A CLI tool for managing development profiles and automating shell environment switching.

## Overview

Kontext allows developers to define and switch between distinct development profiles, automating the management of their shell environment and Git configurations. It provides seamless, directory-based context switching to eliminate the manual, error-prone process of juggling configurations between different projects.

## Features

- **Profile Management**: Define profiles in YAML files with Git identity and environment configurations
- **Directory-based Activation**: Automatically switch profiles when entering directories with `.kontext-profile` files
- **Git Identity Management**: Automatically configure Git user name and email based on the active profile
- **Environment Variables**: Set profile-specific environment variables
- **Shell Script Integration**: Source custom shell scripts for profile-specific configurations
- **Cross-shell Support**: Works with Bash, Zsh, and Fish shells

## Installation

1. Download the Kontext executable for your platform from the releases page
2. Place it in your PATH (e.g., `/usr/local/bin/kontext`)
3. Run the initialization command:

```bash
kontext init
```

4. Follow the instructions to add the shell hook to your configuration file
5. Restart your shell or source your config file

## Quick Start

### 1. Create your first profile

```bash
kontext new work
```

Follow the interactive prompts to configure your work profile with Git identity and environment variables.

### 2. Associate a directory with a profile

Navigate to your work project directory and create a profile marker:

```bash
cd ~/work/my-project
echo "work" > .kontext-profile
```

### 3. Automatic activation

Now whenever you `cd` into that directory (or any subdirectory), Kontext will automatically:
- Switch to the "work" profile
- Update your Git configuration
- Set environment variables
- Source any profile-specific shell scripts
- Update your shell prompt to show the active profile

## Commands

- `kontext init` - Set up shell integration
- `kontext new [profile]` - Create a new profile interactively
- `kontext list` - List all available profiles
- `kontext switch <profile>` - Manually switch to a profile
- `kontext current` - Show the currently active profile
- `kontext hook init` - Generate shell integration script (used internally)

## Profile Configuration

Profiles are stored as YAML files in `~/.config/kontext/profiles/`. Here's an example:

```yaml
name: work
git:
  user_name: John Doe
  user_email: john.doe@company.com
environment:
  variables:
    NODE_ENV: development
    API_URL: https://api.company.com
  script_path: ~/.config/kontext/scripts/work.sh
```

## Development

This project is built with TypeScript and uses a monorepo structure:

- `packages/core/` - Core functionality (profile management, directory scanning, etc.)
- `packages/cli/` - Command-line interface

### Building

```bash
pnpm install
pnpm run build
```

### Packaging

```bash
pnpm run package
```

This creates single executables for macOS, Linux, and Windows in the `build/` directory.

## License

ISC