# Generates apply / rehearse / reverse SQL for Build #134: 6 West African publishers (GW SL MR TG).
# Owner, 2026-11-02: "yes, add the 6". Same shape as release-west-africa-sources-2 (Build #133).
# Feeds checked 2026-11-02 with our own bot UA; robots.txt allows; none present in publishers/feeds/discovered_sources.
import json, os

TAG = '[added by Claude 2026-11-02, West Africa sources 3]'
DAY = '2026-11-02'


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


NV = 'non vérifié pour ce profil'
P = [
    pub('GW', 'O Democrata', 'o-democrata', 'https://www.odemocratagb.com/', 'odemocratagb.com',
        'https://www.odemocratagb.com/?feed=rss2', 'pt', 'NEWSPAPER', 'RSS 10 items, newest 2026-11-02',
        'Guinea-Bissau newspaper (Bissau, Portuguese).', 'Journal privé', 'Non vérifié', ['commercial_generalist'], 'low',
        'Journal bissau-guinéen publié à Bissau.', 'Actualité nationale bissau-guinéenne en portugais (politique, société, sport).',
        f'Journal privé ; propriété {NV}.'),
    pub('SL', 'AYV News', 'ayv-news', 'https://ayvnews.com/', 'ayvnews.com',
        'https://ayvnews.com/feed/', 'en', 'TV', 'RSS 10 items, newest 2026-11-02',
        'News site of AYV Media (Africa Young Voices), Sierra Leonean TV and radio network.', 'Groupe de médias privé', 'AYV Media Empire (Africa Young Voices)',
        ['commercial_generalist'], 'low',
        "Site d'information du groupe AYV Media (Africa Young Voices), réseau de télévision et de radio sierra-léonais.",
        'Actualité sierra-léonaise (politique, sport, institutions) en anglais.',
        f'Groupe de médias privé ; actionnariat {NV}.'),
    pub('MR', 'Alakhbar', 'alakhbar', 'https://www.alakhbar.info/', 'alakhbar.info',
        'https://www.alakhbar.info/latest/rss/', 'ar', 'NEWS_AGENCY', 'RSS 15 items, newest 2026-11-02',
        'Mauritanian independent news agency (Arabic).', 'Agence de presse privée indépendante', 'Non vérifié', ['independent'], 'medium',
        "Agence d'information mauritanienne privée en arabe, basée à Nouakchott, réputée indépendante.",
        'Actualité mauritanienne en arabe (politique, société, diaspora).',
        f'Agence privée réputée indépendante ; propriété {NV}.'),
    pub('MR', 'Rapide Info', 'rapide-info', 'https://rapideinfo.mr/', 'rapideinfo.mr',
        'https://rapideinfo.mr/feed/', 'fr', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'Mauritanian news site (French).', "Site d'information privé", 'Non vérifié', ['commercial_generalist'], 'low',
        "Site d'information mauritanien en français.", 'Actualité mauritanienne et africaine en français.',
        f"Site d'information privé ; propriété {NV}."),
    pub('TG', '24 Heure Info', '24-heure-info', 'https://24heureinfo.com/', '24heureinfo.com',
        'https://24heureinfo.com/feed/', 'fr', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'Togolese news site (French).', "Site d'information privé", 'Non vérifié', ['commercial_generalist'], 'low',
        "Site d'information togolais en français.", 'Actualité togolaise et internationale en français.',
        f"Site d'information privé ; propriété {NV}."),
    pub('TG', 'Togo Actualité', 'togo-actualite', 'https://togoactualite.com/', 'togoactualite.com',
        'https://togoactualite.com/feed/', 'fr', 'ONLINE_NEWS', 'RSS 4 items, newest 2026-11-02',
        'Togolese news site (French).', "Site d'information privé", 'Non vérifié', ['commercial_generalist'], 'low',
        "Site d'information togolais en français.", 'Actualité politique togolaise en français.',
        f"Site d'information privé ; propriété {NV}."),
]

slugs = ','.join(q(p['slug']) for p in P)
doms = ','.join(q(p['dom']) for p in P)
feeds = ','.join(q(p['feed']) for p in P)


def block(p):
    srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
    detail = f"Added on owner approval {DAY} (country below 5 live sources); {p['check']} {TAG}"
    tags = ','.join(q(t) for t in p['tags'])
    return f"""
  -- {p['iso']}: {p['name']}
  SELECT id INTO v_cid FROM countries WHERE iso_code = {q(p['iso'])};
  INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
    verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
  VALUES ({q(p['name'])}, {q(p['home'])}, {q(p['feed'])}, 'rss', v_cid, {q(p['lang'])}, true,
    {q(detail)}, {q(p['dom'])}, 'feed', 'approved', now(), now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type, slug, creator_kind, description)
  VALUES (v_cid, {q(p['name'])}, {q(p['home'])}, 'active', {q(p['lang'])}, {q(p['dom'])}, {q(p['st'])}, {q(p['slug'])}, 'organisation', {q(p['desc'])})
  RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (v_pid, {q(p['feed'])}, 'rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association,
    historical_context, current_context, confidence, evidence_summary, evidence_sources,
    classification_date, last_reviewed, evidence_date, review_required)
  VALUES (v_pid, {q(p['own'])}, {q(p['owner'])}, ARRAY[{tags}]::text[], NULL,
    {q(p['hist'])}, {q(p['cur'])}, {q(p['conf'])}, {q(p['ev'])}, {q(srcs)}::jsonb,
    '{DAY}', '{DAY}', '{DAY}', true);
  RAISE NOTICE '% added: publisher %', {q(p['name'])}, v_pid;"""



apply = f"""-- GENERATED by Build-Sql.py. Build #134 (MEDIUM): 6 West African publishers (GW SL MR TG).
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of these is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, f.id AS feed_id, f.feed_url FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #134 (new publishers removed, children first).
\\set ON_ERROR_STOP on
BEGIN;
DO $do$
DECLARE pids integer[];
BEGIN
  SELECT array_agg(id) INTO pids FROM publishers WHERE slug IN ({slugs});
  IF pids IS NULL THEN RAISE NOTICE 'No new publishers to remove'; RETURN; END IF;
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
  DELETE FROM publisher_submissions WHERE publisher_id = ANY(pids) OR verification_detail LIKE {q('%' + TAG + '%')};
  DELETE FROM publishers            WHERE id = ANY(pids);
  RAISE NOTICE 'Reversed: removed % publishers', array_length(pids, 1);
END $do$;
COMMIT;
"""

here = os.path.dirname(os.path.abspath(__file__))
for name, text in (('apply.sql', apply), ('rehearse.sql', apply.replace('\nCOMMIT;\n', '\nROLLBACK;\n')), ('reverse.sql', reverse)):
    with open(os.path.join(here, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
print('written: apply.sql rehearse.sql reverse.sql')
