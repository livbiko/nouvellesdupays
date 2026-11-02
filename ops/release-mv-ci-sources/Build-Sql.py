# Generates apply.sql / rehearse.sql / reverse.sql / verify.sql / check_domains.sql for Build #125
# from the PUBS list below (one source of truth, so the scripts cannot drift apart).
# Build #125 (data only, MEDIUM, owner approved 2026-11-02): Maldives alternatives (all 3 existing MV
# sources HTTP 403 since 10-17/10-22) + two Côte d'Ivoire sources requested by the owner.
# Feeds checked 2026-11-02 with the worker's UA; robots.txt allows all four.
import json

TAG = '[added by Claude 2026-11-02, Build #125 MV+CI sources]'
DAY = '2026-11-02'

PUBS = [
    dict(iso='MV', name='Atoll Times', slug='atoll-times', domain='atolltimes.mv',
         home='https://atolltimes.mv/', feed='https://atolltimes.mv/feed', lang='en', stype='ONLINE_NEWS',
         check='rss, 50 items, newest 2026-11-02 08:14 UTC',
         own='unknown', owner='unknown (its About page calls it a sister publication of Dhauru News)',
         tags=['unknown'], conf='low',
         hist='English-language Maldivian digital news outlet; its About page describes it as a sister publication of Dhauru News, with its own reporters, photographers and editors.',
         cur='Daily coverage of Maldivian politics, economy and society in English.',
         ev='Own About page only; ownership of Atoll Times / Dhauru News not independently verified.',
         src=[('https://atolltimes.mv/about-us', 'About page: sister publication of Dhauru News', 'primary')]),
    dict(iso='MV', name='Corporate Maldives', slug='corporate-maldives', domain='corporatemaldives.com',
         home='https://corporatemaldives.com/', feed='https://corporatemaldives.com/feed/', lang='en', stype='FINANCIAL',
         check='rss, 24 items, newest 2026-11-02 12:05 UTC',
         own='commercial', owner='Orca Media Group', tags=['specialist'], conf='medium',
         hist='Business and hospitality publication founded in 2016; its About page calls it a flagship brand of Orca Media Group, a private Maldivian media, marketing and events company.',
         cur='Business, tourism, finance and corporate news for the Maldives, plus a quarterly print magazine.',
         ev='Own About page only (founded 2016, Orca Media Group); not independently verified.',
         src=[('https://corporatemaldives.com/about/', 'About page: founded 2016, flagship brand of Orca Media Group', 'primary')]),
    dict(iso='CI', name='Mehielinfo', slug='mehielinfo', domain='mehielinfo.net',
         home='https://mehielinfo.net/', feed='https://mehielinfo.net/feed/', lang='fr', stype='ONLINE_NEWS',
         check='rss, 10 items, newest 2026-10-30',
         own='unknown', owner='unknown', tags=['unknown'], conf='unknown',
         hist='Ivorian French-language news website (tagline: "Informer le monde, notre métier!").',
         cur='General Ivorian news. No About page, publisher or director of publication named on the site.',
         ev='Site checked 2026-11-02: no ownership or masthead information published.',
         src=[('https://mehielinfo.net/', 'Homepage reviewed; no About/masthead page found', 'primary')]),
    dict(iso='CI', name='Artici.info', slug='artici', domain='artici.info',
         home='https://artici.info/', feed='https://artici.info/feed/', lang='fr', stype='ONLINE_NEWS',
         check='rss, 10 items, newest 2026-10-31',
         own='unknown', owner='unknown', tags=['unknown'], conf='unknown',
         hist='Ivorian French-language news website (tagline: "L\'information à la source").',
         cur='General Ivorian news. No About page, publisher or director of publication named on the site.',
         ev='Site checked 2026-11-02: no ownership or masthead information published.',
         src=[('https://artici.info/', 'Homepage reviewed; no About/masthead page found', 'primary')]),
]

def q(s):
    return "NULL" if s is None else "'" + s.replace("'", "''") + "'"

isos = sorted({p['iso'] for p in PUBS})
slugs = ','.join(q(p['slug']) for p in PUBS)
domain_guard = '\n     OR '.join(f"(p.country_id = v_{p['iso'].lower()} AND p.domain = {q(p['domain'])})" for p in PUBS)

