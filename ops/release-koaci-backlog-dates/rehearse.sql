-- Build #201: KOACI (feed 7292) went live as an HTML crawl in Build #200. Its pages carry no machine-readable date, so
-- the first runs (20:57-21:26 UTC, 11-08) dated every article at fetch time. 47 of the 58 rows are older (URL dates
-- 10-26 to 11-07) and showed as tonight's news. This sets each to its URL date at 12:00 UTC (KOACI is in Abidjan,
-- UTC+0; the URL has no time of day). Rows dated 11-08 by URL keep their fetch time. Only published_at changes.
-- Owner: "correct the 11 dates" (the count grew to 47 as later runs pulled in older links). Get-ChangeRisk HIGH.
-- rehearse.sql is this file with ROLLBACK; reverse.sql restores the original published_at values.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
CREATE TEMP TABLE b201 (id bigint PRIMARY KEY, new_published_at timestamptz NOT NULL) ON COMMIT DROP;
INSERT INTO b201 VALUES
  (268561578, '2026-11-07 12:00:00+00'),
  (268561586, '2026-11-06 12:00:00+00'),
  (268561587, '2026-11-07 12:00:00+00'),
  (268561588, '2026-11-07 12:00:00+00'),
  (268561589, '2026-11-07 12:00:00+00'),
  (268561590, '2026-11-07 12:00:00+00'),
  (268561591, '2026-11-06 12:00:00+00'),
  (268561592, '2026-11-04 12:00:00+00'),
  (268561594, '2026-11-06 12:00:00+00'),
  (268561595, '2026-11-03 12:00:00+00'),
  (268561991, '2026-11-02 12:00:00+00'),
  (268561992, '2026-11-07 12:00:00+00'),
  (268561993, '2026-11-07 12:00:00+00'),
  (268561994, '2026-11-07 12:00:00+00'),
  (268561995, '2026-11-07 12:00:00+00'),
  (268561996, '2026-11-06 12:00:00+00'),
  (268561997, '2026-11-06 12:00:00+00'),
  (268561998, '2026-11-06 12:00:00+00'),
  (268561999, '2026-11-06 12:00:00+00'),
  (268562000, '2026-11-06 12:00:00+00'),
  (268562001, '2026-11-06 12:00:00+00'),
  (268562002, '2026-11-06 12:00:00+00'),
  (268562003, '2026-11-06 12:00:00+00'),
  (268562004, '2026-11-06 12:00:00+00'),
  (268562005, '2026-10-29 12:00:00+00'),
  (268562006, '2026-10-26 12:00:00+00'),
  (268562007, '2026-10-26 12:00:00+00'),
  (268562008, '2026-10-29 12:00:00+00'),
  (268562009, '2026-10-26 12:00:00+00'),
  (268562010, '2026-10-28 12:00:00+00'),
  (268562364, '2026-10-28 12:00:00+00'),
  (268562365, '2026-11-06 12:00:00+00'),
  (268562366, '2026-11-06 12:00:00+00'),
  (268562367, '2026-11-06 12:00:00+00'),
  (268562368, '2026-11-06 12:00:00+00'),
  (268562369, '2026-11-06 12:00:00+00'),
  (268562370, '2026-11-06 12:00:00+00'),
  (268562371, '2026-11-06 12:00:00+00'),
  (268562372, '2026-11-06 12:00:00+00'),
  (268562373, '2026-11-06 12:00:00+00'),
  (268562374, '2026-11-06 12:00:00+00'),
  (268562375, '2026-11-06 12:00:00+00'),
  (268562376, '2026-11-06 12:00:00+00'),
  (268562377, '2026-11-06 12:00:00+00'),
  (268562378, '2026-11-06 12:00:00+00'),
  (268562379, '2026-11-06 12:00:00+00'),
  (268562380, '2026-11-06 12:00:00+00');
\echo ===STATE-BEFORE===
SELECT count(*) AS rows, min(a.published_at), max(a.published_at) FROM articles a JOIN b201 USING (id);
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM articles a JOIN b201 b USING (id)
   WHERE a.feed_id = 7292 AND a.published_at::date = DATE '2026-11-08'
     AND to_date(substring(a.original_url from '/article/(\d{4}/\d{2}/\d{2})/'), 'YYYY/MM/DD') = b.new_published_at::date;
  IF n <> 47 THEN
    RAISE EXCEPTION 'Expected 47 KOACI rows still dated 11-08 with matching URL dates, found % - nothing changed', n;
  END IF;
END $do$;
UPDATE articles a SET published_at = b.new_published_at FROM b201 b WHERE a.id = b.id AND a.feed_id = 7292;
\echo ===AFTER===
SELECT a.published_at::date AS day, count(*) FROM articles a WHERE a.feed_id = 7292 GROUP BY 1 ORDER BY 1;
ROLLBACK;
