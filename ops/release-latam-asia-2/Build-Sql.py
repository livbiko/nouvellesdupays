# Generates apply / rehearse / reverse SQL for Build #150: 19 RSS publishers for Latin America (MX, BR, AR, CO, PE),
# Southeast Asia (PH, TH, VN, ID) and Turkey. Owner, 2026-11-04: "yes" to "add the 19". Same shape as Build #148.
import json, os

TAG = '[added by Claude 2026-11-04, LatAm-Asia 2]'
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
EXIL = "Se présente comme média indépendant travaillant depuis l'exil ; financement et propriétaire non vérifiés pour ce profil."
INDP = "Se présente comme média indépendant ; financement et propriétaire non vérifiés pour ce profil."
PUB = 'Radiodiffuseur public ; gouvernance non vérifiée pour ce profil.'
OPP = "Couramment décrit comme critique du gouvernement turc ; ligne et propriétaire non vérifiés pour ce profil."
P = [
    g('MX', 'El Financiero', 'el-financiero-mx', 'https://www.elfinanciero.com.mx/', 'elfinanciero.com.mx',
      'https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/?outputType=xml', 'es',
      'NEWSPAPER', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Mexican business and economic daily newspaper.',
      ['commercial_generalist'], 'Quotidien économique et financier mexicain.', 'Économie, finances et politique mexicaines en espagnol.',
      own='Presse écrite privée'),
    g('MX', 'Reforma', 'reforma-mx', 'https://www.reforma.com/', 'reforma.com', 'https://www.reforma.com/rss/portada.xml', 'es',
      'NEWSPAPER', 'RSS 6 items (front page), 6 in 3 days, newest 2026-11-04', 'Mexico City daily newspaper.',
      ['commercial_generalist'], 'Quotidien national publié à Mexico.', 'Actualité politique et nationale mexicaine en espagnol (une du jour).',
      own='Presse écrite privée', owner='Grupo Reforma (non vérifié)'),
    g('BR', 'Folha de S.Paulo', 'folha-de-s-paulo', 'https://www.folha.uol.com.br/', 'folha.uol.com.br',
      'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', 'pt',
      'NEWSPAPER', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Brazilian national daily newspaper published in São Paulo.',
      ['commercial_generalist'], 'Quotidien national brésilien publié à São Paulo.', 'Actualité brésilienne et internationale en portugais.',
      own='Presse écrite privée', owner='Grupo Folha (non vérifié)'),
    g('BR', 'Estadão', 'estadao', 'https://www.estadao.com.br/', 'estadao.com.br',
      'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/brasil/?body=%7B%22layout%22:%22google-news%22%7D', 'pt',
      'NEWSPAPER', 'RSS 20 items, 19 in 3 days, newest 2026-11-04', 'O Estado de S. Paulo, Brazilian national daily newspaper.',
      ['commercial_generalist'], 'O Estado de S. Paulo, quotidien national brésilien.', 'Actualité nationale brésilienne en portugais (rubrique Brasil).',
      own='Presse écrite privée'),
    g('BR', 'Agência Brasil', 'agencia-brasil', 'https://agenciabrasil.ebc.com.br/', 'agenciabrasil.ebc.com.br',
      'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', 'pt',
      'NEWS_AGENCY', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'Public news agency of Empresa Brasil de Comunicação (EBC).',
      ['public_state'], "Agence de presse publique de l'Empresa Brasil de Comunicação (EBC).",
      'Actualité institutionnelle et nationale brésilienne en portugais.', own='Agence de presse publique',
      owner='Empresa Brasil de Comunicação (EBC), entreprise publique', ev='Agence publique ; gouvernance non vérifiée pour ce profil.', conf='medium'),
    g('AR', 'Infobae', 'infobae', 'https://www.infobae.com/', 'infobae.com', 'https://www.infobae.com/arc/outboundfeeds/rss/', 'es',
      'ONLINE_NEWS', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Argentine online news outlet based in Buenos Aires.',
      ['commercial_generalist'], "Média d'information argentin en ligne basé à Buenos Aires.",
      'Actualité argentine, latino-américaine et internationale en espagnol.'),
    g('AR', 'Ámbito Financiero', 'ambito-financiero', 'https://www.ambito.com/', 'ambito.com', 'https://www.ambito.com/rss/pages/home.xml', 'es',
      'NEWSPAPER', 'RSS 21 items, 21 in 3 days, newest 2026-11-04', 'Argentine business and financial daily newspaper.',
      ['commercial_generalist'], 'Quotidien économique et financier argentin.', 'Économie, marchés et politique argentines en espagnol.',
      own='Presse écrite privée'),
    g('CO', 'El Colombiano', 'el-colombiano', 'https://www.elcolombiano.com/', 'elcolombiano.com', 'https://www.elcolombiano.com/rss/portada.xml', 'es',
      'NEWSPAPER', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Daily newspaper published in Medellín, Colombia.',
      ['commercial_generalist'], 'Quotidien publié à Medellín (Colombie).', "Actualité d'Antioquia et nationale colombienne en espagnol.",
      own='Presse écrite privée'),
    g('CO', 'La Silla Vacía', 'la-silla-vacia', 'https://www.lasillavacia.com/', 'lasillavacia.com', 'https://lasillavacia.com/feed/', 'es',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'Independent Colombian online outlet covering politics and power.',
      ['independent'], 'Média colombien indépendant en ligne consacré à la politique et au pouvoir.',
      'Politique, justice et pouvoir en Colombie, en espagnol.', ev=IND),
    g('PE', 'Andina', 'andina-pe', 'https://andina.pe/', 'andina.pe', 'https://andina.pe/agencia/rss.aspx', 'es',
      'NEWS_AGENCY', 'RSS 20 items, 20 in 3 days, newest 2026-11-04', 'Peruvian state news agency (Agencia Peruana de Noticias Andina).',
      ['public_state'], "Agence de presse d'État péruvienne (Agencia Peruana de Noticias Andina).",
      'Actualité gouvernementale et nationale péruvienne en espagnol.', own="Agence de presse d'État",
      owner='État péruvien (Editora Perú, non vérifié)', ev="Agence d'État ; gouvernance non vérifiée pour ce profil.", conf='medium'),
    g('PE', 'Diario Correo', 'diario-correo', 'https://diariocorreo.pe/', 'diariocorreo.pe',
      'https://diariocorreo.pe/arc/outboundfeeds/rss/?outputType=xml', 'es',
      'NEWSPAPER', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Peruvian national daily newspaper with regional editions.',
      ['commercial_generalist'], 'Quotidien national péruvien avec éditions régionales.', 'Actualité nationale et régionale péruvienne en espagnol.',
      own='Presse écrite privée'),
    g('PH', 'The Manila Times', 'manila-times', 'https://www.manilatimes.net/', 'manilatimes.net', 'https://www.manilatimes.net/news/feed/', 'en',
      'NEWSPAPER', 'RSS 50 items, 50 in 3 days, newest 2026-11-04', 'English-language Philippine daily newspaper.',
      ['commercial_generalist'], 'Quotidien philippin de langue anglaise.', 'Actualité nationale philippine en anglais.',
      own='Presse écrite privée'),
    g('PH', 'BusinessWorld', 'businessworld-ph', 'https://www.bworldonline.com/', 'bworldonline.com', 'https://www.bworldonline.com/feed/', 'en',
      'NEWSPAPER', 'RSS 30 items, 30 in 3 days, newest 2026-11-04', 'Philippine business daily newspaper.',
      ['commercial_generalist'], 'Quotidien économique philippin.', 'Économie, entreprises et politique philippines en anglais.',
      own='Presse écrite privée'),
    g('TH', 'Thaiger', 'thaiger', 'https://thethaiger.com/', 'thethaiger.com', 'https://thethaiger.com/feed', 'en',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'English-language Thai online news site.',
      ['commercial_generalist'], "Site d'information thaïlandais en ligne de langue anglaise.", 'Actualité thaïlandaise en anglais.'),
    g('VN', 'Dân Trí', 'dan-tri', 'https://dantri.com.vn/', 'dantri.com.vn', 'https://dantri.com.vn/rss/home.rss', 'vi',
      'ONLINE_NEWS', 'RSS 101 items, 101 in 3 days, newest 2026-11-04', 'Vietnamese-language online newspaper.',
      ['unknown'], 'Journal en ligne vietnamien de langue vietnamienne.', 'Actualité nationale vietnamienne en vietnamien.',
      own='Presse en ligne (organe de tutelle non vérifié)',
      ev="Presse vietnamienne sous licence d'un organe de tutelle ; tutelle non vérifiée pour ce profil."),
    g('TR', 'Cumhuriyet', 'cumhuriyet', 'https://www.cumhuriyet.com.tr/', 'cumhuriyet.com.tr', 'https://www.cumhuriyet.com.tr/rss/son_dakika.xml', 'tr',
      'NEWSPAPER', 'RSS 101 items, 101 in 3 days, newest 2026-11-04', 'Turkish national daily newspaper, founded 1924.',
      ['opposition_aligned'], 'Quotidien national turc fondé en 1924, de tradition laïque.', 'Politique et actualité turques en turc.',
      own='Presse écrite privée', ev=OPP, conf='medium'),
    g('TR', 'Sözcü', 'sozcu', 'https://www.sozcu.com.tr/', 'sozcu.com.tr', 'https://www.sozcu.com.tr/feeds-rss-category-sozcu', 'tr',
      'NEWSPAPER', 'RSS 51 items, 51 in 3 days, newest 2026-11-04', 'Turkish national daily newspaper.',
      ['opposition_aligned'], 'Quotidien national turc.', 'Politique et actualité turques en turc.',
      own='Presse écrite privée', ev=OPP, conf='medium'),
    g('ID', 'CNBC Indonesia', 'cnbc-indonesia', 'https://www.cnbcindonesia.com/', 'cnbcindonesia.com', 'https://www.cnbcindonesia.com/news/rss', 'id',
      'ONLINE_NEWS', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Indonesian business and news outlet (CNBC licensee).',
      ['commercial_generalist'], "Média indonésien d'information économique et générale (licence CNBC).",
      'Actualité économique et nationale indonésienne en indonésien.', own='Média privé sous licence de marque'),
    g('ID', 'JPNN', 'jpnn', 'https://www.jpnn.com/', 'jpnn.com', 'https://www.jpnn.com/index.php?mib=rss', 'id',
      'ONLINE_NEWS', 'RSS 101 items, 101 in 3 days, newest 2026-11-04', 'Indonesian national online news site (Jawa Pos National Network).',
      ['commercial_generalist'], "Site d'information national indonésien (Jawa Pos National Network).",
      'Actualité nationale indonésienne en indonésien.'),
]

assert len(P) == 19
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


apply = f"""-- GENERATED by Build-Sql.py. Build #150 (MEDIUM): 19 RSS publishers for MX, BR, AR, CO, PE, PH, TH, VN, TR, ID.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the nineteen is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('agencia-brasil', 'cumhuriyet', 'dan-tri') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #150 (all tables with a FK to publishers, children first).
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
