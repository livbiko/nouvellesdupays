-- Reverse of apply.sql: PA Media back to active.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 6757 AND feed_status = 'suspended') THEN
    RAISE EXCEPTION 'nothing to reverse: publisher 6757 is not suspended'; END IF;
END $$;
UPDATE publishers SET feed_status = 'active' WHERE id = 6757;
COMMIT;
