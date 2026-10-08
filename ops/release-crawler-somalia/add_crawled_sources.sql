-- SONNA (Somali National News Agency) and Garowe Online have no RSS feed:
-- onboarded as feed-less 'html' sources for the bounded, robots.txt-compliant
-- crawler (polled hourly). Garowe's template stamps a wrong <time> date, so its
-- parser_config reads the visible "Posted On DD-MM-YYYY, hh:mmAM" (Somalia time).
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE domain IN ('sonna.so', 'garoweonline.com'))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ('https://sonna.so/en', 'https://www.garoweonline.com/en')) THEN
    RAISE EXCEPTION 'SONNA or Garowe Online already exists'; END IF;
END $$;
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type)
  SELECT id, 'SONNA (Somali National News Agency)', 'https://sonna.so/en', 'sonna.so', 'active', 'en', 'NEWS_AGENCY' FROM countries WHERE iso_code = 'SO';
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type)
  SELECT id, 'Garowe Online', 'https://www.garoweonline.com/en', 'garoweonline.com', 'active', 'en', 'ONLINE_NEWS' FROM countries WHERE iso_code = 'SO';
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, allowed_domains, article_url_patterns, category_urls, parser_config)
  SELECT id, 'https://sonna.so/en', 'html', 60, ARRAY['sonna.so'], ARRAY['/en/article/*'], ARRAY[]::text[], '{}'::jsonb
    FROM publishers WHERE domain = 'sonna.so';
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, allowed_domains, article_url_patterns, category_urls, parser_config)
  SELECT id, 'https://www.garoweonline.com/en', 'html', 60, ARRAY['www.garoweonline.com', 'garoweonline.com'],
         ARRAY['/en/news/somalia/*', '/en/news/puntland/*', '/en/news/somaliland/*', '/en/editorial/*'],
         ARRAY['https://www.garoweonline.com/en/news/somalia', 'https://www.garoweonline.com/en/news/puntland', 'https://www.garoweonline.com/en/news/somaliland'],
         '{"date_after_label": "Posted On", "date_format": "DD-MM-YYYY", "utc_offset": "+03:00"}'::jsonb
    FROM publishers WHERE domain = 'garoweonline.com';
DO $$ BEGIN
  IF (SELECT count(*) FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.domain IN ('sonna.so', 'garoweonline.com') AND f.feed_type = 'html') <> 2 THEN
    RAISE EXCEPTION 'expected 2 crawled sources'; END IF;
END $$;
SELECT p.id, p.name, f.feed_type, f.crawl_frequency_minutes FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.domain IN ('sonna.so', 'garoweonline.com') ORDER BY p.id;
COMMIT;
