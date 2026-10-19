# Build #97 - sources for six thin-coverage countries (data only, MEDIUM). Generates apply.sql, rehearse.sql, reverse.sql, verify.sql.
# 2026-10-19 country sweep (no dated article in 7+ days across all active publishers): Lebanon, Kuwait, Oman and Bahrain had only an
# RFI country tag (posts every few months), Uruguay only El País (bot-blocked, outreach pending), Brunei only The Scoop (slow).
# Feeds checked with the NDP user agent on 2026-10-19. Editorial profiles follow in Build #98.
# Mirrors POST /api/admin/submissions/:id/approve (feed branch) with the same conflict refusal as findPublisherConflict.
TAG = '[added by Claude 2026-10-19, Build #97 thin-coverage countries]'
# iso, name, homepage, feed, language, domain, source_type, probe note
SRC = [
    ('LB', 'Annahar', 'https://www.annahar.com', 'https://www.annahar.com/rss', 'ar', 'annahar.com', 'NEWSPAPER', 'rss, 50 items, newest <1 h'),
    ('LB', 'National News Agency (NNA)', 'https://www.nna-leb.gov.lb/en', 'https://www.nna-leb.gov.lb/en/rss', 'en', 'nna-leb.gov.lb', 'NEWS_AGENCY', 'rss, 20 items, newest <1 h'),
    ('KW', 'Times Kuwait', 'https://timeskuwait.com', 'https://timeskuwait.com/feed/', 'en', 'timeskuwait.com', 'ONLINE_NEWS', 'rss, 10 items, newest <1 h'),
    ('OM', 'Oman Observer', 'https://www.omanobserver.om', 'https://www.omanobserver.om/rssFeed/1', 'en', 'omanobserver.om', 'NEWSPAPER', 'rss, 50 items, newest 5 h'),
    ('BH', 'News of Bahrain', 'https://www.newsofbahrain.com', 'https://www.newsofbahrain.com/rss', 'en', 'newsofbahrain.com', 'ONLINE_NEWS', 'rss, 30 items, newest <1 h'),
    ('UY', 'la diaria', 'https://ladiaria.com.uy', 'https://ladiaria.com.uy/feeds/articulos/', 'es', 'ladiaria.com.uy', 'NEWSPAPER', 'rss, 103 items, newest 7 h'),
    ('UY', 'Montevideo Portal', 'https://www.montevideo.com.uy', 'https://www.montevideo.com.uy/anxml.aspx?59', 'es', 'montevideo.com.uy', 'ONLINE_NEWS', 'rss, 8 items, newest <1 h'),
    ('BN', 'The Bruneian', 'https://www.thebruneian.news', 'https://www.thebruneian.news/feed', 'en', 'thebruneian.news', 'ONLINE_NEWS', 'rss, 10 items, newest 20 h'),
]
N = len(SRC)


def q(s):
    return "'" + s.replace("'", "''") + "'"


ROWS = ',\n  '.join(f"({q(i)}, {q(n)}, {q(h)}, {q(f)}, {q(l)}, {q(d)}, {q(st)}, {q(note)})" for (i, n, h, f, l, d, st, note) in SRC)
TAGGED = f"verification_detail LIKE '%' || {q(TAG)}"
HDR = '\\set ON_ERROR_STOP on\n'

