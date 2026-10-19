# Build #102 - The Marshall Islands Journal for the Marshall Islands (data only, MEDIUM). Generates apply.sql, rehearse.sql,
# reverse.sql, verify.sql. 2026-10-19: the Marshall Islands' only active source (APR category, Build #93) posts every few weeks;
# the Journal (weekly, the country's only newspaper) has a live RSS feed (10 items, newest 2026-10-15; served Brotli-compressed,
# which the worker's fetch decodes). Publisher + feed + editorial profile in one transaction, same shape as Build #96.
import json

D = '2026-10-19'
TAG = '[added by Claude 2026-10-19, Build #102 Marshall Islands Journal]'


def src(url, note, category):
    return {'url': url, 'note': note, 'category': category, 'accessed_at': D}


# name, homepage, feed, domain, probe note, profile: (ownership_type, owner, historical, current, summary, sources)
SRC = [
    ('The Marshall Islands Journal', 'https://marshallislandsjournal.com', 'https://marshallislandsjournal.com/feed/', 'marshallislandsjournal.com',
     'rss, 10 items, newest 2026-10-15',
     ('Hebdomadaire privé', 'Propriété privée ; rédacteur en chef Giff Johnson (depuis 1984)',
      "Fondé le 13 février 1970 sous le nom de Micronitor par Joe Murphy et Mike Malone, volontaires du Peace Corps ; devenu The Marshall Islands Journal. "
      "Seul journal du pays, bilingue anglais-marshallais, environ 2 000 exemplaires par semaine (2018).",
      "Journal indépendant, connu dès ses débuts pour ses critiques des responsables micronésiens et de l'administration américaine du Territoire sous tutelle ; "
      "suit de près les conséquences des essais nucléaires. Le Département d'État américain le cite comme une source majeure sur les Îles Marshall.",
      'Fondation, propriété, direction et indépendance documentées par Wikipédia.',
      [src('https://en.wikipedia.org/wiki/Marshall_Islands_Journal', 'Fondé en 1970 (Micronitor) ; privé ; rédacteur en chef Giff Johnson ; hebdomadaire, seul journal du pays ; indépendant', 'reference')])),
]
N = len(SRC)


def q(s):
    return "'" + s.replace("'", "''") + "'"


def dq(s):
    assert '$$' not in s
    return f'$${s}$$'


ROWS = ',\n  '.join(
    f"({q(n)}, {q(h)}, {q(f)}, {q(d)}, {q(note)}, {dq(p[0])}, {dq(p[1])}, {dq(p[2])}, {dq(p[3])}, {dq(p[4])}, {dq(json.dumps(p[5], ensure_ascii=False))}::jsonb)"
    for (n, h, f, d, note, p) in SRC)
TAGGED = f"verification_detail LIKE '%' || {q(TAG)}"
HDR = '\\set ON_ERROR_STOP on\n'

BODY = f"""SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE src (name text, homepage text, feed text, domain text, note text, ownership_type text, owner text,
  historical_context text, current_context text, evidence_summary text, evidence_sources jsonb) ON COMMIT DROP;
INSERT INTO src VALUES
  {ROWS};
DO $$
DECLARE mm int; bad int; n int; s record; sid int; pid int;
BEGIN
  -- Marshall Islands source (same refusal as findPublisherConflict, plus an earlier run of this script)
  SELECT id INTO mm FROM countries WHERE iso_code = 'MH';
  IF mm IS NULL THEN RAISE EXCEPTION 'no MH country'; END IF;
  SELECT count(*) INTO bad FROM src x
   WHERE EXISTS (SELECT 1 FROM publishers p WHERE p.country_id = mm AND (lower(p.name) = lower(x.name)
                 OR lower(regexp_replace(regexp_replace(p.domain, '^www[.]', ''), '/+$', '')) = x.domain))
      OR EXISTS (SELECT 1 FROM feeds f WHERE f.feed_url = x.feed)
      OR EXISTS (SELECT 1 FROM publisher_submissions ps WHERE ps.{TAGGED});
  IF bad > 0 THEN RAISE EXCEPTION '% of {N} already exist as a publisher, feed or earlier run - nothing changed', bad; END IF;
  n := 0;
  FOR s IN SELECT * FROM src ORDER BY name LOOP
    INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
      verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
    VALUES (s.name, s.homepage, s.feed, 'rss', mm, 'en', true,
      'Feed checked {D}: ' || s.note || ' ' || {q(TAG)}, s.domain, 'feed', 'approved', now(), now())
    RETURNING id INTO sid;
    INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type)
    VALUES (mm, s.name, s.homepage, 'active', 'en', s.domain, 'ONLINE_NEWS') RETURNING id INTO pid;
    INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (pid, s.feed, 'rss');
    UPDATE publisher_submissions SET publisher_id = pid WHERE id = sid;
    INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association, historical_context,
      current_context, confidence, evidence_summary, evidence_sources, classification_date, last_reviewed, evidence_date, review_required)
    VALUES (pid, s.ownership_type, s.owner, ARRAY['independent']::text[], NULL, s.historical_context, s.current_context, 'high',
      s.evidence_summary, s.evidence_sources, DATE '{D}', DATE '{D}', DATE '{D}', false);
    n := n + 1;
  END LOOP;
  IF n <> {N} THEN RAISE EXCEPTION 'added %, expected {N}', n; END IF;
END $$;
SELECT 'added|' || p.id || '|' || p.name || '|' || p.feed_status || '|' || f.feed_url || '|profile ' || array_to_string(e.classification_tags, ',')
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
  JOIN editorial_profiles e ON e.publisher_id = p.id WHERE s.{TAGGED} ORDER BY p.id;
SELECT 'coverage|' || c.iso_code || '|' || count(*) FILTER (WHERE p.feed_status = 'active') || ' active'
  FROM countries c JOIN publishers p ON p.country_id = c.id WHERE c.iso_code = 'MH' GROUP BY c.iso_code ORDER BY 1;
SELECT 'gap|' || count(*) || ' active publishers without a profile'
  FROM publishers p LEFT JOIN editorial_profiles e ON e.publisher_id = p.id WHERE p.feed_status = 'active' AND e.id IS NULL;"""

with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #102 Marshall Islands Journal (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};\n")
with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Reverse of apply.sql: removes the Journal (profile, feed, articles, submission).
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
SELECT 'sample|' || p.name || '|' || to_char(a.published_at, 'YYYY-MM-DD') || '|' || left(a.headline, 70)
  FROM articles a JOIN publishers p ON p.id = a.publisher_id
 WHERE a.id IN (SELECT max(a2.id) FROM articles a2 JOIN publisher_submissions s ON s.publisher_id = a2.publisher_id WHERE s.{TAGGED} GROUP BY a2.publisher_id);
""")
print('ok', N)
