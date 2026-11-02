# Generates apply.sql / rehearse.sql / reverse.sql / verify.sql for Build #128 from the PUBS list below.
# Build #128 (data only, MEDIUM, owner approved 2026-11-02: "approve the 16 and keep the 8 for later"):
# first batch promoted from the discovery worker's review queue (discovered_sources, status under_review,
# health ok, working feed), ranked by how few healthy publishers the country has. Mirrors what the admin
# flow writes (promote: submission + discovered_sources -> verified; approve: publisher + feed + submission
# approved), plus slug / source_type / creator_kind / editorial profile, which the admin flow leaves empty.
# Of the 16 approved, 4 stay in the queue: Antara (149) = existing publisher 981 antaranews.com;
# UzA (159) and Bernama (95) unreachable from here on 11-02; Réalités Sénégal (656) 2 items since September.
# Feeds re-checked 2026-11-02 with the worker's UA. TARGET: on-prem production DB (Sql-OnPrem.ps1).
import json

TAG = '[added by Claude 2026-11-02, Build #128 discovery approvals 1]'
DAY = '2026-11-02'
W = 'https://en.wikipedia.org/wiki/'

# ds = discovered_sources.id. feed/lang/name override the candidate row where checked by hand.
PUBS = [
    dict(ds=108, iso='SM', name='San Marino RTV', slug='san-marino-rtv', lang='it', stype='TV',
         feed='https://www.sanmarinortv.sm/rss.xml', ftype='rss', check='rss, 20 items, newest 2026-11-02',
         own='public', owner='San Marino RTV S.p.A. (Ente per la Radiodiffusione Sammarinese and RAI)', tags=['public_state'], conf='medium',
         hist='Public broadcaster of San Marino, operating radio and television since the early 1990s.',
         cur='National news of San Marino in Italian (politics, society, sport).',
         ev='Public broadcaster; shareholding (San Marino state broadcasting body and RAI) per Wikipedia, not re-verified in its accounts.',
         src=[(W + 'San_Marino_RTV', 'Public broadcaster of San Marino', 'reference')], review=True),
    dict(ds=102, iso='TM', name='TDH (Turkmenistan State News Service)', slug='tdh-turkmenistan', lang='en', stype='NEWS_AGENCY',
         feed='https://www.tdh.gov.tm/en/rss.xml', ftype='rss', check='rss (English edition), 20 items, newest 2026-11-02',
         own='state', owner='Government of Turkmenistan', tags=['public_state'], conf='high',
         hist='State news agency of Turkmenistan (Türkmen Döwlet Habarlary), on a government domain (gov.tm).',
         cur='Official news of the Turkmen state; English edition used (Turkmen and Russian editions also exist).',
         ev='Government domain and official status; editorial independence not expected in Turkmenistan.',
         src=[('https://www.tdh.gov.tm/en/', 'Official state news agency site (gov.tm)', 'primary')], review=False),
    dict(ds=77, iso='UY', name='El Observador', slug='el-observador-uy', lang='es', stype='NEWSPAPER',
         feed='https://www.elobservador.com.uy/sitemap-news.xml', ftype='sitemap-news', check='news sitemap, 93 entries, newest 2026-11-02 15:54',
         own='commercial', owner='unknown', tags=['commercial_generalist'], conf='medium',
         hist='Uruguayan daily newspaper published in Montevideo.',
         cur='National news, politics and economy of Uruguay.',
         ev='Established private daily; current ownership not verified for this profile.',
         src=[(W + 'El_Observador_(Uruguay)', 'Uruguayan daily newspaper', 'reference')], review=True),
    dict(ds=106, iso='AD', name="Diari d'Andorra", slug='diari-andorra', lang='ca', stype='NEWSPAPER',
         feed='https://www.diariandorra.ad/rss/home.xml', ftype='rss', check='rss, 89 items, newest 2026-11-02',
         own='commercial', owner='unknown', tags=['commercial_generalist'], conf='medium',
         hist='Andorran daily newspaper in Catalan.',
         cur='National news of Andorra.',
         ev='Established private daily; ownership not verified for this profile.',
         src=[('https://www.diariandorra.ad/', 'Andorran daily newspaper', 'primary')], review=True),
    dict(ds=98, iso='KZ', name='Kazinform', slug='kazinform', lang='en', stype='NEWS_AGENCY',
         feed='https://qazinform.com/feed.xml', ftype='rss', check='rss (English), 50 items, newest 2026-11-02',
         own='state', owner='Government of Kazakhstan', tags=['public_state'], conf='high',
         hist='National news agency of Kazakhstan (Kazinform / Qazinform).',
         cur='Official and general news of Kazakhstan in English.',
         ev='State-owned national news agency.',
         src=[(W + 'Kazinform', 'National news agency of Kazakhstan', 'reference')], review=False),
    dict(ds=58, iso='AE', name='Khaleej Times', slug='khaleej-times', lang='en', stype='NEWSPAPER',
         feed='https://www.khaleejtimes.com/api/v1/collections/top-section.rss', ftype='rss', check='rss, 20 items, newest 2026-11-02',
         own='commercial', owner='unknown', tags=['commercial_generalist'], conf='medium',
         hist='English-language daily newspaper based in Dubai, founded in 1978.',
         cur='UAE and regional news in English.',
         ev='Long-established Dubai daily; current ownership not verified for this profile. UAE press operates under state media regulation.',
         src=[(W + 'Khaleej_Times', 'Dubai English-language daily', 'reference')], review=True),
    dict(ds=70, iso='CO', name='El Espectador', slug='el-espectador', lang='es', stype='NEWSPAPER',
         feed='https://www.elespectador.com/arc/outboundfeeds/discover/', ftype='rss', check='rss, 20 items, newest 2026-11-02',
         own='commercial', owner='unknown', tags=['commercial_generalist'], conf='medium',
         hist='Colombian newspaper founded in 1887, one of the oldest in the country.',
         cur='National news, politics and investigations in Colombia.',
         ev='Established private newspaper; current ownership not verified for this profile.',
         src=[(W + 'El_Espectador', 'Colombian newspaper founded 1887', 'reference')], review=True),
    dict(ds=64, iso='LB', name='Naharnet', slug='naharnet', lang='en', stype='ONLINE_NEWS',
         feed='https://www.naharnet.com/tags/lebanon/en/feed.atom', ftype='rss', check='atom (Lebanon tag), 10 items, newest 2026-11-02',
         own='commercial', owner='unknown', tags=['commercial_generalist'], conf='medium',
         hist='Lebanese English-language online news service.',
         cur='Lebanese politics and security news in English (Lebanon tag feed).',
         ev='Private online outlet; ownership not verified for this profile.',
         src=[(W + 'Naharnet', 'Lebanese English-language news website', 'reference')], review=True),
    dict(ds=91, iso='BG', name='Novinite (Sofia News Agency)', slug='novinite', lang='en', stype='ONLINE_NEWS',
         feed='https://www.novinite.com/services/news_rdf.php', ftype='rss', check='rss, 17 items, newest 2026-11-01',
         own='commercial', owner='unknown', tags=['commercial_generalist'], conf='medium',
         hist='Bulgarian English-language news service (Sofia News Agency).',
         cur='Bulgarian politics, economy and society in English.',
         ev='Private outlet; ownership not verified for this profile.',
         src=[('https://www.novinite.com/', 'Bulgarian English-language news site', 'primary')], review=True),
    dict(ds=728, iso='ZW', name='Daily Mast', slug='daily-mast', lang='en', stype='ONLINE_NEWS',
         feed='https://dailymast.com/feed/', ftype='rss', check='rss, 10 items, newest 2026-10-31',
         own='unknown', owner='unknown', tags=['unknown'], conf='unknown',
         hist='Zimbabwean online news site.',
         cur='Zimbabwean news in English.',
         ev='No ownership information verified.',
         src=[('https://dailymast.com/', 'Homepage reviewed', 'primary')], review=True),
    dict(ds=114, iso='ES', name='EFE', slug='efe', lang='es', stype='NEWS_AGENCY',
         feed='https://efe.com/news-sitemap.xml', ftype='sitemap-news', check='news sitemap, 178 entries, newest 2026-11-02 16:30',
         own='state', owner='Spanish state (via SEPI)', tags=['public_state'], conf='high',
         hist='Spanish international news agency founded in 1939, the largest Spanish-language agency.',
         cur='Spanish and international news in Spanish.',
         ev='State-owned news agency.',
         src=[(W + 'EFE', 'Spanish state-owned international news agency', 'reference')], review=False),
    dict(ds=897, iso='TZ', name='Mwanaspoti', slug='mwanaspoti', lang='sw', stype='SPORTS',
         feed='https://www.mwanaspoti.co.tz/rss.xml', ftype='rss', check='rss (Swahili), 25 items, newest 2026-11-02',
         own='commercial', owner='Mwananchi Communications Ltd (Nation Media Group)', tags=['specialist'], conf='medium',
         hist='Swahili-language sports newspaper of Mwananchi Communications, publisher of Mwananchi and The Citizen.',
         cur='Tanzanian and international sport in Swahili.',
         ev='Same publisher as Mwananchi (Build #123) per the shared site platform; not independently verified.',
         src=[('https://www.mwanaspoti.co.tz/', 'Swahili sports newspaper, Mwananchi Communications platform', 'primary')], review=True),
]

