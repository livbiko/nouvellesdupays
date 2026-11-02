-- Read-only diagnosis for the 2026-11-02 silent/failing report (no writes).
\set ON_ERROR_STOP on
SET statement_timeout = '120s';

-- 1. FM / MV: every publisher (any status), its feeds and newest dated article
SELECT 'cty|' || c.iso_code || '|' || p.id || '|' || p.name || '|' || p.feed_status || '|' ||
       coalesce(f.feed_type,'-') || '|' || coalesce(f.feed_url,'-') || '|enabled=' || coalesce(f.enabled::text,'-') ||
       '|fails=' || coalesce(f.consecutive_failures,0) || '|ok=' || coalesce(to_char(f.last_success_at,'YYYY-MM-DD HH24:MI'),'never') ||
       '|newest=' || coalesce((SELECT to_char(max(published_at),'YYYY-MM-DD') FROM articles a WHERE a.publisher_id = p.id AND published_at < now() + interval '1 day'),'none') ||
       '|30d=' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id AND published_at > now() - interval '30 days') ||
       '|err=' || coalesce(f.last_error,'')
  FROM publishers p JOIN countries c ON c.id = p.country_id
  LEFT JOIN feeds f ON f.publisher_id = p.id
 WHERE c.iso_code IN ('FM','MV')
 ORDER BY c.iso_code, p.id;

-- 2. All 37 reported publishers: full feed config + full last_error
SELECT 'pub|' || p.id || '|' || p.name || '|' || c.iso_code || '|' || p.feed_status || '|' ||
       coalesce(f.feed_type,'-') || '|' || coalesce(f.feed_url,'-') || '|fails=' || coalesce(f.consecutive_failures,0) ||
       '|ok=' || coalesce(to_char(f.last_success_at,'YYYY-MM-DD'),'never') ||
       '|cfg=' || coalesce(f.parser_config::text,'') || '|err=' || coalesce(replace(f.last_error, E'\n', ' '),'')
  FROM publishers p JOIN countries c ON c.id = p.country_id
  LEFT JOIN feeds f ON f.publisher_id = p.id
 WHERE p.id IN (523,8929,250,1063,8925,963,539,2076,211,8908,4224,1060,8997,8892,7292,525,8902,1057,
                1021,8919,583,548,990,623,597,264,167,1012,1036,989,1542,570,1561,6741,9028,985,275)
 ORDER BY p.id;

-- 3. "never" publishers: do they have ANY articles (undated, or dated in the future)?
SELECT 'never|' || p.id || '|' || p.name || '|total=' || count(a.id) ||
       '|undated=' || count(a.id) FILTER (WHERE a.published_at IS NULL) ||
       '|future=' || count(a.id) FILTER (WHERE a.published_at >= now() + interval '1 day')
  FROM publishers p LEFT JOIN articles a ON a.publisher_id = p.id
 WHERE p.id IN (8997,8892,7292,525,8902,1057)
 GROUP BY p.id, p.name ORDER BY p.id;

-- 4. Recount: active, silent (no dated article 14d), failing, stale countries (7d)
WITH last AS (
  SELECT p.id, p.country_id, a.published_at AS lp
    FROM publishers p
    LEFT JOIN LATERAL (SELECT published_at FROM articles WHERE publisher_id = p.id AND published_at IS NOT NULL
                         AND published_at < now() + interval '1 day' ORDER BY published_at DESC LIMIT 1) a ON true
   WHERE p.feed_status = 'active'),
fl AS (SELECT DISTINCT ON (publisher_id) publisher_id, consecutive_failures FROM feeds WHERE enabled
        ORDER BY publisher_id, last_success_at DESC NULLS LAST)
SELECT 'count|active=' || count(*) ||
       '|failing=' || count(*) FILTER (WHERE (lp IS NULL OR lp < now() - interval '14 days') AND coalesce(fl.consecutive_failures,0) > 0) ||
       '|silent='  || count(*) FILTER (WHERE (lp IS NULL OR lp < now() - interval '14 days') AND coalesce(fl.consecutive_failures,0) = 0)
  FROM last LEFT JOIN fl ON fl.publisher_id = last.id;

WITH pub AS (
  SELECT p.country_id, max(a.published_at) AS lp
    FROM publishers p
    LEFT JOIN LATERAL (SELECT published_at FROM articles WHERE publisher_id = p.id AND published_at IS NOT NULL
                         AND published_at < now() + interval '1 day' ORDER BY published_at DESC LIMIT 1) a ON true
   WHERE p.feed_status = 'active' GROUP BY p.country_id)
SELECT 'stale|' || c.iso_code || '|' || coalesce(to_char(lp,'YYYY-MM-DD'),'never')
  FROM pub JOIN countries c ON c.id = pub.country_id
 WHERE lp IS NULL OR lp < now() - interval '7 days'
 ORDER BY lp NULLS FIRST;

-- 5. Do any active publishers already use the MV/FM alternatives' domains (any country)?
SELECT 'dup|' || p.id || '|' || p.name || '|' || c.iso_code || '|' || p.domain || '|' || p.feed_status
  FROM publishers p JOIN countries c ON c.id = p.country_id
 WHERE p.domain ILIKE ANY (ARRAY['%atolltimes%','%corporatemaldives%','%pacificislandtimes%','%kpress%','%rnz.co.nz%','%pina.com.fj%']);

-- 6. Test the silent-report.sh error-text expression (branch fix/silent-report-error-text) on real errors
SELECT 'rx|' || publisher_id || '|' || coalesce(left(regexp_replace(regexp_replace(last_error, '^No listing page could be read: ', ''), '[|[:cntrl:]]+', ' ', 'g'), 140), '')
  FROM feeds WHERE publisher_id IN (8919, 1021, 989, 9028) AND last_error IS NOT NULL;

-- 7. CI candidates: any publisher / submission / feed on these domains or names, any status
SELECT 'ci|pub|' || p.id || '|' || p.name || '|' || c.iso_code || '|' || coalesce(p.domain,'') || '|' || p.feed_status
  FROM publishers p JOIN countries c ON c.id = p.country_id
 WHERE p.domain ILIKE ANY (ARRAY['%mehielinfo%','%artici%','%ivoirecanal%','%infochap%','%lepointsur%'])
    OR p.name ILIKE ANY (ARRAY['%mehiel%','%artici%','%canal info%','%infochap%','%point sur%']);
SELECT 'ci|feed|' || f.publisher_id || '|' || f.feed_url FROM feeds f
 WHERE f.feed_url ILIKE ANY (ARRAY['%mehielinfo%','%artici%','%ivoirecanal%','%infochap%','%lepointsur%']);
SELECT 'ci|sub|' || s.id || '|' || s.name || '|' || coalesce(s.domain,'') || '|' || s.status FROM publisher_submissions s
 WHERE s.domain ILIKE ANY (ARRAY['%mehielinfo%','%artici%','%ivoirecanal%','%infochap%','%lepointsur%']);
SELECT 'ci|count|' || count(*) FILTER (WHERE p.feed_status='active') || ' active CI publishers'
  FROM publishers p JOIN countries c ON c.id = p.country_id WHERE c.iso_code = 'CI';
