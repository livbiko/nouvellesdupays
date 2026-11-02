# Generates apply / rehearse / reverse SQL for Build #133: 10 West African publishers + Kerr Fatou domain fix.
# Owner, 2026-11-02: "yes, add the 10 and fix Kerr Fatou". Same shape as release-caribbean-sources (Build #132).
# Feeds checked 2026-11-02 with our own bot UA; robots.txt allows; none present in publishers/feeds/discovered_sources.
import json, os

TAG = '[added by Claude 2026-11-02, West Africa sources 2]'
DAY = '2026-11-02'


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


NV = 'non vérifié pour ce profil'
P = [
    pub('GW', 'Conosaba do Porto', 'conosaba-do-porto', 'https://conosaba.blogspot.com/', 'conosaba.blogspot.com',
        'https://conosaba.blogspot.com/feeds/posts/default?alt=rss', 'pt', 'BLOG', 'RSS 25 items, newest 2026-11-02',
        'Guinea-Bissau news blog (Portuguese).', 'Blog d\'information', 'Non identifié', ['unknown'], 'low',
        'Blog d\'actualité bissau-guinéen de longue date, hébergé sur Blogger.',
        'Actualité politique et sociale de Guinée-Bissau en portugais (gouvernement, sécurité, diaspora).',
        f'Blog ; auteur(s) et propriété {NV}. Seule source vivante pour la Guinée-Bissau au 2026-11-02.'),
    pub('SL', 'The Calabash Newspaper', 'the-calabash-newspaper', 'https://thecalabashnewspaper.com/', 'thecalabashnewspaper.com',
        'https://thecalabashnewspaper.com/feed/', 'en', 'NEWSPAPER', 'RSS 10 items, newest 2026-11-02',
        'Sierra Leonean newspaper (Freetown).', 'Journal privé', 'Non vérifié', ['commercial_generalist'], 'low',
        'Journal sierra-léonais publié à Freetown.', 'Actualité politique et économique de Sierra Leone en anglais.',
        f'Journal privé ; propriété {NV}.'),
    pub('MR', 'Le Calame', 'le-calame', 'https://lecalame.info/', 'lecalame.info',
        'https://lecalame.info/rss.xml', 'fr', 'NEWSPAPER', 'RSS 10 items, newest 2026-11-02',
        'Mauritanian independent weekly (Nouakchott).', 'Hebdomadaire privé indépendant', 'Non vérifié', ['independent'], 'medium',
        'Hebdomadaire indépendant mauritanien de longue date, publié à Nouakchott.',
        'Actualité politique mauritanienne et analyses en français.',
        f'Hebdomadaire réputé indépendant ; propriété actuelle {NV}.'),
    pub('MR', 'Kassataya', 'kassataya', 'https://kassataya.com/', 'kassataya.com',
        'https://kassataya.com/feed/', 'fr', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'Mauritanian news site (French).', 'Site d\'information privé', 'Non vérifié', ['unknown'], 'low',
        'Site d\'information mauritanien en français, suivi notamment par la diaspora.',
        'Actualité mauritanienne et de la diaspora en français.',
        f'Site d\'information ; propriété et siège {NV}.'),
    pub('CV', 'Balai', 'balai', 'https://balai.cv/', 'balai.cv',
        'https://balai.cv/feed/', 'pt', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'Cape Verdean news site (Portuguese).', 'Site d\'information privé', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d\'information cap-verdien en portugais.', 'Actualité nationale cap-verdienne (justice, société, politique).',
        f'Site d\'information privé ; propriété {NV}.'),
    pub('CV', 'Notícias do Norte', 'noticias-do-norte', 'https://noticiasdonorte.publ.cv/', 'noticiasdonorte.publ.cv',
        'https://noticiasdonorte.publ.cv/feed/', 'pt', 'ONLINE_NEWS', 'RSS 17 items, newest 2026-11-01',
        'Cape Verdean regional news site (northern islands).', 'Site d\'information privé', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d\'information cap-verdien centré sur les îles du nord (São Vicente, Santo Antão).',
        'Actualité régionale et nationale cap-verdienne en portugais (dont la présidentielle 2026).',
        f'Site d\'information privé ; propriété {NV}.'),
    pub('GM', 'The Alkamba Times', 'the-alkamba-times', 'https://www.alkambatimes.com/', 'alkambatimes.com',
        'https://www.alkambatimes.com/feed/', 'en', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'Gambian news site (English).', 'Site d\'information privé', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d\'information gambien en anglais.', 'Actualité gambienne, politique et sport en anglais.',
        f'Site d\'information privé ; propriété {NV}.'),
    pub('LR', 'Smart News Liberia', 'smart-news-liberia', 'https://smartnewsliberia.com/', 'smartnewsliberia.com',
        'https://smartnewsliberia.com/feed/', 'en', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'Liberian news site (English).', 'Site d\'information privé', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d\'information libérien en anglais.', 'Actualité libérienne et régionale en anglais.',
        f'Site d\'information privé ; propriété {NV}.'),
    pub('LR', 'The Liberian Investigator', 'the-liberian-investigator', 'https://liberianinvestigator.com/', 'liberianinvestigator.com',
        'https://liberianinvestigator.com/feed/', 'en', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'Liberian news site (English).', 'Site d\'information privé', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d\'information libérien en anglais.', 'Actualité libérienne (politique, institutions, société) en anglais.',
        f'Site d\'information privé ; propriété {NV}.'),
    pub('NE', 'Studio Kalangou', 'studio-kalangou', 'https://www.studiokalangou.org/', 'studiokalangou.org',
        'https://www.studiokalangou.org/feed/', 'fr', 'RADIO', 'RSS 10 items, newest 2026-11-02',
        'Nigerien news radio programme (Fondation Hirondelle).', 'Programme de radio soutenu par une ONG', 'Fondation Hirondelle (ONG suisse)',
        ['independent'], 'medium',
        'Programme d\'information radiophonique nigérien créé avec la Fondation Hirondelle, diffusé par des radios partenaires.',
        'Actualité nationale nigérienne en français et en langues nationales (« Au rythme du Niger »).',
        'Projet de la Fondation Hirondelle (ONG suisse de soutien aux médias) ; financement et gouvernance actuels non vérifiés pour ce profil.'),
]