def q(s):
    return "NULL" if s is None else "'" + s.replace("'", "''") + "'"

N = len(PUBS)
ids = ','.join(str(p['ds']) for p in PUBS)
slugs = ','.join(q(p['slug']) for p in PUBS)

def body():
    out = [
        f"  SELECT count(*) INTO bad FROM publishers WHERE slug IN ({slugs});",
        "  IF bad > 0 THEN RAISE EXCEPTION 'One or more slugs already exist (%) — nothing changed', bad; END IF;",
        "  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';",
        "  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;",
        f"  SELECT count(*) INTO bad FROM discovered_sources WHERE id IN ({ids}) AND status = 'under_review' AND health = 'ok';",
        f"  IF bad <> {N} THEN RAISE EXCEPTION 'only % of the {N} candidates are still under_review/ok — nothing changed', bad; END IF;",
        # same www-insensitive domain key as the admin promote endpoint (KNOWN_DOMAIN_SQL), any country
        f"  SELECT count(*) INTO bad FROM publishers p JOIN discovered_sources ds ON ds.id IN ({ids})"
        "   AND lower(split_part(regexp_replace(p.domain, '^www\\.', ''), '/', 1)) = ds.domain;",
        "  IF bad > 0 THEN RAISE EXCEPTION '% candidate domain(s) already a publisher — nothing changed', bad; END IF;",
    ]
    for p in PUBS:
        srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
        detail = f"Discovery candidate {p['ds']} approved by owner 2026-11-02; feed re-checked {DAY}: {p['check']} "
        out += [
            f"\n  -- {p['iso']}: {p['name']} (discovered_sources {p['ds']})",
            f"  SELECT * INTO c FROM discovered_sources WHERE id = {p['ds']};",
            "  INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,",
            "    verification_detail, domain, description, youtube_url, facebook_url, x_url, instagram_url, tiktok_url,",
            "    ingestion_method, status, status_changed_at, reviewed_at)",
            f"  VALUES ({q(p['name'])}, c.homepage_url, {q(p['feed'])}, {q(p['ftype'])}, c.country_id, {q(p['lang'])}, true,",
            f"    {q(detail)} || build_tag, c.domain, c.description, c.youtube_url, c.facebook_url, c.x_url, c.instagram_url, c.tiktok_url,",
            "    'feed', 'approved', now(), now()) RETURNING id INTO v_sid;",
            "  INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type, slug, creator_kind,",
            "    youtube_url, facebook_url, instagram_url, tiktok_url, x_url, description)",
            f"  VALUES (c.country_id, {q(p['name'])}, c.homepage_url, 'active', {q(p['lang'])}, c.domain, {q(p['stype'])}, {q(p['slug'])}, 'organisation',",
            "    c.youtube_url, c.facebook_url, c.instagram_url, c.tiktok_url, c.x_url, c.description) RETURNING id INTO v_pid;",
            f"  INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (v_pid, {q(p['feed'])}, {q(p['ftype'])});",
            "  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;",
            "  UPDATE discovered_sources SET status = 'verified', promoted_submission_id = v_sid, updated_at = now() WHERE id = c.id;",
            "  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags,",
            "    political_party_association, historical_context, current_context,",
            "    confidence, evidence_summary, evidence_sources, classification_date, last_reviewed, evidence_date, review_required)",
            f"  VALUES (v_pid, {q(p['own'])}, {q(p['owner'])}, ARRAY[{','.join(q(t) for t in p['tags'])}]::text[], NULL,",
            f"    {q(p['hist'])}, {q(p['cur'])},",
            f"    {q(p['conf'])}, {q(p['ev'])}, {q(srcs)}::jsonb, '{DAY}', '{DAY}', '{DAY}', {'true' if p['review'] else 'false'});",
        ]
    out.append(f"  RAISE NOTICE 'Build #128: {N} publishers promoted from the discovery queue';")
    return '\n'.join(out)

