import { Command } from "commander";
import {
  DirectoryScanner,
  ProfileManager,
  GitConfigManager,
  EnvironmentManager,
} from "../../../core/src";
import { detectShell } from "../utils/shell-detection";

export const hookCommand = new Command("hook").description(
  "Generate shell integration scripts"
);

hookCommand
  .command("init")
  .description("Generate shell initialization hook")
  .action(() => {
    const shellInfo = detectShell();

    // Generate shell-specific hook script
    const hookScript = generateHookScript(shellInfo.type);

    // Output the script to stdout so it can be eval'd
    console.log(hookScript);
  });

function generateHookScript(
  shellType: "bash" | "zsh" | "fish" | "unknown"
): string {
  const script = `
# Kontext shell integration
__kontext_last_dir=""
__kontext_current_profile=""

# Kontext command wrapper for seamless switch functionality
kontext() {
  if [[ "$1" == "switch" ]]; then
    local script_output
    script_output=$(command kontext "$@")
    if [[ $? -eq 0 ]]; then
      eval "$script_output"
      echo "# Profile \\"$2\\" activated"
    else
      echo "$script_output" >&2
      return 1
    fi
  else
    command kontext "$@"
  fi
}

__kontext_check_directory() {
  local current_dir="$(pwd)"
  
  # Only check if directory changed
  if [[ "$current_dir" != "$__kontext_last_dir" ]]; then
    __kontext_last_dir="$current_dir"
    
    # Find active profile for current directory
    local active_profile
    active_profile=$(kontext hook get-profile 2>/dev/null)
    
    # Check if profile changed
    if [[ "$active_profile" != "$__kontext_current_profile" ]]; then
      if [[ -n "$__kontext_current_profile" ]]; then
        # Deactivate current profile
        kontext hook deactivate "$__kontext_current_profile" 2>/dev/null
      fi
      
      if [[ -n "$active_profile" ]]; then
        # Activate new profile
        eval "$(kontext hook activate "$active_profile" 2>/dev/null)"
        __kontext_current_profile="$active_profile"
      else
        __kontext_current_profile=""
      fi
    fi
  fi
}

__kontext_prompt_info() {
  if [[ -n "$KONTEXT_CURRENT_PROFILE" ]]; then
    echo "($KONTEXT_CURRENT_PROFILE) "
  fi
}
`;

  switch (shellType) {
    case "bash":
      return (
        script +
        `
# Bash-specific integration
if [[ -z "$__kontext_hooked" ]]; then
  __kontext_hooked=1
  
  # Hook into cd command
  __kontext_original_cd=$(declare -f cd)
  cd() {
    builtin cd "$@"
    __kontext_check_directory
  }
  
  # Hook into prompt
  if [[ -z "$__kontext_original_ps1" ]]; then
    __kontext_original_ps1="$PS1"
    PS1='$(__kontext_prompt_info)'$PS1
  fi
  
  # Check on shell startup
  __kontext_check_directory
fi
`
      );

    case "zsh":
      return (
        script +
        `
# Zsh-specific integration
if [[ -z "$__kontext_hooked" ]]; then
  __kontext_hooked=1
  
  # Enable prompt substitution for function calls and hook into prompt
  setopt PROMPT_SUBST
  
  # Use chpwd hook for directory changes
  autoload -U add-zsh-hook
  add-zsh-hook chpwd __kontext_check_directory
  

  if [[ -z "$__kontext_original_ps1" ]]; then
    __kontext_original_ps1="$PS1"
    PS1='$(__kontext_prompt_info)'$PS1
  fi
  
  # Check on shell startup
  __kontext_check_directory
fi
`
      );

    case "fish":
      return `
# Fish shell integration

# Kontext command wrapper for seamless switch functionality  
function kontext
    if test "$argv[1]" = "switch"
        set -l script_output (command kontext $argv)
        if test $status -eq 0
            eval "$script_output"
            echo "# Profile \\"$argv[2]\\" activated"
        else
            echo "$script_output" >&2
            return 1
        end
    else
        command kontext $argv
    end
end

function __kontext_check_directory --on-variable PWD
    set -l current_dir (pwd)
    
    if test "$current_dir" != "$__kontext_last_dir"
        set -g __kontext_last_dir "$current_dir"
        
        set -l active_profile (kontext hook get-profile 2>/dev/null)
        
        if test "$active_profile" != "$__kontext_current_profile"
            if test -n "$__kontext_current_profile"
                kontext hook deactivate "$__kontext_current_profile" 2>/dev/null
            end
            
            if test -n "$active_profile"
                eval (kontext hook activate "$active_profile" 2>/dev/null)
                set -g __kontext_current_profile "$active_profile"
            else
                set -g __kontext_current_profile ""
            end
        end
    end
end

function __kontext_prompt_info
    if test -n "$KONTEXT_CURRENT_PROFILE"
        echo "($KONTEXT_CURRENT_PROFILE) "
    end
end

# Add to prompt
if not set -q __kontext_hooked
    set -g __kontext_hooked 1
    set -g __kontext_original_prompt (functions fish_prompt)
    
    function fish_prompt
        __kontext_prompt_info
        eval $__kontext_original_prompt
    end
    
    __kontext_check_directory
end
`;

    default:
      return (
        script +
        `
# Generic shell integration
if [[ -z "$__kontext_hooked" ]]; then
  __kontext_hooked=1
  
  # Hook into cd command (basic version)
  alias cd='__kontext_cd_wrapper'
  __kontext_cd_wrapper() {
    builtin cd "$@"
    __kontext_check_directory
  }
  
  # Check on shell startup
  __kontext_check_directory
fi
`
      );
  }
}

hookCommand
  .command("get-profile")
  .description("Get the active profile for the current directory")
  .action(async () => {
    try {
      const activeProfile = await DirectoryScanner.getActiveProfile();
      if (activeProfile) {
        console.log(activeProfile);
      }
    } catch (err) {
      // Silent failure for hook operations
      process.exit(1);
    }
  });

hookCommand
  .command("activate")
  .description("Generate activation script for a profile")
  .argument("<profile>", "Profile name to activate")
  .action(async (profileName: string) => {
    try {
      const profileManager = new ProfileManager();
      const profile = await profileManager.getProfile(profileName);

      if (!profile) {
        process.exit(1);
      }

      // Apply git configuration
      if (GitConfigManager.isGitAvailable()) {
        try {
          await GitConfigManager.applyProfile(profile);
        } catch (err) {
          // Silent failure for git config
        }
      }

      // Generate and output activation script
      const profileDir = `${profileManager.getProfilesPath()}/${profileName}`;
      const activationScript = EnvironmentManager.generateActivationScript(
        profile,
        profileDir
      );
      console.log(activationScript);
    } catch (err) {
      // Silent failure for hook operations
      process.exit(1);
    }
  });

hookCommand
  .command("deactivate")
  .description("Generate deactivation script for a profile")
  .argument("<profile>", "Profile name to deactivate")
  .action(async (profileName: string) => {
    try {
      const profileManager = new ProfileManager();
      const profile = await profileManager.getProfile(profileName);

      // Clear git configuration
      if (GitConfigManager.isGitAvailable()) {
        try {
          await GitConfigManager.clearKontextConfig();
        } catch (err) {
          // Silent failure for git config
        }
      }

      // Generate and output deactivation script
      const profileDir = `${profileManager.getProfilesPath()}/${profileName}`;
      const deactivationScript = EnvironmentManager.generateDeactivationScript(
        profile || undefined,
        profileDir
      );
      console.log(deactivationScript);
    } catch (err) {
      // Silent failure for hook operations
      process.exit(1);
    }
  });
