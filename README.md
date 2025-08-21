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
- **Hooks**: Execute custom scripts on profile activation and deactivation
- **Cross-shell Support**: Works with Bash, Zsh, and Fish shells

## Installation

Install Kontext globally via npm:

```bash
npm install -g kontext-cli
```

Then set up shell integration:

```bash
kontext init
```

Follow the instructions to add the shell hook to your configuration file, then restart your shell or source your config file.

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
- Execute activation hooks (if configured)
- Update your Git configuration
- Set environment variables
- Source any profile-specific shell scripts
- Update your shell prompt to show the active profile

## Commands

### Profile Management
- `kontext new [profile]` - Create a new profile interactively
- `kontext list [--detailed]` - List all available profiles
- `kontext show <profile>` - Display detailed profile configuration
- `kontext edit <profile>` - Edit a profile in your default editor

### Profile Activation
- `kontext current [--detailed] [--edit]` - Show the currently active profile
- `kontext switch <profile>` - Manually switch to a profile

### Setup & Configuration
- `kontext init` - Set up shell integration
- `kontext config` - Show configuration information and helpful commands

### Advanced
- `kontext hook init` - Generate shell integration script (used internally)

## Configuration Management

### Profile Files
Profiles are stored as YAML files in `~/.config/kontext/profiles/`. Each profile can configure:

- **Git Identity**: Automatically set `user.name` and `user.email`
- **Environment Variables**: Export custom environment variables
- **Shell Scripts**: Source additional shell configuration
- **Hooks**: Execute custom scripts on activation and deactivation

### Example Profile Configuration

```yaml
name: work
git:
  user_name: John Doe
  user_email: john.doe@company.com
environment:
  variables:
    NODE_ENV: development
    API_URL: https://api.company.com
    AWS_PROFILE: work
  script_path: ~/.config/kontext/scripts/work.sh
hooks:
  on_activate: ~/.config/kontext/hooks/work-activate.sh
  on_deactivate: ~/.config/kontext/hooks/work-deactivate.sh
```

### Managing Configurations

**View profile details:**
```bash
kontext show work
```

**Edit a profile:**
```bash
kontext edit work          # Opens in your default editor
kontext current --edit     # Edit currently active profile
```

**Find configuration files:**
```bash
kontext config             # Shows all configuration locations
```

### Directory Association

Create a `.kontext-profile` file in any directory to automatically activate a profile:

```bash
# In your project directory
echo "work" > .kontext-profile

# Test it works
kontext current
```

**Pro Tips:**
- Subdirectories inherit parent directory profiles
- Use `kontext list --detailed` to see all profile configurations
- Environment variables are only active when the profile is loaded via shell integration

## Hooks

Hooks allow you to execute custom scripts when profiles are activated or deactivated, enabling powerful automation and environment setup.

### Hook Types

- **Activation Hooks** (`on_activate`): Run when a profile is activated
- **Deactivation Hooks** (`on_deactivate`): Run when a profile is deactivated

### Hook Environment Variables

When hooks execute, they receive these environment variables:
- `KONTEXT_PROFILE`: Name of the profile being activated/deactivated
- `KONTEXT_HOOK_TYPE`: Either "activate" or "deactivate"

### Example Hook Scripts

**Activation Hook** (`~/.config/kontext/hooks/work-activate.sh`):
```bash
#!/bin/bash
echo "🚀 Starting work session for $KONTEXT_PROFILE"

# Start development services
docker-compose up -d database redis

# Switch Node.js version
nvm use 18

# Connect to work VPN
sudo vpn-connect work-profile

# Send notification
osascript -e 'display notification "Work environment activated" with title "Kontext"'
```

**Deactivation Hook** (`~/.config/kontext/hooks/work-deactivate.sh`):
```bash
#!/bin/bash
echo "🛑 Ending work session for $KONTEXT_PROFILE"

# Stop development services
docker-compose down

# Disconnect VPN
sudo vpn-disconnect

# Backup work
rsync -av ~/work/ ~/backups/work-$(date +%Y%m%d)/

# Send notification
osascript -e 'display notification "Work environment deactivated" with title "Kontext"'
```

### Hook Configuration

Add hooks to your profile YAML file:

```yaml
hooks:
  on_activate: /path/to/activate-script.sh
  on_deactivate: /path/to/deactivate-script.sh
```

Hooks support:
- Absolute paths (`/usr/local/bin/script.sh`)
- Home directory expansion (`~/scripts/hook.sh`)
- Relative paths (resolved from current directory)

### Error Handling

- Hook failures generate warnings but don't prevent profile switching
- Hooks have a 30-second timeout to prevent hanging
- Failed hooks are logged to stderr for debugging

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