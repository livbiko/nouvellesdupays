# Generates apply / rehearse / reverse SQL for Build #143: 8 RSS publishers for AO, DZ, LY, BI, ET (countries below 5,
# or ET whose English Reporter feed answers 304). Owner, 2026-11-03: "yes, add the 8". Same shape as Build #142.
import json, os

TAG = '[added by Claude 2026-11-03, Africa coverage 5]'
DAY = '2026-11-03'


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


P = [
    pub('AO', 'Correio da Kianda', 'correio-da-kianda', 'https://www.correiokianda.info/', 'correiokianda.info',
        'https://www.correiokianda.info/feed/', 'pt', 'ONLINE_NEWS', 'RSS 11 items, 11 in 3 days, newest 2026-11-03',
        'Angolan online news site.',
        'Presse en ligne privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d’information angolais en ligne.',
        'Actualité angolaise et internationale en portugais.',
        'Site privé ; propriétaire non vérifié pour ce profil.'),
    pub('AO', 'Mercado', 'mercado-ao', 'https://www.mercado.co.ao/', 'mercado.co.ao', 'https://www.mercado.co.ao/feed', 'pt',
        'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Angolan business weekly newspaper.',
        'Presse écrite privée', 'Non vérifié', ['specialist'], 'low',
        'Hebdomadaire économique angolais.',
        'Économie, entreprises et finances angolaises en portugais.',
        'Hebdomadaire privé ; propriétaire non vérifié pour ce profil.'),
    pub('DZ', 'Algérie Eco', 'algerie-eco', 'https://www.algerie-eco.com/', 'algerie-eco.com', 'https://www.algerie-eco.com/feed/', 'fr',
        'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Algerian French-language economic news site.',
        'Presse en ligne privée', 'Non vérifié', ['specialist'], 'low',
        'Site d’information économique algérien.',
        'Économie, énergie et entreprises en Algérie, en français.',
        'Site privé ; propriétaire non vérifié pour ce profil.'),
    pub('DZ', 'Algérie Patriotique', 'algerie-patriotique', 'https://www.algeriepatriotique.com/', 'algeriepatriotique.com',
        'https://www.algeriepatriotique.com/feed/', 'fr', 'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Algerian French-language online news and opinion site.',
        'Presse en ligne privée', 'Non vérifié (fondation attribuée à Lotfi Nezzar, non vérifiée)', ['editorially_mixed'], 'low',
        'Site d’information et d’opinion algérien ; sa fondation est attribuée à Lotfi Nezzar, fils du général Khaled Nezzar (non vérifié).',
        'Politique nationale et diplomatie algériennes en français, ligne nationaliste marquée, très critique envers la France.',
        'Ligne éditoriale nationaliste et polémique ; propriétaire et liens attribués non vérifiés pour ce profil.'),
    pub('LY', 'Al Marsad', 'al-marsad', 'https://almarsad.co/', 'almarsad.co', 'https://almarsad.co/feed/', 'ar',
        'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Libyan Arabic-language online newspaper.',
        'Presse en ligne', 'Non vérifié', ['unknown'], 'low',
        'Journal libyen en ligne de langue arabe.',
        'Actualité libyenne, régionale et culturelle en arabe.',
        'Alignement politique et propriétaire non établis pour ce profil.'),
    pub('LY', 'Ean Libya', 'ean-libya', 'https://www.eanlibya.com/', 'eanlibya.com', 'https://www.eanlibya.com/feed/', 'ar',
        'ONLINE_NEWS', 'RSS 14 items, 14 in 3 days, newest 2026-11-03',
        'Libyan Arabic-language news site (Ean Libya).',
        'Presse en ligne', 'Non vérifié', ['unknown'], 'low',
        'Site d’information libyen de langue arabe.',
        'Actualité politique, économique et juridique libyenne en arabe.',
        'Alignement politique et propriétaire non établis pour ce profil.'),
    pub('BI', 'ABP Burundi', 'abp-burundi', 'https://www.abpinfo.bi/', 'abpinfo.bi', 'https://www.abpinfo.bi/feed/', 'fr',
        'NEWS_AGENCY', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Agence Burundaise de Presse, the national news agency of Burundi.',
        'Agence de presse publique', 'État burundais', ['public_state'], 'medium',
        'Agence Burundaise de Presse (ABP), agence de presse nationale du Burundi.',
        'Actualité institutionnelle et nationale burundaise en français.',
        'Agence publique ; gouvernance non vérifiée pour ce profil.'),
    pub('ET', 'The Reporter (Amharic)', 'the-reporter-amharic', 'https://www.ethiopianreporter.com/', 'ethiopianreporter.com',
        'https://www.ethiopianreporter.com/feed/', 'am', 'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-01',
        'Amharic-language edition of The Reporter, Addis Ababa.',
        'Presse écrite privée', 'Media & Communications Center (non vérifié)', ['commercial_generalist'], 'low',
        'Édition en amharique de The Reporter, journal d’Addis-Abeba (même éditeur que l’édition anglaise).',
        'Actualité éthiopienne en amharique : politique, économie, société, sport.',
        'Journal privé ; propriétaire non vérifié pour ce profil.'),
]

assert len(P) == 8
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


apply = f"""-- GENERATED by Build-Sql.py. Build #143 (MEDIUM): 8 RSS publishers for AO, DZ, LY, BI, ET.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the eight is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('algerie-patriotique', 'abp-burundi', 'the-reporter-amharic') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #143 (all tables with a FK to publishers, children first).
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
