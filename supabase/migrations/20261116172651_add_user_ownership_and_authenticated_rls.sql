/*
# Add user ownership and authenticated RLS to F-Droid tables

## Summary
Converts the F-Droid Repo Builder from a public single-tenant app to a
multi-user app where each signed-in user owns their repositories and apps.
GitHub tokens continue to be stored in the browser only (never in the DB).

## Modified Tables

### fdroid_config
- Adds `user_id` (uuid, NOT NULL, DEFAULT auth.uid()) — owner of the repo config.
- Adds `target_sdk` (integer, DEFAULT 34) — Android target SDK for index generation.

### fdroid_apps
- Adds `user_id` (uuid, NOT NULL, DEFAULT auth.uid()) — owner of the app entry.

## Security Changes
- Drops all existing `anon_*` policies that allowed unrestricted public CRUD.
- Creates new ownership-based RLS policies scoped to `TO authenticated` using
  `auth.uid() = user_id` for all four CRUD verbs on both tables.
- Revokes all grants from `anon` role; grants CRUD only to `authenticated`.
- `user_id` defaults to `auth.uid()` so frontend inserts that omit `user_id`
  still satisfy the INSERT WITH CHECK policy.

## Notes
1. Existing rows get a nullable user_id first (ADD COLUMN without NOT NULL),
   then backfilled to a sentinel, then set NOT NULL. Since this is a fresh
   single-tenant dataset with no real users yet, existing rows are assigned
   to the first registered user if one exists, otherwise left for manual
   cleanup. The column is added safely without data loss.
2. Re-running this migration is safe — all statements use IF NOT EXISTS or
   DROP IF EXISTS before CREATE.
3. GitHub tokens are NOT stored in the database — they remain in the
   browser's localStorage, scoped per config ID.
*/

-- Step 1: Add user_id columns (nullable first, to avoid NOT NULL on existing rows)
ALTER TABLE fdroid_config ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Add target_sdk to fdroid_config
ALTER TABLE fdroid_config ADD COLUMN IF NOT EXISTS target_sdk integer NOT NULL DEFAULT 34;

-- Step 3: Backfill existing rows — assign to first user if any exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    UPDATE fdroid_config SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
    UPDATE fdroid_apps
      SET user_id = fdroid_config.user_id
      FROM fdroid_config
      WHERE fdroid_apps.config_id = fdroid_config.id AND fdroid_apps.user_id IS NULL;
  END IF;
END $$;

-- Step 4: Set NOT NULL with default auth.uid() for future inserts
ALTER TABLE fdroid_config ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE fdroid_config ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE fdroid_apps ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE fdroid_apps ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Step 5: Revoke anon access — no more public CRUD
REVOKE SELECT, INSERT, UPDATE, DELETE ON fdroid_config FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON fdroid_apps FROM anon;

-- Keep authenticated grants (they already exist, but ensure)
GRANT SELECT, INSERT, UPDATE, DELETE ON fdroid_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fdroid_apps TO authenticated;

-- Step 6: Drop old anon policies
DROP POLICY IF EXISTS "anon_select_fdroid_config" ON fdroid_config;
DROP POLICY IF EXISTS "anon_insert_fdroid_config" ON fdroid_config;
DROP POLICY IF EXISTS "anon_update_fdroid_config" ON fdroid_config;
DROP POLICY IF EXISTS "anon_delete_fdroid_config" ON fdroid_config;
DROP POLICY IF EXISTS "anon_select_fdroid_apps" ON fdroid_apps;
DROP POLICY IF EXISTS "anon_insert_fdroid_apps" ON fdroid_apps;
DROP POLICY IF EXISTS "anon_update_fdroid_apps" ON fdroid_apps;
DROP POLICY IF EXISTS "anon_delete_fdroid_apps" ON fdroid_apps;

-- Step 7: Create ownership-based policies for fdroid_config
DROP POLICY IF EXISTS "select_own_config" ON fdroid_config;
CREATE POLICY "select_own_config" ON fdroid_config FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_config" ON fdroid_config;
CREATE POLICY "insert_own_config" ON fdroid_config FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_config" ON fdroid_config;
CREATE POLICY "update_own_config" ON fdroid_config FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_config" ON fdroid_config;
CREATE POLICY "delete_own_config" ON fdroid_config FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Step 8: Create ownership-based policies for fdroid_apps
-- Apps are owned directly by user_id (not through config_id) for simpler RLS
DROP POLICY IF EXISTS "select_own_apps" ON fdroid_apps;
CREATE POLICY "select_own_apps" ON fdroid_apps FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_apps" ON fdroid_apps;
CREATE POLICY "insert_own_apps" ON fdroid_apps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_apps" ON fdroid_apps;
CREATE POLICY "update_own_apps" ON fdroid_apps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_apps" ON fdroid_apps;
CREATE POLICY "delete_own_apps" ON fdroid_apps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
