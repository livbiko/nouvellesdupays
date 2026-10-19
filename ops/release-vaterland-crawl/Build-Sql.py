# Build #101 - Liechtensteiner Vaterland (HTML crawl) for Liechtenstein (data only, MEDIUM). Generates apply.sql, rehearse.sql,
# reverse.sql, verify.sql. 2026-10-19: Liechtenstein's only active source (Liechtenstein-Journal) has published nothing since June;
# the Volksblatt closed in March 2023, leaving the Vaterland as the country's only daily. It has no RSS feed; its article URLs are
# /liechtenstein/<section>/<slug>-art-<id>. Checked locally with crawlSource (feed_type html, these settings): 265 links on 2 listing
# pages, 28 candidates, first 5 extracted with dates (2026-10-18/19) and titles. Paywalled articles end in " (Abo)": stripped with
# title_suffix (headline + teaser are public; NDP links to the original). Editorial profile included (sources: Wikipedia).
import json

D = '2026-10-19'
TAG = '[added by Claude 2026-10-19, Build #101 Vaterland crawl]'
NAME = 'Liechtensteiner Vaterland'
HOME = 'https://www.vaterland.li/'
FREQ = 30
DOMAINS = ['vaterland.li']
CATEGORY_URLS = ['https://www.vaterland.li/liechtenstein/']
PATTERNS = ['/liechtenstein/*/*-art-*']
PARSER_CONFIG = {'title_suffix': ' (Abo)'}
PROFILE = dict(
    ownership_type='Entreprise de presse privée',
    owner='Vaduzer Medienhaus AG',
    tags=['party_aligned'],
    party='Vaterländische Union (VU)',
    hist="Quotidien fondé le 1er janvier 1936, organe officiel de l'Union patriotique (Vaterländische Union). Depuis la fermeture du "
         "Liechtensteiner Volksblatt en mars 2023, seul quotidien imprimé du pays ; les abonnés du Volksblatt lui ont été transférés.",
    cur="Le journal a annoncé vouloir évoluer vers une ligne politiquement neutre, mais son éditeur, Vaduzer Medienhaus AG, reste proche de "
        "l'Union patriotique. Une partie des articles est réservée aux abonnés (« Abo ») ; titres et chapôs restent publics.",
    conf='high',
    summ="Fondation, éditeur, affiliation partisane, monopole depuis 2023 et annonce de neutralité documentés par Wikipédia ; l'évolution vers la neutralité justifie une revue.",
    sources=[{'url': 'https://en.wikipedia.org/wiki/Liechtensteiner_Vaterland',
              'note': "Fondé en 1936 ; organe officiel de l'Union patriotique ; éditeur Vaduzer Medienhaus AG, resté proche du parti ; seul quotidien depuis la fermeture du Volksblatt (mars 2023) ; intention annoncée de neutralité",
              'category': 'reference', 'accessed_at': D}],
    review=True)


def q(s):
    return "'" + s.replace("'", "''") + "'"


def dq(s):
    assert '$$' not in s
    return f'$${s}$$'


def arr(xs):
    return 'ARRAY[' + ', '.join(q(x) for x in xs) + ']::text[]'