def body():
    out = [f"  SELECT id INTO STRICT v_{i.lower()} FROM countries WHERE iso_code = '{i}';" for i in isos]
    out += [
        f"  SELECT count(*) INTO bad FROM publishers WHERE slug IN ({slugs});",
        "  IF bad > 0 THEN RAISE EXCEPTION 'One or more slugs already exist (%) — nothing changed', bad; END IF;",
        "  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';",
        "  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;",
        # any country, with or without www: catches the BusinessNews-style duplicate the old guard missed
        "  SELECT count(*) INTO bad FROM publishers p WHERE regexp_replace(lower(p.domain), '^www\\.', '') IN ("
        + ','.join(q(p['domain']) for p in PUBS) + ");",
        "  IF bad > 0 THEN RAISE EXCEPTION '% publisher(s) already use one of these domains — run check_domains.sql', bad; END IF;",
    ]
    for p in PUBS:
        v = f"v_{p['iso'].lower()}"
        srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
        out += [
            f"\n  -- {p['iso']}: {p['name']}",
            "  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,",
            "    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)",
            f"  VALUES ({q(p['name'])},{q(p['home'])},{q(p['feed'])},'rss',{v},{q(p['lang'])},true,",
            f"    {q('Feed checked ' + DAY + ': ' + p['check'] + ' ')} || build_tag,",
            f"    {q(p['domain'])},'feed','approved',now(),now()) RETURNING id INTO v_sid;",
            "  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)",
            f"  VALUES ({v},{q(p['name'])},{q(p['home'])},'active',{q(p['lang'])},{q(p['domain'])},{q(p['stype'])},{q(p['slug'])},'organisation') RETURNING id INTO v_pid;",
            f"  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,{q(p['feed'])},'rss');",
            "  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;",
            "  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,",
            "    political_party_association,historical_context,current_context,",
            "    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)",
            f"  VALUES (v_pid,{q(p['own'])},{q(p['owner'])},ARRAY[{','.join(q(t) for t in p['tags'])}]::text[],NULL,",
            f"    {q(p['hist'])},",
            f"    {q(p['cur'])},",
            f"    {q(p['conf'])},{q(p['ev'])},",
            f"    {q(srcs)}::jsonb,",
            f"    '{DAY}','{DAY}','{DAY}',true);",
        ]
    out.append(f"  RAISE NOTICE 'Build #125: {len(PUBS)} publishers added ({' '.join(isos)})';")
    return '\n'.join(out)

decl = ' '.join(f"v_{i.lower()} integer;" for i in isos)
do_block = f"""DO $do$
DECLARE
  {decl}
  v_pid integer; v_sid integer;
  build_tag constant text := {q(TAG)};
  bad integer;
BEGIN
{body()}
END $do$;
"""
like = q('%' + TAG + '%')
head = f"-- GENERATED by Build-Sql.py — edit the list there, not this file.\n-- Build #125 (data only, MEDIUM): {len(PUBS)} publishers: " + ', '.join(f"{p['name']} ({p['iso']})" for p in PUBS) + "\n\\set ON_ERROR_STOP on\nSET lock_timeout = '5s';\n"

