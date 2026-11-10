-- Build #210b: disable 8 stale duplicate feeds. The 11-10 survey of active feeds that run ok but stored nothing in
-- 7 days listed them; each publisher already has a working primary feed (7-day articles): NHK 60 (295), Radio Okapi
-- 230 (134), El Pais 531 (1,098), ABC 532 (851), Corriere 536 (1,088), UDN 974 (7,418), The News Intl 1007 (616),
-- The Business Standard 1011 (852). The duplicates point at frozen legacy feeds (newest items 2020-2026-09) or, for
-- UDN, a feed whose items are all dated 1970. Build #210 (re-pointing them) was dropped: the new URLs are the primaries.
-- Owner: "approve Build #210b". Get-ChangeRisk MEDIUM. rehearse.sql = this file with ROLLBACK; reverse.sql re-enables.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
CREATE TEMP TABLE b210 (dup int PRIMARY KEY, primary_feed int NOT NULL, dup_url text NOT NULL) ON COMMIT DROP;
INSERT INTO b210 VALUES
  (9114,   60, 'https://www3.nhk.or.jp/rss/news/cat0.xml'),
  (9190,  230, 'https://www.radiookapi.net/rss.xml'),
  (9301,  531, 'https://www.elpais.com/rss/elpais/portada.xml'),
  (9302,  532, 'https://www.abc.es/rss/feeds/abcPortada.xml'),
  (9306,  536, 'https://www.corriere.it/rss/homepage.xml'),
  (9418,  974, 'https://udn.com/rssfeed/news/2/6638?ch=news'),
  (9451, 1007, 'https://www.thenews.com.pk/rss/1/1'),
  (9455, 1011, 'https://tbsnews.net/rss.xml');
\echo ===STATE-BEFORE===
SELECT b.dup, d.enabled, b.primary_feed, p.enabled AS primary_enabled,
       (SELECT count(*) FROM articles a WHERE a.publisher_id = p.publisher_id AND a.feed_id = p.id AND a.published_at > now() - interval '7 days') AS primary_7d
FROM b210 b JOIN feeds d ON d.id = b.dup JOIN feeds p ON p.id = b.primary_feed ORDER BY b.dup;
DO $do$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM b210 b
  LEFT JOIN feeds d ON d.id = b.dup AND d.feed_url = b.dup_url AND d.enabled
  LEFT JOIN feeds p ON p.id = b.primary_feed AND p.enabled AND p.publisher_id = d.publisher_id
  WHERE d.id IS NULL OR p.id IS NULL
     OR NOT EXISTS (SELECT 1 FROM articles a WHERE a.publisher_id = p.publisher_id AND a.feed_id = p.id AND a.published_at > now() - interval '7 days')
     OR EXISTS (SELECT 1 FROM articles a WHERE a.publisher_id = d.publisher_id AND a.feed_id = d.id AND a.published_at > now() - interval '7 days');
  IF bad <> 0 THEN
    RAISE EXCEPTION '% of 8 duplicates fail the guard (moved URL, disabled, primary not working, or duplicate active) - nothing changed', bad;
  END IF;
END $do$;
UPDATE feeds SET enabled = false WHERE id IN (SELECT dup FROM b210);
\echo ===AFTER===
SELECT id, enabled FROM feeds WHERE id IN (SELECT dup FROM b210) ORDER BY id;
COMMIT;
