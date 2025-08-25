export interface Profile {
  name: string;
  git?: {
    configPath?: string;
  };
  environment?: {
    variables?: Record<string, string>;
    scriptPath?: string;
  };
  dotfiles?: Record<string, string>;
  hooks?: {
    onActivate?: string;
    onDeactivate?: string;
  };
}

export interface ProfileConfig {
  name: string;
  git?: {
    config_path?: string;
  };
  environment?: {
    variables?: Record<string, string>;
    script_path?: string;
  };
  dotfiles?: Record<string, string>;
  hooks?: {
    on_activate?: string;
    on_deactivate?: string;
  };
}

export interface KontextConfig {
  profilesPath: string;
  currentProfile?: string;
}