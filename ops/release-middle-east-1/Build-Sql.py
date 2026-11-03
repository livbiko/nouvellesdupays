# Generates apply / rehearse / reverse SQL for Build #144: first worldwide batch (Middle East) -- 13 RSS/Atom
# publishers for SA, JO, BH, KW, QA, PS, SY, YE plus reviving Arab News (feed 1036: 403 since 07-26, now 200 to the bot
# UA but stuck in the 24 h backoff). Owner, 2026-11-03: "yes, add the 14 and revive Arab News" -- the proposal table
# listed 13 new publishers (my miscount); exactly the listed ones are added. Same shape as Build #143.
import json, os

TAG = '[added by Claude 2026-11-03, Middle East 1]'
DAY = '2026-11-03'
ARAB_NEWS_FEED = 1036


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, hist, cur, ev, conf='low'):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


P = [
    pub('SA', 'Okaz', 'okaz', 'https://www.okaz.com.sa/', 'okaz.com.sa', 'https://www.okaz.com.sa/rssFeed/0', 'ar', 'NEWSPAPER',
        'RSS 50 items, 50 in 3 days, newest 2026-11-03', 'Saudi Arabic-language daily newspaper published in Jeddah.',
        'Presse écrite privée', 'Okaz Organization for Press and Publication (non vérifié)', ['commercial_generalist'],
        'Quotidien saoudien de langue arabe publié à Djeddah.',
        'Actualité saoudienne, régionale et internationale en arabe.',
        "Quotidien privé dans un environnement médiatique saoudien étroitement encadré ; propriétaire non vérifié pour ce profil."),
    pub('JO', 'Roya News', 'roya-news', 'https://www.royanews.tv/', 'royanews.tv', 'https://www.royanews.tv/rss', 'ar', 'TV',
        'Atom 25 entries, newest 2026-11-04', 'News site of Roya TV, a private Jordanian television channel.',
        'Télévision privée', 'Roya Media Group (non vérifié)', ['commercial_generalist'],
        "Site d'information de la chaîne de télévision privée jordanienne Roya.",
        'Actualité jordanienne, régionale et internationale en arabe.',
        'Chaîne privée ; propriétaire non vérifié pour ce profil.'),
    pub('BH', 'Al Bilad', 'al-bilad-bahrain', 'https://www.albiladpress.com/', 'albiladpress.com', 'https://www.albiladpress.com/rss', 'ar',
        'NEWSPAPER', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Bahraini Arabic-language daily newspaper.',
        'Presse écrite privée', 'Non vérifié', ['commercial_generalist'],
        'Quotidien bahreïni de langue arabe.',
        'Actualité bahreïnie et du Golfe en arabe.',
        'Quotidien privé dans un environnement médiatique étroitement encadré ; propriétaire non vérifié pour ce profil.'),
    pub('KW', 'Arab Times', 'arab-times', 'https://www.arabtimesonline.com/', 'arabtimesonline.com', 'https://www.arabtimesonline.com/rssFeed/0/',
        'en', 'NEWSPAPER', 'RSS 100 items, 100 in 3 days, newest 2026-11-03', 'Kuwaiti English-language daily newspaper.',
        'Presse écrite privée', 'Non vérifié', ['commercial_generalist'],
        'Quotidien koweïtien de langue anglaise.',
        'Actualité koweïtienne et du Golfe en anglais, avec une large place pour les communautés expatriées.',
        'Quotidien privé ; propriétaire non vérifié pour ce profil.'),
    pub('KW', 'Al Rai', 'al-rai', 'https://www.alraimedia.com/', 'alraimedia.com', 'https://www.alraimedia.com/rssFeed/0/', 'ar',
        'NEWSPAPER', 'RSS 50 items, 50 in 3 days, newest 2026-11-04', 'Kuwaiti Arabic-language daily newspaper.',
        'Presse écrite privée', 'Non vérifié', ['commercial_generalist'],
        'Quotidien koweïtien de langue arabe.',
        'Actualité koweïtienne, régionale et internationale en arabe.',
        'Quotidien privé ; propriétaire non vérifié pour ce profil.'),
    pub('QA', 'Gulf Times', 'gulf-times', 'https://www.gulf-times.com/', 'gulf-times.com', 'https://www.gulf-times.com/rssFeed/8', 'en',
        'NEWSPAPER', 'RSS Qatar section, 100 items, newest 2026-11-04', 'Qatari English-language daily newspaper (Qatar section feed).',
        'Presse écrite privée', 'Non vérifié', ['commercial_generalist'],
        'Quotidien qatari de langue anglaise ; flux de la rubrique Qatar.',
        'Actualité nationale qatarie en anglais.',
        'Quotidien privé dans un environnement médiatique encadré ; propriétaire non vérifié pour ce profil.'),
    pub('PS', 'Al-Quds', 'al-quds', 'https://www.alquds.com/', 'alquds.com', 'https://www.alquds.com/ar/rss', 'ar', 'NEWSPAPER',
        'RSS 30 items, 30 in 3 days, newest 2026-11-03', 'Palestinian Arabic-language daily newspaper published in Jerusalem.',
        'Presse écrite privée', 'Non vérifié', ['commercial_generalist'],
        'Quotidien palestinien de langue arabe publié à Jérusalem.',
        'Actualité palestinienne, régionale et internationale en arabe.',
        'Quotidien privé ; propriétaire non vérifié pour ce profil.'),
    pub('SY', 'Enab Baladi', 'enab-baladi', 'https://www.enabbaladi.net/', 'enabbaladi.net', 'https://www.enabbaladi.net/feed/', 'ar',
        'ONLINE_NEWS', 'RSS 19 items, 19 in 3 days, newest 2026-11-03', 'Syrian independent news outlet founded in 2011.',
        'Média indépendant', 'Non vérifié', ['independent'],
        'Média syrien fondé en 2011 à Daraya pendant le soulèvement.',
        'Actualité politique, humanitaire et sociale syrienne en arabe.',
        'Se présente comme média indépendant ; financement et gouvernance non vérifiés pour ce profil.'),
    pub('SY', 'Syria TV', 'syria-tv', 'https://www.syria.tv/', 'syria.tv', 'https://www.syria.tv/rss', 'ar', 'TV',
        'RSS 110 items, 110 in 3 days, newest 2026-11-04', 'Syrian television channel and news site founded by opposition figures.',
        'Télévision privée', 'Non vérifié (financement qatari rapporté, non vérifié)', ['editorially_mixed'],
        "Chaîne de télévision syrienne lancée par des figures de l'opposition ; financement qatari rapporté (non vérifié).",
        'Actualité syrienne en arabe : gouvernance, sécurité, société.',
        "Origine liée à l'opposition ; financement et ligne actuelle non vérifiés pour ce profil."),
    pub('SY', 'North Press Agency', 'north-press-agency', 'https://npasyria.com/en/', 'npasyria.com', 'https://npasyria.com/en/feed/', 'en',
        'NEWS_AGENCY', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'News agency based in Qamishli, north-east Syria.',
        'Agence de presse privée', 'Non vérifié', ['unknown'],
        'Agence de presse basée à Qamichli, dans le nord-est de la Syrie.',
        'Actualité du nord-est syrien et de la Syrie en anglais.',
        "Basée dans la zone sous administration autonome du nord-est ; propriétaire et ligne non vérifiés pour ce profil."),
    pub('SY', 'Al-Watan Syria', 'al-watan-syria', 'https://www.alwatan.sy/', 'alwatan.sy', 'https://www.alwatan.sy/feed', 'ar', 'NEWSPAPER',
        'RSS 30 items, 30 in 3 days, newest 2026-11-03', 'Syrian Arabic-language daily newspaper published in Damascus.',
        'Presse écrite privée', 'Non vérifié', ['editorially_mixed'],
        "Quotidien privé de Damas, historiquement proche du pouvoir sous l'ancien régime.",
        'Actualité syrienne en arabe : services publics, économie, régions.',
        'Historiquement pro-gouvernemental ; propriétaire et ligne actuels non vérifiés pour ce profil.'),
    pub('YE', 'Yemen Shabab', 'yemen-shabab', 'https://yemenshabab.net/', 'yemenshabab.net', 'https://yemenshabab.net/rss', 'ar', 'TV',
        'RSS 150 items, 32 in 3 days, newest 2026-11-03', 'Yemeni television channel and news site.',
        'Télévision privée', 'Non vérifié', ['unknown'],
        'Chaîne de télévision yéménite, rapportée proche du parti Islah (non vérifié).',
        'Actualité yéménite en arabe : guerre, sécurité, gouvernement.',
        'Proximité rapportée avec le parti Islah ; propriétaire et ligne non vérifiés pour ce profil.'),
    pub('YE', 'Yemen Online', 'yemen-online', 'https://www.yemenonline.info/', 'yemenonline.info', 'https://www.yemenonline.info/feed', 'en',
        'ONLINE_NEWS', 'RSS 21 items, 21 in 3 days, newest 2026-11-03', 'Yemeni English-language online news site.',
        'Presse en ligne', 'Non vérifié', ['unknown'],
        "Site d'information yéménite en anglais.",
        'Actualité yéménite et régionale en anglais.',
        'Propriétaire et ligne non vérifiés pour ce profil.'),
]

