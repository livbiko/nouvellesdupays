-- Reverse of apply.sql: removes the three Myanmar publishers (profiles, feeds, articles, submissions), re-activates the dormant three.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE gone ON COMMIT DROP AS SELECT s.id AS sub, s.publisher_id AS pub FROM publisher_submissions s WHERE s.verification_detail LIKE '%' || '[added by Claude 2026-10-19, Build #96 Myanmar sources]';
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM gone; IF n <> 3 THEN RAISE EXCEPTION 'found % tagged submissions, expected 3', n; END IF; END $$;
DELETE FROM articles WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM feeds WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM editorial_profiles WHERE publisher_id IN (SELECT pub FROM gone);
UPDATE publisher_submissions SET publisher_id = NULL WHERE id IN (SELECT sub FROM gone);
DELETE FROM publishers WHERE id IN (SELECT pub FROM gone);
DELETE FROM publisher_submissions WHERE id IN (SELECT sub FROM gone);
UPDATE feeds SET enabled = true WHERE publisher_id IN (992,200,308);
UPDATE publishers SET feed_status = 'active' WHERE id IN (992,200,308);
COMMIT;
SELECT 'reversed|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE verification_detail LIKE '%' || '[added by Claude 2026-10-19, Build #96 Myanmar sources]';
