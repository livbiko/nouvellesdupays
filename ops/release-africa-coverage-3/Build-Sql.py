# Generates apply / rehearse / reverse SQL for Build #140: 13 RSS publishers for 10 African countries below
# 5 live publishers. Owner, 2026-11-03: "yes, add the 12" -- the proposal table listed 13, my miscount (optional DataCameroon / Yabiladi / Namibia Economist /
# Mwebantu not taken). Feeds checked from dr-rke2 with the bot UA on 2026-11-03. Same shape as Build #132.
import json, os

TAG = '[added by Claude 2026-11-03, Africa coverage 3]'
DAY = '2026-11-03'


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


P = [
    pub('CM', 'Le Bled Parle', 'le-bled-parle', 'https://lebledparle.com/', 'lebledparle.com', 'https://lebledparle.com/feed/', 'fr',
        'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Cameroonian online news site (politics, society, sport).',
        'Presse en ligne privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d’information camerounais en ligne.',
        'Actualité politique, sociale et sportive camerounaise en français, dont des synthèses quotidiennes.',
        'Site privé d’actualité générale ; propriétaires non vérifiés pour ce profil.'),
    pub('CM', 'Mimi Mefo Info', 'mimi-mefo-info', 'https://mimimefoinfos.com/', 'mimimefoinfos.com', 'https://mimimefoinfos.com/feed/', 'en',
        'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-03',
        'Cameroonian online news outlet (MMI News) founded by journalist Mimi Mefo.',
        'Presse en ligne privée', 'Mimi Mefo (fondatrice) – non vérifié', ['independent'], 'low',
        'Média en ligne fondé par la journaliste camerounaise Mimi Mefo.',
        'Actualité camerounaise en anglais, notamment justice, droits humains et régions anglophones.',
        'Se présente comme média indépendant ; indépendance et actionnariat non vérifiés pour ce profil.'),
    pub('ET', 'The Reporter Ethiopia', 'the-reporter-ethiopia', 'https://www.thereporterethiopia.com/', 'thereporterethiopia.com',
        'https://www.thereporterethiopia.com/feed/', 'en', 'NEWSPAPER', 'RSS 10 items, 4 in 3 days, newest 2026-11-02',
        'English-language weekly newspaper published in Addis Ababa.',
        'Presse écrite privée', 'Media & Communications Center (non vérifié)', ['commercial_generalist'], 'low',
        'Hebdomadaire anglophone d’Addis-Abeba.',
        'Économie, politique et société éthiopiennes en anglais.',
        'Hebdomadaire privé ; propriétaire non vérifié pour ce profil.'),
    pub('ET', 'Capital Ethiopia', 'capital-ethiopia', 'https://capitalethiopia.com/', 'capitalethiopia.com',
        'https://capitalethiopia.com/feed/', 'en', 'NEWSPAPER', 'RSS 4 items, 4 in 3 days, newest 2026-11-03',
        'English-language business weekly published in Addis Ababa.',
        'Presse écrite privée', 'Non vérifié', ['specialist'], 'low',
        'Hebdomadaire économique anglophone d’Addis-Abeba.',
        'Économie, finances et commerce en Éthiopie et dans la Corne de l’Afrique.',
        'Hebdomadaire économique privé ; propriétaire non vérifié pour ce profil.'),
    pub('DZ', 'Ennahar Online', 'ennahar-online', 'https://www.ennaharonline.com/', 'ennaharonline.com',
        'https://www.ennaharonline.com/feed/', 'ar', 'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Arabic-language Algerian news site of the Ennahar media group.',
        'Groupe de presse privé', 'Groupe Ennahar (non vérifié)', ['editorially_mixed'], 'low',
        'Site du groupe médiatique privé Ennahar (quotidien et chaîne de télévision).',
        'Actualité nationale algérienne en arabe (gouvernement, société, faits divers).',
        'Groupe privé souvent décrit comme proche du pouvoir ; ligne éditoriale non vérifiée pour ce profil.'),
    pub('LY', 'Libya Update', 'libya-update', 'https://libyaupdate.com/', 'libyaupdate.com', 'https://libyaupdate.com/feed/', 'en',
        'ONLINE_NEWS', 'RSS 10 items, 7 in 3 days, newest 2026-11-03',
        'English-language Libyan news site.',
        'Presse en ligne', 'Non vérifié', ['unknown'], 'low',
        'Site d’information libyen en anglais.',
        'Actualité libyenne en anglais, avec une large couverture des autorités et forces de l’Est (Haftar).',
        'La couverture suggère une proximité avec les autorités de l’Est ; propriétaire et ligne non vérifiés pour ce profil.'),
    pub('ZM', 'Times of Zambia', 'times-of-zambia', 'https://www.times.co.zm/', 'times.co.zm', 'https://www.times.co.zm/?feed=rss2', 'en',
        'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'State-owned national daily newspaper of Zambia.',
        'Presse publique (propriété de l’État)', 'Gouvernement de la Zambie', ['public_state'], 'medium',
        'Quotidien national zambien appartenant à l’État.',
        'Actualité nationale zambienne en anglais.',
        'Quotidien public ; gouvernance non vérifiée pour ce profil.'),
    pub('ZM', 'Zambia Monitor', 'zambia-monitor', 'https://zambiamonitor.com/', 'zambiamonitor.com', 'https://zambiamonitor.com/feed/', 'en',
        'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Zambian online news site focused on business and economy.',
        'Presse en ligne privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d’information zambien en ligne.',
        'Économie, finances et politique zambiennes en anglais.',
        'Site privé ; propriétaire non vérifié pour ce profil.'),
    pub('ZA', 'The Citizen', 'the-citizen-za', 'https://www.citizen.co.za/', 'citizen.co.za', 'https://www.citizen.co.za/feed/', 'en',
        'NEWSPAPER', 'RSS 75 items, 75 in 3 days, newest 2026-11-03',
        'South African daily newspaper and news site based in Johannesburg.',
        'Presse écrite privée', 'Caxton & CTP Publishers (non vérifié)', ['commercial_generalist'], 'medium',
        'Quotidien sud-africain de Johannesburg.',
        'Actualité nationale sud-africaine, politique, économie et sport en anglais.',
        'Quotidien privé ; propriétaire indiqué non vérifié pour ce profil.'),
    pub('MA', 'LesEco.ma', 'leseco-ma', 'https://www.leseco.ma/', 'leseco.ma', 'https://www.leseco.ma/feed/', 'fr',
        'NEWSPAPER', 'RSS 50 items, 50 in 3 days, newest 2026-11-03',
        'Moroccan French-language business daily (Les Inspirations ÉCO).',
        'Presse écrite privée', 'Non vérifié', ['specialist'], 'low',
        'Quotidien économique marocain francophone.',
        'Économie, entreprises et politique marocaines et internationales en français.',
        'Quotidien économique privé ; propriétaire non vérifié pour ce profil.'),
    pub('NA', 'Windhoek Observer', 'windhoek-observer', 'https://www.observer24.com.na/', 'observer24.com.na',
        'https://www.observer24.com.na/feed/', 'en', 'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Namibian newspaper published in Windhoek.',
        'Presse écrite privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Journal namibien de Windhoek.',
        'Actualité nationale namibienne, économie et politique en anglais.',
        'Journal privé ; propriétaire non vérifié pour ce profil.'),
    pub('MW', 'Malawi Voice', 'malawi-voice', 'https://malawivoice.com/', 'malawivoice.com', 'https://malawivoice.com/feed/', 'en',
        'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Malawian online news site.',
        'Presse en ligne', 'Non vérifié', ['unknown'], 'low',
        'Site d’information malawite en ligne.',
        'Actualité politique, sportive et sociale malawite en anglais.',
        'Réputation de site partisan ; ligne et propriétaire non vérifiés pour ce profil.'),
    pub('RW', 'Kigali Today', 'kigali-today', 'https://www.kigalitoday.com/', 'kigalitoday.com',
        'https://www.kigalitoday.com/spip.php?page=backend', 'rw', 'ONLINE_NEWS', 'RSS 200 items, 23 in 3 days, newest 2026-11-03',
        'Rwandan news site publishing mainly in Kinyarwanda.',
        'Presse en ligne privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d’information rwandais, principalement en kinyarwanda.',
        'Actualité nationale et régionale rwandaise en kinyarwanda.',
        'Site privé ; propriétaire non vérifié pour ce profil.'),
]

assert len(P) == 13
slugs = ','.join(q(p['slug']) for p in P)
doms = ','.join(q(p['dom']) for p in P)
feeds = ','.join(q(p['feed']) for p in P)


def block(p):
    srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
    detail = f"Added on owner approval {DAY} (country below 5 live publishers); {p['check']} {TAG}"
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


apply = f"""-- GENERATED by Build-Sql.py. Build #140 (MEDIUM): 13 RSS publishers for CM, ET, DZ, LY, ZM, ZA, MA, NA, MW, RW.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the thirteen is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('le-bled-parle', 'capital-ethiopia', 'leseco-ma') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #140 (all tables with a FK to publishers, children first).
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