open('apply.sql', 'w', encoding='utf-8', newline='\n').write(head + "BEGIN;\n\n" + do_block + f"""
SELECT 'count|' || count(*) || ' publishers added' FROM publisher_submissions WHERE verification_detail LIKE {like};
SELECT 'countries|' || string_agg(DISTINCT c.iso_code, ',' ORDER BY c.iso_code) || ' covered'
  FROM publishers p JOIN countries c ON c.id = p.country_id WHERE p.slug IN ({slugs});
COMMIT;
""")
open('rehearse.sql', 'w', encoding='utf-8', newline='\n').write(head.replace('Build #125', 'REHEARSAL (ROLLBACK) Build #125', 1) + "BEGIN;\n\n" + do_block + f"""
SELECT 'added|' || count(*) || ' publishers tagged' FROM publisher_submissions WHERE verification_detail LIKE {like};
ROLLBACK;
SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE verification_detail LIKE {like};
""")
open('reverse.sql', 'w', encoding='utf-8', newline='\n').write(f"""-- GENERATED by Build-Sql.py. Reverses Build #125: removes the {len(PUBS)} publishers and everything hanging off them.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE pids integer[];
BEGIN
  SELECT array_agg(id) INTO pids FROM publishers WHERE slug IN ({slugs});
  IF pids IS NULL THEN RAISE NOTICE 'Nothing to reverse'; RETURN; END IF;
  -- every table with a FK to publishers (db/migrations, checked 2026-11-02), children first
  DELETE FROM articles              WHERE publisher_id = ANY(pids);
  DELETE FROM audience_metrics      WHERE social_account_id IN (SELECT id FROM social_accounts WHERE publisher_id = ANY(pids));
  DELETE FROM social_accounts       WHERE publisher_id = ANY(pids);
  DELETE FROM youtube_videos        WHERE publisher_id = ANY(pids);
  DELETE FROM youtube_channels      WHERE publisher_id = ANY(pids);
  DELETE FROM contacts              WHERE publisher_id = ANY(pids);
  DELETE FROM discovery_mining_log  WHERE publisher_id = ANY(pids);
  UPDATE discovered_sources SET discovered_from_publisher_id = NULL WHERE discovered_from_publisher_id = ANY(pids);
  DELETE FROM source_scores         WHERE publisher_id = ANY(pids);
  DELETE FROM editorial_profiles    WHERE publisher_id = ANY(pids);
  DELETE FROM feeds                 WHERE publisher_id = ANY(pids);
  UPDATE publisher_submissions SET publisher_id = NULL WHERE publisher_id = ANY(pids);
  DELETE FROM publisher_submissions WHERE verification_detail LIKE {like};
  DELETE FROM publishers            WHERE id = ANY(pids);
  RAISE NOTICE 'Reversed: removed % publishers', array_length(pids, 1);
END $do$;
SELECT 'reversed|' || count(*) || ' publishers remain with these slugs' FROM publishers WHERE slug IN ({slugs});
COMMIT;
""")
open('verify.sql', 'w', encoding='utf-8', newline='\n').write(f"""-- GENERATED by Build-Sql.py. Read-only checks after Build #125.
\\set ON_ERROR_STOP on
SELECT 'publisher|' || p.slug || '|' || p.feed_status || '|' || c.iso_code || '|' || p.language
  FROM publishers p JOIN countries c ON c.id = p.country_id WHERE p.slug IN ({slugs}) ORDER BY c.iso_code, p.slug;
SELECT 'feeds|' || count(*) || ' feeds' FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE p.slug IN ({slugs});
SELECT 'profiles|' || count(*) || ' editorial profiles' FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id WHERE p.slug IN ({slugs});
SELECT 'poll|' || p.slug || '|status=' || coalesce(f.last_status,'-') || '|fails=' || f.consecutive_failures || '|err=' || coalesce(f.last_error,'')
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.slug;
SELECT 'articles|' || p.slug || '|' || count(a.id) || ' total|' || count(a.id) FILTER (WHERE a.published_at IS NULL) || ' undated|'
       || count(a.id) FILTER (WHERE a.published_at > now() - interval '7 days') || ' in 7d|newest=' || coalesce(to_char(max(a.published_at),'YYYY-MM-DD HH24:MI'),'-')
  FROM publishers p LEFT JOIN articles a ON a.publisher_id = p.id WHERE p.slug IN ({slugs}) GROUP BY p.slug ORDER BY p.slug;
SELECT 'coverage|' || c.iso_code || '|' || count(p.id) FILTER (WHERE p.feed_status = 'active') || ' active'
  FROM countries c JOIN publishers p ON p.country_id = c.id WHERE c.iso_code IN ({','.join(q(i) for i in isos)}) GROUP BY c.iso_code ORDER BY c.iso_code;
""")
open('check_domains.sql', 'w', encoding='utf-8', newline='\n').write(f"""-- GENERATED by Build-Sql.py. Read-only: existing publishers on any of the Build #125 domains (any country, www-insensitive) or similar names.
SELECT p.id, p.name, c.iso_code, p.domain, p.feed_status FROM publishers p JOIN countries c ON c.id = p.country_id
 WHERE regexp_replace(lower(p.domain), '^www\\.', '') IN ({','.join(q(p['domain']) for p in PUBS)})
    OR p.name ILIKE ANY (ARRAY['%atoll%','%corporate maldives%','%mehiel%','%artici%']);
""")
print('wrote apply/rehearse/reverse/verify/check_domains for', len(PUBS), 'publishers')
