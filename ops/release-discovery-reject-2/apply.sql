-- Build #192 (MEDIUM): reject the 4 "check" candidates from the Build #128 review.
-- 144 and 570 duplicate publishers we already carry (521 monaco-matin has the same nicematin.com/monaco/rss feed;
-- 8949 seychelles-nation has nation.sc's articles, seychellesnation.com's feed is one dated edition a day), 727 is stale
-- since 09-08 (Nehanda Radio 278 is active), 597 is health tips, quiet since 10-28.
-- Owner: "go ahead, reject the 4 and disable the feed". The feed (521's old monacomatin.mc/rss, id 9291) turned out to be
-- disabled already -- its 322 failures predate that -- so this release only rejects. rehearse.sql is this file with ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
CREATE TEMP TABLE tgt (id int PRIMARY KEY, domain text NOT NULL, reason text NOT NULL);
INSERT INTO tgt VALUES
  (144, 'nicematin.com', 'duplicate of publisher 521 monaco-matin (same nicematin.com/monaco/rss feed)'),
  (570, 'seychellesnation.com', 'duplicate of publisher 8949 seychelles-nation; feed is one dated edition a day'),
  (727, 'nehandatv.com', 'feed stale since 2026-09-08 (sister Nehanda Radio is publisher 278)'),
  (597, 'seha24.net', 'health/beauty tips, feed quiet since 2026-10-28');
\echo ===BEFORE===
SELECT ds.id, ds.status, ds.domain, left(ds.name, 40) FROM discovered_sources ds JOIN tgt t ON t.id = ds.id ORDER BY ds.id;
SELECT 'feed', id, publisher_id, feed_url, enabled, consecutive_failures, left(last_status, 60) FROM feeds WHERE publisher_id = 521 ORDER BY id;
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM discovered_sources ds JOIN tgt t ON t.id = ds.id AND t.domain = ds.domain WHERE ds.status = 'under_review';
  IF n <> 4 THEN RAISE EXCEPTION 'Expected 4 under_review candidates with matching domains, found % - nothing changed', n; END IF;
END $do$;
UPDATE discovered_sources ds SET status = 'rejected',
    notes = 'rejected 2026-11-08: ' || t.reason || coalesce(E'\n' || nullif(ds.notes, ''), ''), updated_at = now()
  FROM tgt t WHERE ds.id = t.id;
\echo ===AFTER===
SELECT ds.id, ds.status, ds.domain, left(ds.notes, 70) FROM discovered_sources ds JOIN tgt t ON t.id = ds.id ORDER BY ds.id;
SELECT 'feed', id, publisher_id, feed_url, enabled FROM feeds WHERE publisher_id = 521 ORDER BY id;
COMMIT;
