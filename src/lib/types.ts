export interface FdroidConfig {
  id: string;
  github_owner: string;
  github_repo: string;
  github_branch: string;
  repo_name: string;
  repo_description: string;
  repo_icon: string;
  created_at: string;
  updated_at: string;
}

export interface FdroidApp {
  id: string;
  config_id: string;
  package_name: string;
  name: string;
  summary: string;
  description: string;
  icon_url: string;
  apk_url: string;
  version_name: string;
  version_code: number;
  min_sdk: number;
  categories: string[];
  license: string;
  source_url: string;
  changelog: string;
  author_name: string;
  website_url: string;
  issue_tracker_url: string;
  changelog_url: string;
  donate_url: string;
  feature_graphic_url: string;
  anti_features: string[];
  screenshots: string[];
  created_at: string;
  updated_at: string;
}
