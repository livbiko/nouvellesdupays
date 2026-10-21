-- Reversal for Build #119 Africanews. Run with .\Sql.ps1 reverse.sql (tunnel up).
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;
DO $do$
DECLARE v_pid integer;
BEGIN
  SELECT id INTO v_pid FROM publishers WHERE slug = 'africanews' AND name = 'Africanews';
  IF v_pid IS NULL THEN
    RAISE NOTICE 'Africanews not found - nothing to reverse';
    RETURN;
  END IF;
  DELETE FROM social_accounts WHERE publisher_id = v_pid;
  DELETE FROM editorial_profiles WHERE publisher_id = v_pid;
  DELETE FROM feeds WHERE publisher_id = v_pid;
  DELETE FROM publisher_submissions WHERE publisher_id = v_pid;
  DELETE FROM publishers WHERE id = v_pid;
  RAISE NOTICE 'Reversed: deleted Africanews (id=%)', v_pid;
END $do$;
COMMIT;
SELECT 'reversed|africanews gone: ' || (NOT EXISTS (SELECT 1 FROM publishers WHERE slug = 'africanews'))::text;
