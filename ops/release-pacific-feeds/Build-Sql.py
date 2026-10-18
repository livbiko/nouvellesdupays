# Build #93 - Pacific feeds (data only, MEDIUM). Generates apply.sql, rehearse.sql (same body, ROLLBACK), reverse.sql, verify.sql.
# Found 2026-10-18 by the weekly silent report preview:
#  - PINA (pina.com.fj) turned public feeds off: every feed answers one placeholder item "No Feed Access". Its 7 per-country
#    publishers stored exactly that placeholder as their only "article" (2026-07-26) and nothing since.
#  - Asia Pacific Report (asiapacificreport.nz) tag feeds are frozen (Samoa newest 2025-05, Vanuatu 2017-05) while its
#    category feeds are live.
# Change: delete the 7 placeholder rows; PINA publishers -> unavailable + feeds disabled; 3 APR feeds -> category feeds;
# add APR category publishers for the 5 countries where PINA was the only active source, and Island Times for Palau.
# New publishers mirror POST /api/admin/submissions/:id/approve (feed branch), with the same conflict refusal.
TAG = '[added by Claude 2026-10-18, Build #93 Pacific feeds]'
PINA = [2069, 2074, 2075, 2077, 2079, 2080, 2081]
JUNK = [659188, 659199, 660947, 661167, 661176, 663833, 663646]
APR = 'https://asiapacificreport.nz/category/pacific/{}/feed/'
# publisher id, old feed url, new feed url
REPOINT = [
    (2070, 'https://asiapacificreport.nz/tag/vanuatu/feed/', APR.format('vanuatu')),
    (2072, 'https://asiapacificreport.nz/tag/samoa/feed/', APR.format('samoa')),
    (2076, 'https://asiapacificreport.nz/tag/micronesia/feed/', APR.format('federated-states-of-micronesia')),
]
# iso, name, homepage, feed, domain, source_type, probe note (fetched with the NDP user agent, 2026-10-18)
SRC = [
    ('SB', 'Asia Pacific Report: Solomon Islands', 'https://asiapacificreport.nz', APR.format('solomon-islands'), 'asiapacificreport.nz', 'ONLINE_NEWS', 'rss, 50 items, newest 6 d, 18 in 90 d'),
    ('TV', 'Asia Pacific Report: Tuvalu', 'https://asiapacificreport.nz', APR.format('tuvalu'), 'asiapacificreport.nz', 'ONLINE_NEWS', 'rss, 50 items, newest 11 d, 4 in 90 d'),
    ('MH', 'Asia Pacific Report: Marshall Islands', 'https://asiapacificreport.nz', APR.format('marshall-islands'), 'asiapacificreport.nz', 'ONLINE_NEWS', 'rss, 50 items, newest 19 d, 3 in 90 d'),
    ('KI', 'Asia Pacific Report: Kiribati', 'https://asiapacificreport.nz', APR.format('kiribati'), 'asiapacificreport.nz', 'ONLINE_NEWS', 'rss, 50 items, newest 37 d, 4 in 90 d'),
    ('NR', 'Asia Pacific Report: Nauru', 'https://asiapacificreport.nz', APR.format('nauru'), 'asiapacificreport.nz', 'ONLINE_NEWS', 'rss, 50 items, newest 37 d, 9 in 90 d'),
    ('PW', 'Island Times', 'https://islandtimes.org', 'https://islandtimes.org/feed/', 'islandtimes.org', 'NEWSPAPER', 'rss, 20 items, newest 2026-10-16'),
]
N = len(SRC)


def q(s):
    return "'" + s.replace("'", "''") + "'"


def arr(xs):
    return 'ARRAY[' + ','.join(str(x) for x in xs) + ']'


ROWS = ',\n  '.join(f"({q(i)}, {q(n)}, {q(h)}, {q(f)}, {q(d)}, {q(st)}, {q(note)})" for (i, n, h, f, d, st, note) in SRC)
REP = ',\n  '.join(f"({p}, {q(o)}, {q(nw)})" for (p, o, nw) in REPOINT)
TAGGED = f"verification_detail LIKE '%' || {q(TAG)}"
HDR = '\\set ON_ERROR_STOP on\n'

