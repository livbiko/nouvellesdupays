# Generates apply / rehearse / reverse SQL for Build #145: 20 RSS publishers for Oceania (FJ, SB, VU), Central America
# (NI, GT, HN, PA, SV) and the Caribbean (DO, HT, JM). Owner, 2026-11-03: "yes, add the 20". Same shape as Build #143.
import json, os

TAG = '[added by Claude 2026-11-03, Americas-Pacific 1]'
DAY = '2026-11-03'


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


def g(iso, name, slug, home, dom, feed, lang, st, check, desc, tags, hist, cur, own='Presse en ligne privée', owner='Non vérifié',
      ev='Propriétaire non vérifié pour ce profil.', conf='low'):
    return pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev)


IND = "Se présente comme média indépendant ; financement et propriétaire non vérifiés pour ce profil."
P = [
    g('FJ', 'Fiji One News', 'fiji-one-news', 'https://www.fijionenews.com.fj/', 'fijionenews.com.fj', 'https://www.fijionenews.com.fj/feed/', 'en',
      'TV', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'News site of Fiji One television.', ['commercial_generalist'],
      "Site d'information de la chaîne de télévision Fiji One.", 'Actualité fidjienne en anglais.', own='Télévision'),
    g('FJ', 'Islands Business', 'islands-business', 'https://islandsbusiness.com/', 'islandsbusiness.com', 'https://islandsbusiness.com/feed/', 'en',
      'ONLINE_NEWS', 'RSS 12 items, 12 in 3 days, newest 2026-11-03', 'Suva-based Pacific regional business and current-affairs magazine.',
      ['specialist'], 'Magazine régional du Pacifique basé à Suva (Fidji).',
      'Économie, politique régionale et climat dans les îles du Pacifique, en anglais.', own='Magazine privé'),
    g('SB', 'Island Sun', 'island-sun', 'https://www.theislandsun.com.sb/', 'theislandsun.com.sb', 'https://www.theislandsun.com.sb/feed/', 'en',
      'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Solomon Islands newspaper published in Honiara.',
      ['commercial_generalist'], 'Journal des Îles Salomon publié à Honiara.', 'Actualité nationale salomonaise en anglais.',
      own='Presse écrite privée'),
    g('SB', 'SIBC', 'sibc', 'https://www.sibconline.com.sb/', 'sibconline.com.sb', 'https://www.sibconline.com.sb/feed/', 'en',
      'RADIO', 'RSS 30 items, newest 2026-11-03', 'Solomon Islands Broadcasting Corporation, the national broadcaster.',
      ['public_state'], 'Solomon Islands Broadcasting Corporation, radiodiffuseur national des Îles Salomon.',
      'Actualité nationale et provinciale salomonaise en anglais.', own='Radiodiffuseur public',
      owner='Solomon Islands Broadcasting Corporation (État)', ev='Radiodiffuseur public ; gouvernance non vérifiée pour ce profil.',
      conf='medium'),
    g('VU', 'VBTC', 'vbtc', 'https://www.vbtc.vu/', 'vbtc.vu', 'https://www.vbtc.vu/feed/', 'en',
      'RADIO', 'RSS 10 items, newest 2026-10-30', 'Vanuatu Broadcasting and Television Corporation, the national broadcaster.',
      ['public_state'], 'Vanuatu Broadcasting and Television Corporation, radiodiffuseur national du Vanuatu.',
      'Actualité nationale du Vanuatu en anglais et en bichelamar.', own='Radiodiffuseur public',
      owner='VBTC (État du Vanuatu)', ev='Radiodiffuseur public ; gouvernance non vérifiée pour ce profil.', conf='medium'),
    g('NI', 'Despacho 505', 'despacho-505', 'https://www.despacho505.com/', 'despacho505.com', 'https://www.despacho505.com/feed/', 'es',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Independent Nicaraguan news outlet working from exile.',
      ['independent'], 'Média nicaraguayen indépendant travaillant depuis l’exil.',
      'Politique nicaraguayenne, droits humains et exil, en espagnol.', ev=IND),
    g('NI', 'Divergentes', 'divergentes', 'https://www.divergentes.com/', 'divergentes.com', 'https://www.divergentes.com/feed/', 'es',
      'ONLINE_NEWS', 'RSS 10 items, 8 in 3 days, newest 2026-11-03', 'Independent Nicaraguan news outlet working from exile.',
      ['independent'], 'Média nicaraguayen indépendant travaillant depuis l’exil (Costa Rica).',
      'Enquêtes et reportages sur le Nicaragua et sa diaspora, en espagnol.', ev=IND),
    g('GT', 'La Hora', 'la-hora-gt', 'https://lahora.gt/', 'lahora.gt', 'https://lahora.gt/feed/', 'es',
      'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Guatemalan newspaper published in Guatemala City.',
      ['commercial_generalist'], 'Journal guatémaltèque publié à Guatemala.', 'Actualité nationale guatémaltèque en espagnol.',
      own='Presse écrite privée'),
    g('GT', 'Prensa Comunitaria', 'prensa-comunitaria', 'https://www.prensacomunitaria.org/', 'prensacomunitaria.org',
      'https://www.prensacomunitaria.org/feed/', 'es', 'ONLINE_NEWS', 'RSS 12 items, 7 in 3 days, newest 2026-11-03',
      'Guatemalan community news outlet covering Indigenous peoples and territorial rights.', ['independent'],
      'Média communautaire guatémaltèque centré sur les peuples autochtones et les droits territoriaux.',
      'Droits autochtones, territoires, justice et Amérique centrale, en espagnol.', own='Média communautaire', ev=IND),
    g('HN', 'Hondudiario', 'hondudiario', 'https://hondudiario.com/', 'hondudiario.com', 'https://hondudiario.com/feed/', 'es',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Honduran online newspaper.',
      ['commercial_generalist'], 'Journal hondurien en ligne.', 'Actualité nationale hondurienne en espagnol.'),
    g('HN', 'Contra Corriente', 'contra-corriente', 'https://contracorriente.red/', 'contracorriente.red', 'https://contracorriente.red/feed/', 'es',
      'ONLINE_NEWS', 'RSS 15 items, newest 2026-11-03', 'Honduran independent investigative news outlet.',
      ['independent'], "Média d'investigation hondurien indépendant.",
      'Enquêtes, justice, droits humains et environnement au Honduras, en espagnol.', ev=IND),
    g('PA', 'En Segundos', 'en-segundos', 'https://www.ensegundos.com.pa/', 'ensegundos.com.pa', 'https://www.ensegundos.com.pa/feed/', 'es',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Panamanian online news site.',
      ['commercial_generalist'], "Site d'information panaméen en ligne.", 'Actualité panaméenne et internationale en espagnol.'),
    g('SV', 'Revista Factum', 'revista-factum', 'https://www.revistafactum.com/', 'revistafactum.com', 'https://www.revistafactum.com/feed/', 'es',
      'ONLINE_NEWS', 'RSS 15 items, newest 2026-11-02', 'Salvadoran independent investigative magazine.',
      ['independent'], "Magazine d'investigation salvadorien indépendant.",
      'Enquêtes, politique et droits humains au Salvador, en espagnol.', ev=IND),
    g('DO', 'El Nuevo Diario', 'el-nuevo-diario-do', 'https://www.elnuevodiario.com.do/', 'elnuevodiario.com.do',
      'https://www.elnuevodiario.com.do/feed/', 'es', 'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
      'Dominican daily newspaper published in Santo Domingo.', ['commercial_generalist'],
      'Quotidien dominicain publié à Saint-Domingue.', 'Actualité nationale dominicaine en espagnol.', own='Presse écrite privée'),
    g('DO', 'elDinero', 'eldinero', 'https://www.eldinero.com.do/', 'eldinero.com.do', 'https://www.eldinero.com.do/feed/', 'es',
      'ONLINE_NEWS', 'RSS 20 items, 20 in 3 days, newest 2026-11-03', 'Dominican business and economics news outlet.',
      ['specialist'], "Média dominicain d'information économique.", 'Économie, finances et entreprises en République dominicaine, en espagnol.'),
    g('HT', 'AlterPresse', 'alterpresse', 'https://www.alterpresse.org/', 'alterpresse.org', 'https://www.alterpresse.org/spip.php?page=backend', 'fr',
      'NEWS_AGENCY', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Haitian news agency based in Port-au-Prince.',
      ['independent'], "Agence d'information haïtienne basée à Port-au-Prince.",
      'Actualité politique, sociale et sécuritaire haïtienne en français.', own='Agence de presse privée', ev=IND),
    g('HT', 'Juno7', 'juno7', 'https://www.juno7.ht/', 'juno7.ht', 'https://www.juno7.ht/feed/', 'fr',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Haitian online news site.',
      ['commercial_generalist'], "Site d'information haïtien en ligne.", 'Actualité haïtienne en français.'),
    g('HT', 'Rezo Nòdwès', 'rezo-nodwes', 'https://www.rezonodwes.com/', 'rezonodwes.com', 'https://www.rezonodwes.com/feed/', 'fr',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Haitian online news site.',
      ['commercial_generalist'], "Site d'information haïtien en ligne.", 'Actualité haïtienne et de la diaspora en français.'),
    g('JM', 'The Gleaner', 'the-gleaner', 'https://jamaica-gleaner.com/', 'jamaica-gleaner.com', 'https://jamaica-gleaner.com/feed/rss.xml', 'en',
      'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Jamaican daily newspaper published in Kingston.',
      ['commercial_generalist'], 'Quotidien jamaïcain publié à Kingston.', 'Actualité nationale jamaïcaine en anglais.',
      own='Presse écrite privée'),
    g('JM', 'Jamaica Information Service', 'jis-jamaica', 'https://www.jis.gov.jm/', 'jis.gov.jm', 'https://www.jis.gov.jm/feed/', 'en',
      'NEWS_AGENCY', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Government information agency of Jamaica.',
      ['public_state'], "Jamaica Information Service, agence d'information du gouvernement jamaïcain.",
      'Communiqués et actualité gouvernementale jamaïcaine en anglais.', own='Agence gouvernementale',
      owner='Gouvernement de la Jamaïque', ev="Service d'information gouvernemental ; contenu institutionnel.", conf='medium'),
]

assert len(P) == 20
slugs = ','.join(q(p['slug']) for p in P)
doms = ','.join(q(p['dom']) for p in P)
feeds = ','.join(q(p['feed']) for p in P)


def block(p):
    srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
    detail = f"Added on owner approval {DAY} (country at 1-2 live publishers); {p['check']} {TAG}"
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


apply = f"""-- GENERATED by Build-Sql.py. Build #145 (MEDIUM): 20 RSS publishers for FJ, SB, VU, NI, GT, HN, PA, SV, DO, HT, JM.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the twenty is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('rezo-nodwes', 'divergentes', 'sibc') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #145 (all tables with a FK to publishers, children first).
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