do_block = f"""DO $do$
DECLARE
  c discovered_sources%ROWTYPE;
  v_pid integer; v_sid integer;
  build_tag constant text := {q(TAG)};
  bad integer;
BEGIN
{body()}
END $do$;
"""
like = q('%' + TAG + '%')
head = (f"-- GENERATED by Build-Sql.py — edit the list there, not this file. TARGET: on-prem production (Sql-OnPrem.ps1).\n"
        f"-- Build #128 (data only, MEDIUM): {N} publishers from the discovery queue: "
        + ', '.join(f"{p['name']} ({p['iso']})" for p in PUBS) + "\n\\set ON_ERROR_STOP on\nSET lock_timeout = '5s';\n")

open('apply.sql', 'w', encoding='utf-8', newline='\n').write(head + "BEGIN;\n\n" + do_block + f"""
SELECT 'count|' || count(*) || ' publishers added' FROM publisher_submissions WHERE verification_detail LIKE {like};
SELECT 'countries|' || string_agg(DISTINCT c.iso_code, ',' ORDER BY c.iso_code) || ' covered'
  FROM publishers p JOIN countries c ON c.id = p.country_id WHERE p.slug IN ({slugs});
COMMIT;
""")
open('rehearse.sql', 'w', encoding='utf-8', newline='\n').write(head.replace('Build #128', 'REHEARSAL (ROLLBACK) Build #128', 1) + "BEGIN;\n\n" + do_block + f"""
SELECT 'added|' || count(*) || ' publishers tagged' FROM publisher_submissions WHERE verification_detail LIKE {like};
SELECT 'promoted|' || count(*) || ' candidates verified' FROM discovered_sources WHERE id IN ({ids}) AND status = 'verified';
ROLLBACK;
SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE verification_detail LIKE {like};
""")
open('reverse.sql', 'w', encoding='utf-8', newline='\n').write(f"""-- GENERATED by Build-Sql.py. Reverses Build #128: removes the {N} publishers and every row referencing them,
-- and puts the {N} discovery candidates back to under_review.
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
  UPDATE discovered_sources SET status = 'under_review', promoted_submission_id = NULL, updated_at = now() WHERE id IN ({ids});
  UPDATE publisher_submissions SET publisher_id = NULL WHERE publisher_id = ANY(pids);
  DELETE FROM publisher_submissions WHERE verification_detail LIKE {like};
  DELETE FROM publishers            WHERE id = ANY(pids);
  RAISE NOTICE 'Reversed: removed % publishers', array_length(pids, 1);
END $do$;
SELECT 'reversed|' || count(*) || ' publishers remain with these slugs' FROM publishers WHERE slug IN ({slugs});
COMMIT;
""")
open('verify.sql', 'w', encoding='utf-8', newline='\n').write(f"""-- GENERATED by Build-Sql.py. Read-only checks after Build #128.
\\set ON_ERROR_STOP on
SELECT 'feeds|' || count(*) || ' feeds' FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE p.slug IN ({slugs});
SELECT 'profiles|' || count(*) || ' editorial profiles' FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id WHERE p.slug IN ({slugs});
SELECT 'queue|' || count(*) || ' candidates verified' FROM discovered_sources WHERE id IN ({ids}) AND status = 'verified';
SELECT 'poll|' || p.slug || '|status=' || coalesce(f.last_status,'-') || '|fails=' || f.consecutive_failures || '|err=' || coalesce(f.last_error,'')
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.slug;
SELECT 'articles|' || p.slug || '|' || count(a.id) || ' total|' || count(a.id) FILTER (WHERE a.published_at IS NULL) || ' undated|'
       || count(a.id) FILTER (WHERE a.published_at > now() - interval '7 days') || ' in 7d|newest=' || coalesce(to_char(max(a.published_at),'YYYY-MM-DD HH24:MI'),'-')
  FROM publishers p LEFT JOIN articles a ON a.publisher_id = p.id WHERE p.slug IN ({slugs}) GROUP BY p.slug ORDER BY p.slug;
""")
print('wrote apply/rehearse/reverse/verify for', N, 'publishers')
