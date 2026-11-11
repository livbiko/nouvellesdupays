-- Build #220: turn off the 4 feeds whose robots.txt blocks the whole site for every crawler not named (our bot falls
-- under "User-agent: *" with "Disallow: /"). Owner policy 11-11: respect whole-site robots blocks for feeds. Found by
-- the 11-11 robots survey (ops/investigate-stale/robots-survey-2026-11-11.tsv), re-checked 11-11 with the worker UA.
-- Each is its publisher's only feed, so these publishers stop getting new articles; publishers stay active and their
-- stored articles stay visible. Get-ChangeRisk HIGH. rehearse.sql = this file with ROLLBACK; reverse.sql re-enables.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT f.id, f.publisher_id, f.enabled, f.feed_url, f.last_status FROM feeds f WHERE f.id IN (268, 627, 967, 1064) ORDER BY f.id;
DO $do$
BEGIN
  IF (SELECT count(*) FROM feeds WHERE enabled AND (id, publisher_id, feed_url) IN (
        (268, 268, 'https://www.namibian.com.na/feed'),
        (627, 627, 'https://www.balkaninsight.com/feed/'),
        (967, 967, 'https://world.kbs.co.kr/rss/rss_news.htm?lang=e'),
        (1064, 1064, 'https://civil.ge/feed'))) <> 4 THEN
    RAISE EXCEPTION 'guard failed (a feed moved, changed URL or is already off) - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET enabled = false WHERE id IN (268, 627, 967, 1064);
\echo ===AFTER===
SELECT id, enabled FROM feeds WHERE id IN (268, 627, 967, 1064) ORDER BY id;
ROLLBACK;
