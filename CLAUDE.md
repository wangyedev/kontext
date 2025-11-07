# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kontext is a CLI tool for managing development profiles and automating shell environment switching. It enables directory-based automatic profile switching with Git identity management, environment variables, dotfiles, and custom hooks.

## Build & Development Commands

### Building
```bash
pnpm install          # Install all dependencies
pnpm run build        # Build all packages (core, cli, and main)
pnpm run build:core   # Build only @kontext/core package
pnpm run build:cli    # Build only @kontext/cli package
```

### Development
```bash
pnpm run dev          # Run CLI in dev mode using tsx (no build required)
pnpm run dev:build    # Watch mode for TypeScript compilation
```

### Testing & Packaging
```bash
node dist/cli/src/index.js --version  # Test built CLI
pnpm run package      # Create standalone executables for macOS/Linux/Windows
pnpm run clean        # Clean all dist directories
```

### Local Development Testing
```bash
# Test the CLI locally without installing globally
node /Users/yewang/Desktop/code/personal/hobby/kontext/packages/cli/dist/cli/src/index.js <command>

# Or create an alias for easier testing
alias kontext-dev="node /Users/yewang/Desktop/code/personal/hobby/kontext/dist/cli/src/index.js"
```

## Architecture

### Monorepo Structure

The project uses a pnpm workspace monorepo with TypeScript path aliases:

- **`packages/core/`** - Core functionality library (`@kontext/core`)
  - Profile management (YAML parsing, validation)
  - Directory scanning (finding `.kontext-profile` files)
  - Git config management
  - Environment variable management (including .env file support)
  - Hook execution (activate/deactivate scripts)
  - Config file management

- **`packages/cli/`** - CLI interface (`@kontext/cli`)
  - Command definitions using Commander.js
  - Interactive prompts using Inquirer
  - Shell detection and integration
  - User-facing commands

- **Root** - Main package that ties everything together
  - Entry point: `dist/cli/src/index.js`
  - Published as `kontext-cli` on npm

### Key Core Components

All core components are in `packages/core/src/`:

- **`ProfileManager`** - Manages profile YAML files, CRUD operations, and validation
- **`DirectoryScanner`** - Scans directory tree upward to find `.kontext-profile` files
- **`GitConfigManager`** - Handles Git config file operations
- **`EnvironmentManager`** - Manages environment variables from three sources (precedence: shell script > direct variables > .env file)
- **`HookManager`** - Executes on_activate/on_deactivate hook scripts with timeout and error handling
- **`ConfigFileManager`** - General config file operations (read/write/validate)

### Profile Configuration

Profiles are stored in `~/.config/kontext/profiles/<profile-name>/`:
- `profile.yml` - Main configuration (snake_case keys in file, converted to camelCase in code)
- `.gitconfig` - Git configuration (optional)
- `.env` - Environment variables file (optional)
- `hooks/` - Custom activation/deactivation scripts (optional)
- Other dotfiles as configured

### Variable Naming Convention

**Important**: Profile YAML files use snake_case (e.g., `config_path`, `on_activate`), but the internal TypeScript types use camelCase (e.g., `configPath`, `onActivate`). The `ProfileManager` handles this conversion via `convertConfigToProfile()`.

### CLI Command Structure

Commands are organized in `packages/cli/src/commands/`:
- **Command groups**: `profile`, `tag` (using Commander subcommands)
- **Standalone commands**: `init`, `status`, `switch`, `config`, `hook`

Each command file exports a Commander `Command` object that's registered in `packages/cli/src/index.ts`.

### Shell Integration

The `kontext init` command generates shell hooks that:
1. Detect directory changes (via `cd` wrapper)
2. Scan for `.kontext-profile` files
3. Automatically activate profiles
4. Update shell prompt with current profile

Supported shells: Bash, Zsh, Fish

## Release Process

This project uses **Release Please** for automated versioning and publishing:

1. Use conventional commit messages:
   - `feat:` → minor version bump
   - `fix:` → patch version bump
   - `feat!:` or `BREAKING CHANGE:` → major version bump
   - `chore:`, `docs:` → no version bump

2. Release Please creates/updates a release PR on push to `main`

3. Merging the release PR triggers automatic npm publishing via GitHub Actions

**Never manually update version numbers** - Release Please handles this automatically.

## Important Implementation Notes

### Environment Variable Precedence

The `EnvironmentManager` loads variables in this order (later sources override earlier):
1. `.env` file (if `env_file` specified)
2. Direct `variables` from profile.yml
3. Shell script execution (if `script_path` specified)

### Security Considerations

- `.env` files must be within the profile directory (`~/.config/kontext/profiles/<name>/`)
- Hook scripts have a 30-second timeout
- Profile names are validated to prevent directory traversal
- Git config paths support `${KONTEXT_PROFILE_DIR}` variable expansion

### Path Resolution

All paths in profile.yml support:
- Absolute paths: `/usr/local/bin/script.sh`
- Home directory: `~/scripts/hook.sh`
- Profile directory variable: `${KONTEXT_PROFILE_DIR}/.gitconfig`
- Relative paths (resolved from current directory)

### Directory Tagging

The `.kontext-profile` file contains just the profile name as plain text. Directory scanning walks up the tree until a profile file is found, enabling subdirectories to inherit parent profiles.