BODY = f"""SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE src (iso text, name text, homepage text, feed text, lang text, domain text, source_type text, note text) ON COMMIT DROP;
INSERT INTO src VALUES
  {ROWS};
DO $$
DECLARE bad int; n int := 0; s record; cid int; sid int; pid int;
BEGIN
  SELECT count(*) INTO bad FROM src x LEFT JOIN countries c ON c.iso_code = x.iso
   WHERE c.id IS NULL
      OR EXISTS (SELECT 1 FROM publishers p WHERE p.country_id = c.id AND (lower(p.name) = lower(x.name)
                 OR lower(regexp_replace(regexp_replace(p.domain, '^www[.]', ''), '/+$', '')) = x.domain))
      OR EXISTS (SELECT 1 FROM feeds f WHERE f.feed_url = x.feed)
      OR EXISTS (SELECT 1 FROM publisher_submissions ps WHERE ps.{TAGGED});
  IF bad > 0 THEN RAISE EXCEPTION '% of {N} already exist as a publisher, feed or earlier run (or unknown country) - nothing changed', bad; END IF;
  FOR s IN SELECT * FROM src ORDER BY iso, name LOOP
    SELECT id INTO cid FROM countries WHERE iso_code = s.iso;
    INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
      verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
    VALUES (s.name, s.homepage, s.feed, 'rss', cid, s.lang, true,
      'Feed checked 2026-10-19: ' || s.note || ' ' || {q(TAG)}, s.domain, 'feed', 'approved', now(), now())
    RETURNING id INTO sid;
    INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type)
    VALUES (cid, s.name, s.homepage, 'active', s.lang, s.domain, s.source_type) RETURNING id INTO pid;
    INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (pid, s.feed, 'rss');
    UPDATE publisher_submissions SET publisher_id = pid WHERE id = sid;
    n := n + 1;
  END LOOP;
  IF n <> {N} THEN RAISE EXCEPTION 'added %, expected {N}', n; END IF;
END $$;
SELECT 'added|' || p.id || '|' || c.iso_code || '|' || p.name || '|' || p.language || '|' || p.source_type || '|' || f.feed_url
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
  JOIN countries c ON c.id = p.country_id WHERE s.{TAGGED} ORDER BY c.iso_code, p.id;
SELECT 'coverage|' || c.iso_code || '|' || count(*) FILTER (WHERE p.feed_status = 'active') || ' active'
  FROM countries c JOIN publishers p ON p.country_id = c.id WHERE c.iso_code IN ('LB','KW','OM','BH','UY','BN') GROUP BY c.iso_code ORDER BY 1;"""

with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #97 thin-coverage countries (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};\n")
with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Reverse of apply.sql: removes the {N} publishers, their feeds, profiles, articles and submissions (found by the tag).
{HDR}SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE gone ON COMMIT DROP AS SELECT s.id AS sub, s.publisher_id AS pub FROM publisher_submissions s WHERE s.{TAGGED};
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM gone; IF n <> {N} THEN RAISE EXCEPTION 'found % tagged submissions, expected {N}', n; END IF; END $$;
DELETE FROM articles WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM feeds WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM editorial_profiles WHERE publisher_id IN (SELECT pub FROM gone);
UPDATE publisher_submissions SET publisher_id = NULL WHERE id IN (SELECT sub FROM gone);
DELETE FROM publishers WHERE id IN (SELECT pub FROM gone);
DELETE FROM publisher_submissions WHERE id IN (SELECT sub FROM gone);
COMMIT;
SELECT 'reversed|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};
""")
with open('verify.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Read-only, after the first poll. Generated by Build-Sql.py.
SELECT 'feed|' || p.id || '|' || p.name || '|' || f.consecutive_failures || '|' || coalesce(to_char(f.last_success_at, 'HH24:MI'), 'never')
       || '|' || coalesce(left(f.last_error, 60), '-')
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id) || ' art'
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id AND a.published_at IS NULL) || ' undated'
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
 WHERE s.{TAGGED} ORDER BY p.id;
SELECT 'ok|' || count(*) FILTER (WHERE f.last_success_at > now() - interval '30 minutes') || ' of {N}'
  FROM publisher_submissions s JOIN feeds f ON f.publisher_id = s.publisher_id WHERE s.{TAGGED};
SELECT 'sample|' || p.name || '|' || to_char(a.published_at, 'YYYY-MM-DD') || '|' || a.category || '|' || left(a.headline, 70)
  FROM articles a JOIN publishers p ON p.id = a.publisher_id
 WHERE a.id IN (SELECT max(a2.id) FROM articles a2 JOIN publisher_submissions s ON s.publisher_id = a2.publisher_id WHERE s.{TAGGED} GROUP BY a2.publisher_id);
""")
print('ok', N)
