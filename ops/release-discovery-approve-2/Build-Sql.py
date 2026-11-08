# Generates apply.sql / rehearse.sql / reverse.sql / verify.sql for Build #194 from the PUBS and REJECTS lists below.
# Build #194 (data only, MEDIUM, owner approved 2026-11-08: "go ahead, add UzA and Bernama, reject the 4"): the last
# candidates left from the Build #128 review. Same steps as release-discovery-approve-1 (the admin promote + approve
# flow, plus slug / source_type / creator_kind / editorial profile), and the 4 rejections as the admin PATCH does.
# UzA and Bernama were unreachable on 11-02; both answer from dr-rke2 (the worker's host) on 11-08.
# TARGET: on-prem production DB (Sql-OnPrem.ps1).
import json

BUILD = 'Build #194'
TAG = '[added by Claude 2026-11-08, Build #194 discovery approvals 2]'
DAY = '2026-11-08'
W = 'https://en.wikipedia.org/wiki/'

# ds = discovered_sources.id. feed/lang/name override the candidate row where checked by hand.
PUBS = [
    dict(ds=159, iso='UZ', name='UzA (Uzbekistan National News Agency)', slug='uza-uzbekistan', lang='en', stype='NEWS_AGENCY',
         feed='https://uza.uz/en/rss', ftype='rss',
         check='rss (English edition; /rss redirects to the Uzbek /oz/rss), 20 items, newest 2026-11-08 09:40',
         own='state', owner='Government of Uzbekistan', tags=['public_state'], conf='high',
         hist='National news agency of Uzbekistan (Oʻzbekiston Milliy axborot agentligi, UzA).',
         cur='Official and general news of Uzbekistan; English edition used (Uzbek and Russian editions also exist).',
         ev='State national news agency; editorial independence not expected.',
         src=[(W + 'National_News_Agency_of_Uzbekistan', 'National news agency of Uzbekistan', 'reference')], review=False),
    dict(ds=95, iso='MY', name='Bernama', slug='bernama', lang='ms', stype='NEWS_AGENCY',
         feed='https://www.bernama.com/news-sitemap.xml', ftype='sitemap-news',
         check='news sitemap, 36 entries (19 ms, 16 en, 1 es), newest 2026-11-07 20:17 +08',
         own='state', owner='Government of Malaysia (statutory body under the Ministry of Communications)', tags=['public_state'], conf='high',
         hist='Malaysian National News Agency (Pertubuhan Berita Nasional Malaysia), established by Act of Parliament in 1967.',
         cur='National and international news in Malay and English (the news sitemap carries both).',
         ev='Statutory state news agency.',
         src=[(W + 'Bernama', 'Malaysian National News Agency', 'reference')], review=False),
]

# ds, domain, reason -- set to rejected as PATCH /api/admin/discovered-sources/:id does, reason prefixed to notes.
REJECTS = [
    (149, 'en.antaranews.com', 'English edition of publisher 981 antara-news (same agency, already carried)'),
    (656, 'realites-senegal.sn', 'nearly silent: 10 feed items, newest 2026-10-16'),
    (580, 'epapers.visiongroup.co.ug', 'Vision Group e-paper page, not news (newest item 2024-05); New Vision is publisher 8955'),
    (582, 'classifieds.visiongroup.co.ug', 'Vision Group classifieds, not news'),
]

def q(s):
    return "NULL" if s is None else "'" + s.replace("'", "''") + "'"

N = len(PUBS)
ids = ','.join(str(p['ds']) for p in PUBS)
slugs = ','.join(q(p['slug']) for p in PUBS)
R = len(REJECTS)
rids = ','.join(str(r[0]) for r in REJECTS)

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
        "  SELECT count(*) INTO bad FROM discovered_sources ds JOIN (VALUES "
        + ', '.join(f"({r[0]}, {q(r[1])})" for r in REJECTS)
        + ") v(id, domain) ON v.id = ds.id AND v.domain = ds.domain WHERE ds.status = 'under_review';",
        f"  IF bad <> {R} THEN RAISE EXCEPTION 'only % of the {R} rejections are still under_review with matching domains — nothing changed', bad; END IF;",
    ]
    for p in PUBS:
        srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
        detail = f"Discovery candidate {p['ds']} approved by owner {DAY}; feed re-checked {DAY}: {p['check']} "
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
    out.append("\n  -- rejections")
    for ds, _domain, reason in REJECTS:
        out.append(f"  UPDATE discovered_sources SET status = 'rejected', updated_at = now(),"
                   f" notes = {q('rejected ' + DAY + ': ' + reason)} || coalesce(E'\\n' || nullif(notes, ''), '') WHERE id = {ds};")
    out.append(f"  RAISE NOTICE '{BUILD}: {N} publishers promoted, {R} candidates rejected';")
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
head = (f"-- GENERATED by Build-Sql.py — edit the lists there, not this file. TARGET: on-prem production (Sql-OnPrem.ps1).\n"
        f"-- {BUILD} (data only, MEDIUM): {N} publishers from the discovery queue: "
        + ', '.join(f"{p['name']} ({p['iso']})" for p in PUBS) + f"; {R} rejected: {rids}\n\\set ON_ERROR_STOP on\nSET lock_timeout = '5s';\n")
