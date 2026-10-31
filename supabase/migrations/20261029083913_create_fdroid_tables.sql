
/*
# Create F-Droid Repository Tables

## Summary
Creates two tables to support a private F-Droid repository builder:

1. `fdroid_config` — stores GitHub repository connection settings (owner, repo name, branch, display name, description)
2. `fdroid_apps` — stores APK app entries with metadata for each app in the repo

## New Tables

### fdroid_config
- `id` (uuid, primary key)
- `github_owner` (text) — GitHub username or organization
- `github_repo` (text) — GitHub repository name  
- `github_branch` (text) — branch to publish to, default 'gh-pages'
- `repo_name` (text) — display name for the F-Droid repo
- `repo_description` (text) — human-readable description
- `repo_icon` (text) — optional icon URL
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### fdroid_apps
- `id` (uuid, primary key)
- `config_id` (uuid, FK to fdroid_config)
- `package_name` (text) — Android package name (e.g. com.example.app)
- `name` (text) — human-readable app name
- `summary` (text) — short description
- `description` (text) — full description
- `icon_url` (text) — app icon URL
- `apk_url` (text) — direct download URL for the APK
- `version_name` (text) — version string (e.g. 1.0.0)
- `version_code` (int) — integer version code
- `min_sdk` (int) — minimum Android SDK version
- `categories` (text[]) — app categories
- `license` (text) — SPDX license identifier
- `source_url` (text) — source code URL
- `changelog` (text) — what's new in this version
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Security
- RLS enabled on both tables
- Grants to anon + authenticated (single-tenant, no sign-in required)
- Full CRUD allowed for all visitors (shared tool)
*/

CREATE TABLE IF NOT EXISTS fdroid_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_owner text NOT NULL DEFAULT '',
  github_repo text NOT NULL DEFAULT '',
  github_branch text NOT NULL DEFAULT 'gh-pages',
  repo_name text NOT NULL DEFAULT '',
  repo_description text NOT NULL DEFAULT '',
  repo_icon text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fdroid_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES fdroid_config(id) ON DELETE CASCADE,
  package_name text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  icon_url text NOT NULL DEFAULT '',
  apk_url text NOT NULL DEFAULT '',
  version_name text NOT NULL DEFAULT '',
  version_code integer NOT NULL DEFAULT 1,
  min_sdk integer NOT NULL DEFAULT 21,
  categories text[] NOT NULL DEFAULT '{}',
  license text NOT NULL DEFAULT 'Unknown',
  source_url text NOT NULL DEFAULT '',
  changelog text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fdroid_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fdroid_apps ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON fdroid_config TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fdroid_apps TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_fdroid_config" ON fdroid_config;
CREATE POLICY "anon_select_fdroid_config" ON fdroid_config FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fdroid_config" ON fdroid_config;
CREATE POLICY "anon_insert_fdroid_config" ON fdroid_config FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fdroid_config" ON fdroid_config;
CREATE POLICY "anon_update_fdroid_config" ON fdroid_config FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fdroid_config" ON fdroid_config;
CREATE POLICY "anon_delete_fdroid_config" ON fdroid_config FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_fdroid_apps" ON fdroid_apps;
CREATE POLICY "anon_select_fdroid_apps" ON fdroid_apps FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fdroid_apps" ON fdroid_apps;
CREATE POLICY "anon_insert_fdroid_apps" ON fdroid_apps FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fdroid_apps" ON fdroid_apps;
CREATE POLICY "anon_update_fdroid_apps" ON fdroid_apps FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fdroid_apps" ON fdroid_apps;
CREATE POLICY "anon_delete_fdroid_apps" ON fdroid_apps FOR DELETE
TO anon, authenticated USING (true);
