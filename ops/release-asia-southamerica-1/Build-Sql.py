# Generates apply / rehearse / reverse SQL for Build #146: 16 RSS publishers for Southeast Asia (LA, MO, MY, TL) and
# South America (BO, CL, EC, PY). Owner, 2026-11-04: "YES" to "add the 16". Same shape as Build #145.
import json, os

TAG = '[added by Claude 2026-11-03, Asia-South America 1]'
DAY = '2026-11-04'


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
    g('LA', 'Lao Economic Daily', 'lao-economic-daily', 'https://www.laoedaily.com.la/', 'laoedaily.com.la', 'https://www.laoedaily.com.la/feed/', 'lo',
      'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Lao-language economic daily newspaper, Vientiane.',
      ['specialist'], 'Quotidien économique laotien de langue lao, Vientiane.',
      'Économie, commerce et actualité laotienne et régionale en lao.', own='Presse écrite'),
    g('BO', 'eju.tv', 'eju-tv', 'https://eju.tv/', 'eju.tv', 'https://eju.tv/feed/', 'es',
      'ONLINE_NEWS', 'RSS 4 items, 4 in 3 days, newest 2026-11-03', 'Bolivian online news site based in Santa Cruz.',
      ['commercial_generalist'], "Site d'information bolivien basé à Santa Cruz.", 'Actualité nationale bolivienne en espagnol.'),
    g('BO', 'La Patria', 'la-patria-bo', 'https://www.lapatria.bo/', 'lapatria.bo', 'https://www.lapatria.bo/feed/', 'es',
      'NEWSPAPER', 'RSS 100 items, 100 in 3 days, newest 2026-11-03', 'Daily newspaper published in Oruro, Bolivia.',
      ['commercial_generalist'], 'Quotidien publié à Oruro (Bolivie).', 'Actualité régionale (Oruro) et nationale bolivienne en espagnol.',
      own='Presse écrite privée'),
    g('BO', 'INFODECOM', 'infodecom', 'https://www.infodecom.net/', 'infodecom.net', 'https://www.infodecom.net/feed/', 'es',
      'ONLINE_NEWS', 'RSS 10 items, 4 in 3 days, newest 2026-11-03', 'Bolivian Catholic news and communication service.',
      ['specialist'], "Service d'information catholique bolivien.", "Actualité de l'Église et société bolivienne en espagnol.",
      own='Média religieux', owner="Non vérifié (lié à l'Église catholique bolivienne)",
      ev="Média d'inspiration catholique ; propriétaire exact non vérifié pour ce profil."),
    g('MO', 'Hoje Macau', 'hoje-macau', 'https://hojemacau.com.mo/', 'hojemacau.com.mo', 'https://hojemacau.com.mo/feed/', 'pt',
      'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Portuguese-language daily newspaper in Macau.',
      ['commercial_generalist'], 'Quotidien de langue portugaise de Macao.', 'Actualité de Macao, de Chine et du monde lusophone en portugais.',
      own='Presse écrite privée'),
    g('CL', 'Radio Universidad de Chile', 'radio-uchile', 'https://radio.uchile.cl/', 'radio.uchile.cl', 'https://radio.uchile.cl/feed/', 'es',
      'RADIO', 'RSS 30 items, 30 in 3 days, newest 2026-11-03', 'Radio and news outlet of the University of Chile.',
      ['public_state'], "Radio et site d'information de l'Université du Chili (université publique).",
      'Politique, société, culture et économie chiliennes en espagnol.', own='Média universitaire public',
      owner='Universidad de Chile', ev="Média d'une université publique ; gouvernance éditoriale non vérifiée pour ce profil.", conf='medium'),
    g('CL', 'Cooperativa', 'cooperativa', 'https://www.cooperativa.cl/', 'cooperativa.cl',
      'https://www.cooperativa.cl/noticias/site/tax/port/all/rss_3___1.xml', 'es',
      'RADIO', 'RSS 15 items, 15 in 3 days, newest 2026-11-03', 'Chilean news radio station and website (Radio Cooperativa).',
      ['commercial_generalist'], "Radio Cooperativa, station d'information chilienne.", 'Actualité nationale et internationale chilienne en espagnol.',
      own='Radio privée'),
    g('EC', 'La República EC', 'la-republica-ec', 'https://www.larepublica.ec/', 'larepublica.ec', 'https://www.larepublica.ec/feed/', 'es',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Ecuadorian online news site.',
      ['commercial_generalist'], "Site d'information équatorien en ligne.", 'Politique, économie et actualité équatoriennes en espagnol.'),
    g('PY', 'El Nacional', 'el-nacional-py', 'https://www.elnacional.com.py/', 'elnacional.com.py', 'https://www.elnacional.com.py/feed/', 'es',
      'NEWSPAPER', 'RSS 65 items, 56 in 3 days, newest 2026-11-03', 'Paraguayan newspaper published in Asunción.',
      ['commercial_generalist'], 'Journal paraguayen publié à Asunción.', 'Actualité nationale paraguayenne en espagnol.',
      own='Presse écrite privée'),
    g('MY', 'New Straits Times', 'new-straits-times', 'https://www.nst.com.my/', 'nst.com.my', 'https://www.nst.com.my/feed', 'en',
      'NEWSPAPER', 'RSS 50 items, 50 in 3 days, newest 2026-11-04', 'English-language Malaysian daily newspaper, Kuala Lumpur.',
      ['commercial_generalist'], 'Quotidien malaisien de langue anglaise, Kuala Lumpur.', 'Actualité nationale malaisienne en anglais.',
      own='Presse écrite privée', owner='Non vérifié (rattachement au groupe Media Prima non vérifié)'),
    g('MY', 'The Sun', 'the-sun-my', 'https://thesun.my/', 'thesun.my', 'https://thesun.my/rss', 'en',
      'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'English-language Malaysian newspaper.',
      ['commercial_generalist'], 'Journal malaisien de langue anglaise.', 'Actualité malaisienne et internationale en anglais.',
      own='Presse écrite privée'),
    g('MY', 'Malaysiakini', 'malaysiakini', 'https://www.malaysiakini.com/', 'malaysiakini.com', 'https://www.malaysiakini.com/rss/en/news.rss', 'en',
      'ONLINE_NEWS', 'RSS 11 items, 11 in 3 days, newest 2026-11-04', 'Independent Malaysian online news outlet.',
      ['independent'], 'Média malaisien indépendant en ligne.', 'Politique, gouvernance et société malaisiennes en anglais.', ev=IND),
    g('MY', 'MalaysiaNow', 'malaysianow', 'https://www.malaysianow.com/', 'malaysianow.com', 'https://www.malaysianow.com/feed', 'en',
      'ONLINE_NEWS', 'RSS 10 items, 2 in 3 days, newest 2026-11-03', 'Malaysian online news site.',
      ['commercial_generalist'], "Site d'information malaisien en ligne.", 'Actualité et analyses malaisiennes en anglais.'),
    g('MY', 'CodeBlue', 'codeblue', 'https://codeblue.galencentre.org/', 'codeblue.galencentre.org', 'https://codeblue.galencentre.org/feed/', 'en',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Malaysian health news outlet published by the Galen Centre for Health and Social Policy.',
      ['specialist'], "Média malaisien d'information santé, publié par le Galen Centre for Health and Social Policy.",
      'Santé publique et politiques de santé en Malaisie, en anglais.', own='Média associatif',
      owner='Galen Centre for Health and Social Policy (non vérifié)'),
    g('TL', 'Timor Post', 'timor-post', 'https://www.timorpost.com/', 'timorpost.com', 'https://www.timorpost.com/feed/', 'en',
      'NEWSPAPER', 'RSS 35 items, 9 in 3 days, newest 2026-11-04', 'Timor-Leste newspaper, Dili.',
      ['commercial_generalist'], 'Journal du Timor-Leste, Dili.', 'Actualité nationale timoraise en anglais.', own='Presse écrite privée'),
    g('TL', 'Tatoli (Tetum)', 'tatoli-tetum', 'https://www.tatoli.tl/', 'tatoli.tl', 'https://www.tatoli.tl/feed/', 'tet',
      'NEWS_AGENCY', 'RSS 10 items, 9 in 3 days, newest 2026-11-03', 'Tetum-language edition of Tatoli, the national news agency of Timor-Leste.',
      ['public_state'], "Édition en tétoum de Tatoli, agence de presse nationale du Timor-Leste (l'édition anglaise est déjà suivie).",
      'Actualité institutionnelle et nationale timoraise en tétoum.', own='Agence de presse publique',
      owner='État du Timor-Leste', ev='Agence publique ; gouvernance non vérifiée pour ce profil.', conf='medium'),
]

assert len(P) == 16
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


apply = f"""-- GENERATED by Build-Sql.py. Build #146 (MEDIUM): 16 RSS publishers for LA, BO, MO, CL, EC, PY, MY, TL.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the sixteen is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('infodecom', 'malaysiakini', 'tatoli-tetum') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #146 (all tables with a FK to publishers, children first).
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