summary = f"""SELECT 'count|' || count(*) || ' publishers added' FROM publisher_submissions WHERE verification_detail LIKE {like};
SELECT 'promoted|' || count(*) || ' candidates verified' FROM discovered_sources WHERE id IN ({ids}) AND status = 'verified';
SELECT 'rejected|' || id || '|' || domain || '|' || left(notes, 80) FROM discovered_sources WHERE id IN ({rids}) ORDER BY id;
"""

open('apply.sql', 'w', encoding='utf-8', newline='\n').write(head + "BEGIN;\n\n" + do_block + summary + "COMMIT;\n")
open('rehearse.sql', 'w', encoding='utf-8', newline='\n').write(head.replace(BUILD, 'REHEARSAL (ROLLBACK) ' + BUILD, 1) + "BEGIN;\n\n" + do_block + summary + f"""ROLLBACK;
SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE verification_detail LIKE {like};
""")
open('reverse.sql', 'w', encoding='utf-8', newline='\n').write(f"""-- GENERATED by Build-Sql.py. Reverses {BUILD}: removes the {N} publishers and every row referencing them,
-- puts the {N} discovery candidates back to under_review, and un-rejects the {R} (note prefix removed).
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE pids integer[];
BEGIN
  SELECT array_agg(id) INTO pids FROM publishers WHERE slug IN ({slugs});
  IF pids IS NOT NULL THEN
    -- every table with a FK to publishers (as in release-discovery-approve-1), children first
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
  END IF;
  UPDATE discovered_sources SET status = 'under_review', updated_at = now(),
      notes = nullif(regexp_replace(notes, '^rejected {DAY}: [^\\n]*\\n?', ''), '')
    WHERE id IN ({rids}) AND status = 'rejected';
END $do$;
SELECT 'reversed|' || count(*) || ' publishers remain with these slugs' FROM publishers WHERE slug IN ({slugs});
COMMIT;
""")
open('verify.sql', 'w', encoding='utf-8', newline='\n').write(f"""-- GENERATED by Build-Sql.py. Read-only checks after {BUILD}.
\\set ON_ERROR_STOP on
SELECT 'feeds|' || count(*) || ' feeds' FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE p.slug IN ({slugs});
SELECT 'profiles|' || count(*) || ' editorial profiles' FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id WHERE p.slug IN ({slugs});
SELECT 'queue|' || count(*) || ' candidates verified' FROM discovered_sources WHERE id IN ({ids}) AND status = 'verified';
SELECT 'rejected|' || count(*) || ' of {R} rejected' FROM discovered_sources WHERE id IN ({rids}) AND status = 'rejected';
SELECT 'poll|' || p.slug || '|status=' || coalesce(f.last_status,'-') || '|fails=' || f.consecutive_failures || '|err=' || coalesce(f.last_error,'')
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.slug;
SELECT 'articles|' || p.slug || '|' || count(a.id) || ' total|' || count(a.id) FILTER (WHERE a.published_at IS NULL) || ' undated|'
       || count(a.id) FILTER (WHERE a.published_at > now() - interval '7 days') || ' in 7d|newest=' || coalesce(to_char(max(a.published_at),'YYYY-MM-DD HH24:MI'),'-')
  FROM publishers p LEFT JOIN articles a ON a.publisher_id = p.id WHERE p.slug IN ({slugs}) GROUP BY p.slug ORDER BY p.slug;
""")
print('wrote apply/rehearse/reverse/verify for', N, 'publishers and', R, 'rejections')
