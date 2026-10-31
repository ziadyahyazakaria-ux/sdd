/*
# Add F-Droid app metadata fields

## Summary
Adds the metadata fields that F-Droid's app listings commonly show (author, links, donation, anti-features, screenshots, feature graphic). Existing rows are kept unchanged.

## Modified Table: fdroid_apps
- `author_name` (text) - developer or author name
- `website_url` (text) - project homepage
- `issue_tracker_url` (text) - where users report bugs
- `changelog_url` (text) - link to a full changelog
- `donate_url` (text) - donation page
- `feature_graphic_url` (text) - wide banner image
- `anti_features` (text[]) - anti-feature labels such as NonFreeNet or Tracking
- `screenshots` (text[]) - screenshot image URLs

## Security
- No new tables. Existing RLS policies and grants on fdroid_apps already cover new columns.

## Notes
1. Columns are added only with IF NOT EXISTS, so re-running is safe.
2. No data is removed or changed.
*/

ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS author_name text NOT NULL DEFAULT '';
ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS website_url text NOT NULL DEFAULT '';
ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS issue_tracker_url text NOT NULL DEFAULT '';
ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS changelog_url text NOT NULL DEFAULT '';
ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS donate_url text NOT NULL DEFAULT '';
ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS feature_graphic_url text NOT NULL DEFAULT '';
ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS anti_features text[] NOT NULL DEFAULT '{}';
ALTER TABLE fdroid_apps ADD COLUMN IF NOT EXISTS screenshots text[] NOT NULL DEFAULT '{}';
