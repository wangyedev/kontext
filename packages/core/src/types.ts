export interface Profile {
  name: string;
  git?: {
    userName?: string;
    userEmail?: string;
  };
  environment?: {
    variables?: Record<string, string>;
    scriptPath?: string;
  };
  hooks?: {
    onActivate?: string;
    onDeactivate?: string;
  };
}

export interface ProfileConfig {
  name: string;
  git?: {
    user_name?: string;
    user_email?: string;
  };
  environment?: {
    variables?: Record<string, string>;
    script_path?: string;
  };
  hooks?: {
    on_activate?: string;
    on_deactivate?: string;
  };
}

export interface KontextConfig {
  profilesPath: string;
  currentProfile?: string;
}