assert len(P) == 13
slugs = ','.join(q(p['slug']) for p in P)
doms = ','.join(q(p['dom']) for p in P)
feeds = ','.join(q(p['feed']) for p in P)


def block(p):
    srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
    detail = f"Added on owner approval {DAY} (country below 3 live publishers); {p['check']} {TAG}"
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


apply = f"""-- GENERATED by Build-Sql.py. Build #144 (MEDIUM): 13 publishers for SA, JO, BH, KW, QA, PS, SY, YE + Arab News revived.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the thirteen is already present - nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = {ARAB_NEWS_FEED} AND feed_url = 'https://www.arabnews.com/rss.xml') THEN
    RAISE EXCEPTION 'Arab News feed {ARAB_NEWS_FEED} is not what was checked - nothing changed';
  END IF;{''.join(block(p) for p in P)}
  -- Arab News: feed answered 403 from 2026-07-26; now 200 with 50 items to the bot UA. Never succeeded, so it sits in
  -- the 24 h backoff; resetting the failure count makes the next run retry it (as for Kerr Fatou, Build #133).
  UPDATE feeds SET consecutive_failures = 0 WHERE id = {ARAB_NEWS_FEED};
  RAISE NOTICE 'Arab News feed {ARAB_NEWS_FEED}: consecutive_failures reset';
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('syria-tv', 'al-watan-syria', 'roya-news') ORDER BY 1;
SELECT id, feed_url, consecutive_failures FROM feeds WHERE id = {ARAB_NEWS_FEED};
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #144 (all tables with a FK to publishers, children first).
-- The Arab News failure-count reset is not reversed (the worker recounts on its own).
\\set ON_ERROR_STOP on
BEGIN;
DO $do$
DECLARE pids integer[];
BEGIN
  SELECT array_agg(id) INTO pids FROM publishers WHERE slug IN ({slugs}) AND domain IN ({doms});
  IF pids IS NULL THEN RAISE NOTICE 'Nothing to reverse'; RETURN; END IF;
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
