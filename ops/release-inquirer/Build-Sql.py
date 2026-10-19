# Build #104 (data part) - Philippine Daily Inquirer as a second source for the Philippines, with profile.
# The Inquirer's feed labels Philippine time as +0000 (8 h ahead); this needs the worker option label_utc_offset_hours
# (same build, branch feat/label-utc-offset) - the feed is created with parser_config {"label_utc_offset_hours": 8}.
# Same shape as Build #103 (publisher + feed + profile in one transaction).
import json

D = '2026-10-19'
TAG = '[added by Claude 2026-10-19, Build #104 Inquirer]'


def src(url, note, category):
    return {'url': url, 'note': note, 'category': category, 'accessed_at': D}


# iso, name, homepage, feed, lang, domain, source_type, probe,
#   (ownership_type, owner, tags, historical, current, confidence, summary, sources, review)
SRC = [
    ('PH', 'Philippine Daily Inquirer', 'https://newsinfo.inquirer.net', 'https://newsinfo.inquirer.net/feed', 'en', 'inquirer.net', 'NEWSPAPER',
     'rss, 40 items, newest <1 h (Philippine time labelled +0000)',
     ('Entreprise de presse privée', 'Inquirer Interactive, Inc. ; bénéficiaire ultime la famille Prieto-Rufino via Inquirer Group (2025)',
      ['commercial_generalist'],
      "Fondé le 9 décembre 1985 par Eugenia Apóstol, Max Soliven et Betty Go-Belmonte, dans les derniers jours du régime Marcos ; souvent considéré comme le journal de référence des Philippines.",
      "Ligne décrite comme de centre gauche. Boycott publicitaire de cinq mois en 1999 sous Joseph Estrada, attribué au palais présidentiel ; en 2017, sous la pression de Rodrigo Duterte, annonce de la cession de la majorité des parts à Ramon S. Ang, alors que la famille Prieto-Rufino reste citée comme propriétaire en 2025 : à vérifier. Lectorat le plus élevé des quotidiens grand format, confiance de 68 % (Reuters Institute 2023).",
      'medium', "Fondation, propriété, conflits avec les présidents et audience documentés par Wikipédia ; le sort de la cession de 2017 est contradictoire dans la source.",
      [src('https://en.wikipedia.org/wiki/Philippine_Daily_Inquirer', 'Fondé en 1985 ; Inquirer Interactive / famille Prieto-Rufino ; boycott 1999, cession annoncée à Ramon Ang en 2017', 'reference')],
      True)),
]
N = len(SRC)


def q(s):
    return "'" + s.replace("'", "''") + "'"


def dq(s):
    assert '$$' not in s
    return f'$${s}$$'


rows = []
for (iso, n, h, f, l, d, st, note, (ot, ow, tags, hist, cur, conf, summ, sources, review)) in SRC:
    tags_sql = 'ARRAY[' + ', '.join(q(t) for t in tags) + ']::text[]'
    rows.append(f"({q(iso)}, {q(n)}, {q(h)}, {q(f)}, {q(l)}, {q(d)}, {q(st)}, {q(note)}, {dq(ot)}, {dq(ow)}, {tags_sql}, {dq(hist)}, {dq(cur)}, "
                f"{q(conf)}, {dq(summ)}, {dq(json.dumps(sources, ensure_ascii=False))}::jsonb, {'true' if review else 'false'})")
ROWS = ',\n  '.join(rows)
TAGGED = f"verification_detail LIKE '%' || {q(TAG)}"
HDR = '\\set ON_ERROR_STOP on\n'

BODY = f"""SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE src (iso text, name text, homepage text, feed text, lang text, domain text, source_type text, note text,
  ownership_type text, owner text, tags text[], historical_context text, current_context text, confidence text,
  evidence_summary text, evidence_sources jsonb, review_required boolean) ON COMMIT DROP;
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
  FOR s IN SELECT * FROM src ORDER BY iso LOOP
    SELECT id INTO cid FROM countries WHERE iso_code = s.iso;
    INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
      verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
    VALUES (s.name, s.homepage, s.feed, 'rss', cid, s.lang, true,
      'Feed checked {D}: ' || s.note || ' ' || {q(TAG)}, s.domain, 'feed', 'approved', now(), now())
    RETURNING id INTO sid;
    INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type)
    VALUES (cid, s.name, s.homepage, 'active', s.lang, s.domain, s.source_type) RETURNING id INTO pid;
    INSERT INTO feeds (publisher_id, feed_url, feed_type, parser_config) VALUES (pid, s.feed, 'rss', '{{"label_utc_offset_hours": 8}}'::jsonb);
    UPDATE publisher_submissions SET publisher_id = pid WHERE id = sid;
    INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association, historical_context,
      current_context, confidence, evidence_summary, evidence_sources, classification_date, last_reviewed, evidence_date, review_required)
    VALUES (pid, s.ownership_type, s.owner, s.tags, NULL, s.historical_context, s.current_context, s.confidence,
      s.evidence_summary, s.evidence_sources, DATE '{D}', DATE '{D}', DATE '{D}', s.review_required);
    n := n + 1;
  END LOOP;
  IF n <> {N} THEN RAISE EXCEPTION 'added %, expected {N}', n; END IF;
END $$;
SELECT 'added|' || p.id || '|' || c.iso_code || '|' || p.name || '|' || p.language || '|' || f.feed_url || '|' || f.parser_config::text || '|profile ' || array_to_string(e.classification_tags, ',')
       || '/' || e.confidence || '/review ' || e.review_required
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
  JOIN countries c ON c.id = p.country_id JOIN editorial_profiles e ON e.publisher_id = p.id WHERE s.{TAGGED} ORDER BY c.iso_code;
SELECT 'gap|' || count(*) || ' active publishers without a profile'
  FROM publishers p LEFT JOIN editorial_profiles e ON e.publisher_id = p.id WHERE p.feed_status = 'active' AND e.id IS NULL;"""

with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #104 Inquirer (data part) (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};\n")
with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Reverse of apply.sql: removes the {N} publishers with their profiles, feeds, articles and submissions (found by the tag).
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
SELECT 'future|' || count(*) FILTER (WHERE a.published_at > a.fetched_at) || ' dated after fetch|' || count(*) FILTER (WHERE a.published_at = a.fetched_at) || ' clamped to fetch time|' || count(*) || ' total' FROM articles a JOIN publisher_submissions s ON s.publisher_id = a.publisher_id WHERE s.{TAGGED};
SELECT 'ok|' || count(*) FILTER (WHERE f.last_success_at > now() - interval '30 minutes') || ' of {N}'
  FROM publisher_submissions s JOIN feeds f ON f.publisher_id = s.publisher_id WHERE s.{TAGGED};
SELECT 'sample|' || p.name || '|' || to_char(a.published_at, 'YYYY-MM-DD HH24:MI') || '|fetched ' || to_char(a.fetched_at, 'HH24:MI') || '|' || left(a.headline, 70)
  FROM articles a JOIN publishers p ON p.id = a.publisher_id
 WHERE a.id IN (SELECT max(a2.id) FROM articles a2 JOIN publisher_submissions s ON s.publisher_id = a2.publisher_id WHERE s.{TAGGED} GROUP BY a2.publisher_id);
""")
print('ok', N)