BODY = f"""SET lock_timeout = '5s';
SET statement_timeout = '120s';
BEGIN;
CREATE TEMP TABLE src (iso text, name text, homepage text, feed text, domain text, source_type text, note text) ON COMMIT DROP;
INSERT INTO src VALUES
  {ROWS};
CREATE TEMP TABLE rep (pub int, old_url text, new_url text) ON COMMIT DROP;
INSERT INTO rep VALUES
  {REP};
DO $$
DECLARE n int; bad int; s record; cid int; sid int; pid int;
BEGIN
  -- 1. the 7 placeholder rows: only if each is still exactly the PINA "No Feed Access" item
  DELETE FROM articles WHERE id = ANY({arr(JUNK)}) AND headline = 'No Feed Access' AND publisher_id = ANY({arr(PINA)});
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(JUNK)} THEN RAISE EXCEPTION 'deleted % placeholder rows, expected {len(JUNK)}', n; END IF;

  -- 2. PINA publishers off (their feeds only ever return the placeholder)
  UPDATE publishers SET feed_status = 'unavailable' WHERE id = ANY({arr(PINA)}) AND feed_status = 'active';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(PINA)} THEN RAISE EXCEPTION 'PINA: % publishers set unavailable, expected {len(PINA)}', n; END IF;
  UPDATE feeds SET enabled = false WHERE publisher_id = ANY({arr(PINA)}) AND enabled;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(PINA)} THEN RAISE EXCEPTION 'PINA: % feeds disabled, expected {len(PINA)}', n; END IF;

  -- 3. Asia Pacific Report tag feeds -> live category feeds (reset failure state so the new URL is polled at once)
  UPDATE feeds f SET feed_url = r.new_url, consecutive_failures = 0, last_error = NULL
    FROM rep r WHERE f.publisher_id = r.pub AND f.feed_url = r.old_url;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(REPOINT)} THEN RAISE EXCEPTION 'repointed % APR feeds, expected {len(REPOINT)}', n; END IF;

  -- 4. new publishers (same refusal as findPublisherConflict, plus an earlier run of this script)
  SELECT count(*) INTO bad FROM src x JOIN countries c ON c.iso_code = x.iso
   WHERE EXISTS (SELECT 1 FROM publishers p WHERE p.country_id = c.id AND (lower(p.name) = lower(x.name)
                 OR lower(regexp_replace(regexp_replace(p.domain, '^www[.]', ''), '/+$', '')) = x.domain))
      OR EXISTS (SELECT 1 FROM feeds f WHERE f.feed_url = x.feed)
      OR EXISTS (SELECT 1 FROM publisher_submissions ps WHERE ps.{TAGGED});
  IF bad > 0 THEN RAISE EXCEPTION '% of {N} already exist as a publisher, feed or earlier run - nothing changed', bad; END IF;
  n := 0;
  FOR s IN SELECT * FROM src ORDER BY iso LOOP
    SELECT id INTO cid FROM countries WHERE iso_code = s.iso;
    IF cid IS NULL THEN RAISE EXCEPTION 'no country %', s.iso; END IF;
    INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
      verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
    VALUES (s.name, s.homepage, s.feed, 'rss', cid, 'en', true,
      'Feed checked 2026-10-18: ' || s.note || ' ' || {q(TAG)}, s.domain, 'feed', 'approved', now(), now())
    RETURNING id INTO sid;
    INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type)
    VALUES (cid, s.name, s.homepage, 'active', 'en', s.domain, s.source_type) RETURNING id INTO pid;
    INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (pid, s.feed, 'rss');
    UPDATE publisher_submissions SET publisher_id = pid WHERE id = sid;
    n := n + 1;
  END LOOP;
  IF n <> {N} THEN RAISE EXCEPTION 'added %, expected {N}', n; END IF;
END $$;
SELECT 'added|' || p.id || '|' || c.iso_code || '|' || p.name || '|' || p.feed_status || '|' || f.feed_url
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
  JOIN countries c ON c.id = p.country_id WHERE s.{TAGGED} ORDER BY c.iso_code;
SELECT 'repointed|' || f.publisher_id || '|' || f.feed_url FROM feeds f WHERE f.publisher_id IN ({','.join(str(p) for p, _, _ in REPOINT)}) ORDER BY 1;
SELECT 'coverage|' || c.iso_code || '|' || count(*) FILTER (WHERE p.feed_status = 'active') || ' active'
  FROM countries c JOIN publishers p ON p.country_id = c.id
 WHERE c.iso_code IN ('SB','KI','FM','PW','MH','NR','TV','WS','VU') GROUP BY c.iso_code ORDER BY 1;"""

