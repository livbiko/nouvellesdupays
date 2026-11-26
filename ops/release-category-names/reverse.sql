-- Reverse of migration 022 (only after the previous images are back: the new API reads the column).
ALTER TABLE creator_categories DROP COLUMN IF EXISTS names;
