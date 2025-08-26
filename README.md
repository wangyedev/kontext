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
- **Modern Command Structure**: Intuitive `profile` and `tag` command groups for organized management

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
kontext profile new work
```

Follow the interactive prompts to configure your work profile with Git configuration, dotfiles, and environment variables.

### 2. Associate a directory with a profile

Navigate to your work project directory and tag it:

```bash
cd ~/work/my-project
kontext tag work
```

### 3. Automatic activation

Now whenever you `cd` into that directory (or any subdirectory), Kontext will automatically:
- Switch to the "work" profile
- Execute activation hooks (if configured)
- Update your Git configuration
- Set environment variables
- Source any profile-specific shell scripts
- Update your shell prompt to show the active profile

### 4. Manual switching (optional)

You can also manually switch profiles for the current session:
```bash
kontext switch personal
# Profile "personal" activated
```

Manual switches are temporary and only affect the current shell session. When you open a new terminal, the automatic directory-based rules apply.

## Commands

### Profile Management (`kontext profile`)
- `kontext profile new [name]` - Create a new profile interactively
- `kontext profile list [--detailed]` - List all available profiles
- `kontext profile edit <name>` - Edit a profile in your default editor
- `kontext profile delete <name>` - Delete a profile and its files

### Directory Tagging (`kontext tag`)
- `kontext tag <profile>` - Apply a profile to the current directory
- `kontext tag remove` (or `rm`) - Remove profile association from current directory
- `kontext tag list [--interactive]` - List and manage all profile tags across filesystem

### Profile Status & Activation
- `kontext status [profile]` - Show detailed profile status and system state
- `kontext switch <profile>` - Manually switch to a profile (temporary, session-only)

### Setup & Configuration
- `kontext init` - Set up shell integration
- `kontext config` - Show configuration information and helpful commands

### Advanced
- `kontext hook init` - Generate shell integration script (used internally)

## Configuration Management

### Profile Files
Profiles are stored as folders in `~/.config/kontext/profiles/`, each containing a `profile.yml` file and associated configuration files. Each profile can configure:

- **Git Configuration**: Use a dedicated `.gitconfig` file for the profile
- **Environment Variables**: Export custom environment variables
- **Dotfile Management**: Automatically symlink dotfiles like `.vimrc`, `.tmux.conf`, etc.
- **Hooks**: Execute custom scripts on activation and deactivation

### Example Profile Configuration

```yaml
name: work
git:
  config_path: ${KONTEXT_PROFILE_DIR}/.gitconfig
environment:
  variables:
    NODE_ENV: development
    API_URL: https://api.company.com
    AWS_PROFILE: work
dotfiles:
  ~/.vimrc: ${KONTEXT_PROFILE_DIR}/.vimrc
  ~/.tmux.conf: ${KONTEXT_PROFILE_DIR}/.tmux.conf
hooks:
  on_activate: ${KONTEXT_PROFILE_DIR}/hooks/activate.sh
  on_deactivate: ${KONTEXT_PROFILE_DIR}/hooks/deactivate.sh
```

### Managing Configurations

**View profile details:**
```bash
kontext status work
```

**Edit a profile:**
```bash
kontext profile edit work  # Opens in your default editor
kontext status             # View currently active profile
```

**Find configuration files:**
```bash
kontext config             # Shows all configuration locations
kontext status             # Shows active profile with file paths
```

### Directory Association

#### Method 1: Using the Tag Command (Recommended)
```bash
# Navigate to your project directory
cd ~/work/my-project

# Tag the directory with a profile
kontext tag work

# Test it works
kontext status
```

#### Method 2: Manual File Creation
```bash
# In your project directory
echo "work" > .kontext-profile

# Test it works
kontext status
```

#### Managing Tags
```bash
# List all profile tags across your filesystem
kontext tag list

# Interactive tag management dashboard
kontext tag list --interactive

# Remove a tag from current directory
kontext tag remove
# or use the short alias
kontext tag rm
```

**Pro Tips:**
- Subdirectories inherit parent directory profiles
- Use `kontext status` to see detailed profile information and system state
- Environment variables are only active when the profile is loaded via shell integration
- Manual profile switches with `kontext switch` are temporary and session-specific
- Default profiles can be set in your home directory (`~/.kontext-profile`) for non-project folders

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

**Activation Hook** (`~/.config/kontext/profiles/work/hooks/activate.sh`):
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

**Deactivation Hook** (`~/.config/kontext/profiles/work/hooks/deactivate.sh`):
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
  on_activate: ${KONTEXT_PROFILE_DIR}/hooks/activate.sh
  on_deactivate: ${KONTEXT_PROFILE_DIR}/hooks/deactivate.sh
```

Hook scripts are stored in the `hooks/` directory within each profile folder alongside other configuration files. This ensures all profile-related assets are centrally located.

Hooks also support:
- Absolute paths (`/usr/local/bin/script.sh`)
- Home directory expansion (`~/scripts/hook.sh`)
- Relative paths (resolved from current directory)

When creating profiles with `kontext profile new`, you can choose to automatically create template hook scripts that are stored in the profile directory.

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