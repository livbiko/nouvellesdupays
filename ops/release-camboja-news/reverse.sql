-- Reverses the CamboJA News addition (all tables with a FK to publishers, children first).
\set ON_ERROR_STOP on
BEGIN;
DO $do$
DECLARE pid integer;
BEGIN
  SELECT id INTO pid FROM publishers WHERE slug = 'camboja-news';
  IF pid IS NULL THEN RAISE NOTICE 'Nothing to reverse'; RETURN; END IF;
  DELETE FROM articles              WHERE publisher_id = pid;
  DELETE FROM audience_metrics      WHERE social_account_id IN (SELECT id FROM social_accounts WHERE publisher_id = pid);
  DELETE FROM social_accounts       WHERE publisher_id = pid;
  DELETE FROM youtube_videos        WHERE publisher_id = pid;
  DELETE FROM youtube_channels      WHERE publisher_id = pid;
  DELETE FROM contacts              WHERE publisher_id = pid;
  DELETE FROM discovery_mining_log  WHERE publisher_id = pid;
  UPDATE discovered_sources SET discovered_from_publisher_id = NULL WHERE discovered_from_publisher_id = pid;
  DELETE FROM source_scores         WHERE publisher_id = pid;
  DELETE FROM editorial_profiles    WHERE publisher_id = pid;
  DELETE FROM feeds                 WHERE publisher_id = pid;
  DELETE FROM publisher_submissions WHERE publisher_id = pid OR verification_detail LIKE '%[added by Claude 2026-11-02, CamboJA News]%';
  DELETE FROM publishers            WHERE id = pid;
  RAISE NOTICE 'Reversed CamboJA News (publisher %)', pid;
END $do$;
COMMIT;
