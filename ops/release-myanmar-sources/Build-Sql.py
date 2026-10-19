# Build #96 - Myanmar sources + three dormant publishers (data only, MEDIUM). Generates apply.sql, rehearse.sql, reverse.sql, verify.sql.
# 2026-10-19: the weekly silent report's quiet RSS sources were checked against their own sites (all genuinely quiet).
#  - Myanmar's only active publisher, BNI Online (992), has published nothing since Nov 2023 (feed and site) -> Myanmar shows no news.
#    Add The Irrawaddy, Myanmar Now and DVB English (feeds live, checked with the NDP user agent), with editorial profiles.
#  - LeTogolais (200, last item 2026-05-25) and Comores Actualités (308, last item 2026-07-21) are dormant; Togo keeps 4 active
#    sources, Comoros keeps Comores Infos -> both unavailable, feeds disabled.
#  - Liechtenstein-Journal (525) is also quiet but is Liechtenstein's only source (Volksblatt closed, Vaterland has no feed): kept.
# One transaction, mirrors POST /api/admin/submissions/:id/approve (feed branch) with the same conflict refusal, plus profiles.
import json

D = '2026-10-19'
TAG = '[added by Claude 2026-10-19, Build #96 Myanmar sources]'
DORMANT = [992, 200, 308]


def src(url, note, category):
    return {'url': url, 'note': note, 'category': category, 'accessed_at': D}


# name, homepage, feed, domain, probe note, profile: (ownership_type, owner, historical, current, summary, sources)
SRC = [
    ('The Irrawaddy', 'https://www.irrawaddy.com', 'https://www.irrawaddy.com/feed', 'irrawaddy.com', 'rss, 10 items, newest 2026-10-16',
     ('Média privé indépendant (Irrawaddy Publishing Group)', 'Irrawaddy Publishing Group ; fondé et dirigé par Aung Zaw',
      "Fondé en 1990 à Bangkok par Aung Zaw, ancien militant étudiant de l'université de Rangoun exilé après la répression de 1988 ; "
      "installé à Chiang Mai, puis rédaction à Rangoun après les réformes de 2012. Soutenu à l'origine par des donateurs internationaux "
      "(National Endowment for Democracy, Open Society Foundations).",
      "Licence révoquée par la junte en octobre 2022 ; continue de publier en anglais et en birman depuis l'exil. Média indépendant, critique du régime militaire.",
      'Fondation, financement et interdiction documentés par Wikipédia (sources de presse citées).',
      [src('https://en.wikipedia.org/wiki/The_Irrawaddy', 'Fondé en 1990 par Aung Zaw ; Irrawaddy Publishing Group ; donateurs NED et OSF ; licence révoquée en octobre 2022', 'reference')])),
    ('Myanmar Now', 'https://myanmar-now.org/en', 'https://myanmar-now.org/en/feed/', 'myanmar-now.org', 'rss, 10 items, newest 2026-10-16',
     ('Agence de presse indépendante', 'Rédaction indépendante dirigée par Swe Win (rédacteur en chef)',
      "Agence de presse fondée en août 2015 avec le soutien de la Thomson Reuters Foundation ; contenus diffusés gratuitement à plus de 50 médias.",
      "Locaux perquisitionnés par l'armée le 8 mars 2021 et licence révoquée par la junte ; poursuit un journalisme d'investigation indépendant, primé en 2023.",
      'Fondation, direction et interdiction documentées par Wikipédia (sources de presse citées).',
      [src('https://en.wikipedia.org/wiki/Myanmar_Now', 'Fondé en 2015 avec la Thomson Reuters Foundation ; rédacteur en chef Swe Win ; perquisition et licence révoquée en mars 2021', 'reference')])),
    ('DVB English', 'https://english.dvb.no', 'https://english.dvb.no/feed/', 'english.dvb.no', 'rss, 10 items, newest 2026-10-19',
     ('Organisation de médias à but non lucratif', 'DVB Multimedia Group (Democratic Voice of Burma) ; directeur exécutif et rédacteur en chef Aye Chan Naing',
      "Democratic Voice of Burma, fondée en juillet 1992 à Oslo et Chiang Mai par des expatriés birmans pour diffuser une information non censurée ; "
      "télévision lancée en 2005 avec l'aide d'ONG (Free Voice, National Endowment for Democracy, Freedom of Expression Foundation).",
      "Interdite par la junte le 8 mars 2021 avec quatre autres médias, licences révoquées ; opère de nouveau dans la clandestinité et depuis l'étranger. Service en anglais sur english.dvb.no.",
      'Fondation, structure et interdiction documentées par Wikipédia (sources citées).',
      [src('https://en.wikipedia.org/wiki/Democratic_Voice_of_Burma', 'Fondée en 1992 (Oslo, Chiang Mai) ; organisation à but non lucratif DVB Multimedia Group ; interdite le 8 mars 2021', 'reference')])),
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
DIDS = ','.join(str(x) for x in DORMANT)
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
  -- 1. dormant publishers off
  UPDATE publishers SET feed_status = 'unavailable' WHERE id IN ({DIDS}) AND feed_status = 'active';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(DORMANT)} THEN RAISE EXCEPTION 'dormant: % set unavailable, expected {len(DORMANT)}', n; END IF;
  UPDATE feeds SET enabled = false WHERE publisher_id IN ({DIDS}) AND enabled;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(DORMANT)} THEN RAISE EXCEPTION 'dormant: % feeds disabled, expected {len(DORMANT)}', n; END IF;

  -- 2. Myanmar sources (same refusal as findPublisherConflict, plus an earlier run of this script)
  SELECT id INTO mm FROM countries WHERE iso_code = 'MM';
  IF mm IS NULL THEN RAISE EXCEPTION 'no MM country'; END IF;
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
SELECT 'dormant|' || p.id || '|' || p.name || '|' || p.feed_status || '|enabled ' || bool_or(f.enabled)
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id IN ({DIDS}) GROUP BY p.id, p.name, p.feed_status ORDER BY 1;
SELECT 'coverage|' || c.iso_code || '|' || count(*) FILTER (WHERE p.feed_status = 'active') || ' active'
  FROM countries c JOIN publishers p ON p.country_id = c.id WHERE c.iso_code IN ('MM','TG','KM') GROUP BY c.iso_code ORDER BY 1;
SELECT 'gap|' || count(*) || ' active publishers without a profile'
  FROM publishers p LEFT JOIN editorial_profiles e ON e.publisher_id = p.id WHERE p.feed_status = 'active' AND e.id IS NULL;"""

with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #96 Myanmar sources + dormant publishers (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};\n")
with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Reverse of apply.sql: removes the three Myanmar publishers (profiles, feeds, articles, submissions), re-activates the dormant three.
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
UPDATE feeds SET enabled = true WHERE publisher_id IN ({DIDS});
UPDATE publishers SET feed_status = 'active' WHERE id IN ({DIDS});
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