with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #93 Pacific feeds (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')

with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};\n")

with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Reverse of apply.sql, except the 7 deleted placeholder rows (junk; they are in the recovery point's DB backup).
-- Removes the 6 new publishers (with their feeds and articles), puts the APR tag feeds back, re-enables PINA. Generated by Build-Sql.py.
{HDR}SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE gone ON COMMIT DROP AS
  SELECT s.id AS sub, s.publisher_id AS pub FROM publisher_submissions s WHERE s.{TAGGED};
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM gone; IF n <> {N} THEN RAISE EXCEPTION 'found % tagged submissions, expected {N}', n; END IF; END $$;
SELECT 'articles|' || count(*) FROM articles WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM articles WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM feeds WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM editorial_profiles WHERE publisher_id IN (SELECT pub FROM gone);
UPDATE publisher_submissions SET publisher_id = NULL WHERE id IN (SELECT sub FROM gone);
DELETE FROM publishers WHERE id IN (SELECT pub FROM gone);
DELETE FROM publisher_submissions WHERE id IN (SELECT sub FROM gone);
""" + ''.join(f"UPDATE feeds SET feed_url = {q(o)} WHERE publisher_id = {p} AND feed_url = {q(nw)};\n" for p, o, nw in REPOINT) + f"""UPDATE feeds SET enabled = true WHERE publisher_id = ANY({arr(PINA)});
UPDATE publishers SET feed_status = 'active' WHERE id = ANY({arr(PINA)});
COMMIT;
SELECT 'reversed|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};
""")

with open('verify.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Read-only, after the first poll. Generated by Build-Sql.py.
SELECT 'feed|' || p.id || '|' || p.name || '|' || f.enabled || '|' || f.consecutive_failures || '|' || coalesce(to_char(f.last_success_at, 'HH24:MI'), 'never')
       || '|' || coalesce(left(f.last_error, 60), '-')
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id) || ' art'
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id AND a.published_at IS NULL) || ' undated'
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id
 WHERE p.id IN ({','.join(str(p) for p, _, _ in REPOINT)})
    OR p.id IN (SELECT publisher_id FROM publisher_submissions s WHERE s.{TAGGED}) ORDER BY p.id;
SELECT 'ok|' || count(*) FILTER (WHERE f.last_success_at > now() - interval '30 minutes') || ' of {N + len(REPOINT)}'
  FROM feeds f WHERE f.publisher_id IN ({','.join(str(p) for p, _, _ in REPOINT)})
    OR f.publisher_id IN (SELECT publisher_id FROM publisher_submissions s WHERE s.{TAGGED});
SELECT 'placeholder|' || count(*) FROM articles WHERE id = ANY({arr(JUNK)});
SELECT 'sample|' || p.name || '|' || to_char(a.published_at, 'YYYY-MM-DD') || '|' || left(a.headline, 70)
  FROM articles a JOIN publishers p ON p.id = a.publisher_id
 WHERE a.id IN (SELECT max(a2.id) FROM articles a2 WHERE a2.publisher_id IN ({','.join(str(p) for p, _, _ in REPOINT)})
                   OR a2.publisher_id IN (SELECT publisher_id FROM publisher_submissions s WHERE s.{TAGGED})
                GROUP BY a2.publisher_id);
""")
print('ok', N)
