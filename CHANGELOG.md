# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2024-08-21

### Added
- **Hooks Support**: Execute custom scripts on profile activation and deactivation
  - `on_activate` hook runs when a profile is activated
  - `on_deactivate` hook runs when a profile is deactivated
  - Hooks receive `KONTEXT_PROFILE` and `KONTEXT_HOOK_TYPE` environment variables
  - Support for absolute paths, home directory expansion, and relative paths
  - 30-second timeout protection to prevent hanging hooks
  - Graceful error handling with warnings that don't block profile switching

### Changed
- Updated profile creation wizard to include hooks configuration
- Enhanced `kontext show` command to display hooks information
- Updated profile YAML schema to support `hooks.on_activate` and `hooks.on_deactivate` fields

### Technical
- Added `HookManager` class for hook execution and validation
- Updated `EnvironmentManager` to integrate hook execution into activation/deactivation scripts
- Enhanced type definitions with `hooks` property in Profile and ProfileConfig interfaces

## [1.1.0] - 2024-08-21

### Added
- Initial release with core functionality
- Profile management with YAML configuration
- Directory-based automatic profile switching
- Git identity management
- Environment variable management
- Shell script integration
- Cross-shell support (Bash, Zsh, Fish)

### Commands
- `kontext new` - Create profiles interactively
- `kontext list` - List available profiles
- `kontext show` - Display profile details
- `kontext switch` - Manually switch profiles
- `kontext current` - Show active profile
- `kontext init` - Set up shell integration
- `kontext config` - Configuration information