KF_OLD = dict(home='https://www.kerrfatunews.com/', dom='kerrfatunews.com', feed='https://www.kerrfatunews.com/feed/', status='unavailable')
KF_NEW = dict(home='https://www.kerrfatou.com/', dom='kerrfatou.com', feed='https://www.kerrfatou.com/feed/')

slugs = ','.join(q(p['slug']) for p in P)
doms = ','.join(q(p['dom']) for p in P + [KF_NEW])
feeds = ','.join(q(p['feed']) for p in P + [KF_NEW])


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


kerr = f"""
  -- GM: Kerr Fatou (publisher 210) moved kerrfatunews.com -> kerrfatou.com; feed dead since (1562 failures). Fix in place.
  UPDATE publishers SET homepage_url = {q(KF_NEW['home'])}, domain = {q(KF_NEW['dom'])}, feed_status = 'active'
   WHERE id = 210 AND domain = {q(KF_OLD['dom'])};
  IF NOT FOUND THEN RAISE EXCEPTION 'Kerr Fatou (210) not in the expected state - nothing changed'; END IF;
  UPDATE feeds SET feed_url = {q(KF_NEW['feed'])}, consecutive_failures = 0, last_error = NULL, last_error_at = NULL,
         etag = NULL, last_modified = NULL
   WHERE publisher_id = 210 AND feed_url = {q(KF_OLD['feed'])};
  IF NOT FOUND THEN RAISE EXCEPTION 'Kerr Fatou feed not in the expected state - nothing changed'; END IF;
  RAISE NOTICE 'Kerr Fatou (210) moved to kerrfatou.com';"""

apply = f"""-- GENERATED by Build-Sql.py. Build #133 (MEDIUM): 10 West African publishers + Kerr Fatou domain fix.
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
{kerr}
END $do$;
SELECT p.id, p.slug, c.iso_code, f.id AS feed_id, f.feed_url FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) OR p.id = 210 ORDER BY p.id;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #133 (new publishers removed, children first; Kerr Fatou restored).
\\set ON_ERROR_STOP on
BEGIN;
DO $do$
DECLARE pids integer[];
BEGIN
  UPDATE publishers SET homepage_url = {q(KF_OLD['home'])}, domain = {q(KF_OLD['dom'])}, feed_status = {q(KF_OLD['status'])} WHERE id = 210;
  UPDATE feeds SET feed_url = {q(KF_OLD['feed'])} WHERE publisher_id = 210 AND feed_url = {q(KF_NEW['feed'])};
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
  RAISE NOTICE 'Reversed: removed % publishers, Kerr Fatou restored', array_length(pids, 1);
END $do$;
COMMIT;
"""

here = os.path.dirname(os.path.abspath(__file__))
for name, text in (('apply.sql', apply), ('rehearse.sql', apply.replace('\nCOMMIT;\n', '\nROLLBACK;\n')), ('reverse.sql', reverse)):
    with open(os.path.join(here, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
print('written: apply.sql rehearse.sql reverse.sql')