TAGGED = f"verification_detail LIKE '%' || {q(TAG)}"
HDR = '\\set ON_ERROR_STOP on\n'
P = PROFILE
BODY = f"""SET lock_timeout = '5s';
BEGIN;
DO $do$
DECLARE li int; bad int; sid int; pid int;
BEGIN
  SELECT id INTO li FROM countries WHERE iso_code = 'LI';
  IF li IS NULL THEN RAISE EXCEPTION 'no LI country'; END IF;
  SELECT count(*) INTO bad FROM publishers p WHERE p.country_id = li
     AND (lower(p.name) = lower({q(NAME)}) OR lower(regexp_replace(regexp_replace(p.domain, '^www[.]', ''), '/+$', '')) = 'vaterland.li');
  bad := bad + (SELECT count(*) FROM feeds WHERE feed_url = {q(HOME)}) + (SELECT count(*) FROM publisher_submissions ps WHERE ps.{TAGGED});
  IF bad > 0 THEN RAISE EXCEPTION 'Vaterland already exists as a publisher, feed or earlier run - nothing changed'; END IF;
  INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
    verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
  VALUES ({q(NAME)}, {q(HOME)}, NULL, 'html', li, 'de', true,
    'Crawl checked {D}: 28 candidates on 2 listing pages, dated ' || {q(TAG)}, 'vaterland.li', 'html', 'approved', now(), now())
  RETURNING id INTO sid;
  INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type)
  VALUES (li, {q(NAME)}, {q(HOME)}, 'active', 'de', 'vaterland.li', 'NEWSPAPER') RETURNING id INTO pid;
  INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
                     allowed_domains, category_urls, article_url_patterns, parser_config)
  VALUES (pid, {q(HOME)}, 'html', {FREQ}, true, true, {arr(DOMAINS)}, {arr(CATEGORY_URLS)}, {arr(PATTERNS)}, {q(json.dumps(PARSER_CONFIG))}::jsonb);
  UPDATE publisher_submissions SET publisher_id = pid WHERE id = sid;
  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association, historical_context,
    current_context, confidence, evidence_summary, evidence_sources, classification_date, last_reviewed, evidence_date, review_required)
  VALUES (pid, {dq(P['ownership_type'])}, {dq(P['owner'])}, {arr(P['tags'])}, {dq(P['party'])}, {dq(P['hist'])}, {dq(P['cur'])}, '{P['conf']}',
    {dq(P['summ'])}, {dq(json.dumps(P['sources'], ensure_ascii=False))}::jsonb, DATE '{D}', DATE '{D}', DATE '{D}', {'true' if P['review'] else 'false'});
END $do$;
SELECT 'added|' || p.id || '|' || p.name || '|' || p.language || '|' || f.feed_type || '|' || f.crawl_frequency_minutes || '|' || f.parser_config::text
       || '|profile ' || array_to_string(e.classification_tags, ',')
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
  JOIN editorial_profiles e ON e.publisher_id = p.id WHERE s.{TAGGED};
SELECT 'coverage|LI|' || count(*) FILTER (WHERE p.feed_status = 'active') || ' active' FROM publishers p JOIN countries c ON c.id = p.country_id WHERE c.iso_code = 'LI';
SELECT 'gap|' || count(*) || ' active publishers without a profile'
  FROM publishers p LEFT JOIN editorial_profiles e ON e.publisher_id = p.id WHERE p.feed_status = 'active' AND e.id IS NULL;"""

with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #101 Vaterland crawl (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};\n")
with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Reverse of apply.sql: removes the Vaterland publisher, feed, profile, articles and submission (found by the tag).
{HDR}SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE gone ON COMMIT DROP AS SELECT s.id AS sub, s.publisher_id AS pub FROM publisher_submissions s WHERE s.{TAGGED};
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM gone; IF n <> 1 THEN RAISE EXCEPTION 'found % tagged submissions, expected 1', n; END IF; END $$;
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
    fh.write(f"""-- Read-only, after the first crawl. Generated by Build-Sql.py.
SELECT 'feed|' || p.id || '|' || p.name || '|' || f.consecutive_failures || '|' || coalesce(to_char(f.last_success_at, 'HH24:MI'), 'never')
       || '|' || coalesce(left(f.last_error, 80), '-')
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id) || ' art'
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id AND a.published_at IS NULL) || ' undated'
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id AND a.headline LIKE '%(Abo)') || ' with (Abo)'
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id WHERE s.{TAGGED};
SELECT 'ok|' || count(*) FILTER (WHERE f.last_success_at > now() - interval '40 minutes') || ' of 1'
  FROM publisher_submissions s JOIN feeds f ON f.publisher_id = s.publisher_id WHERE s.{TAGGED};
SELECT 'sample|' || to_char(a.published_at, 'YYYY-MM-DD') || '|' || a.category || '|' || left(a.headline, 80)
  FROM articles a JOIN publisher_submissions s ON s.publisher_id = a.publisher_id WHERE s.{TAGGED} ORDER BY a.id DESC LIMIT 3;
""")
print('ok')
