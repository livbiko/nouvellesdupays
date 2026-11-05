# Generates apply / rehearse / reverse SQL for Build #177: 7 RSS publishers for CR, CU (2 each), PY, PA, UY.
# Owner, 2026-11-05: "add 6 and 7" (the six plus Brecha). Same shape as Build #176.
import json, os

TAG = '[added by Claude 2026-11-05, Latin America top-up]'
DAY = '2026-11-05'


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
CHK = 'strict XML + Node fetch from worker image OK; robots allows; dates carry correct zone labels'
P = [
    g('CR', 'La Nación', 'la-nacion-cr', 'https://www.nacion.com/', 'nacion.com', 'https://www.nacion.com/arc/outboundfeeds/rss/?outputType=xml', 'es',
      'NEWSPAPER', 'RSS 100 items, all in 3 days; ' + CHK, "Costa Rica's main daily newspaper.",
      ['commercial_generalist'], 'Principal quotidien du Costa Rica.', 'Actualité costaricienne et internationale, en espagnol.',
      own='Presse écrite privée', owner='Grupo Nación',
      ev="Édité par Grupo Nación ; information publique.", conf='medium'),
    g('CR', 'The Tico Times', 'tico-times', 'https://ticotimes.net/', 'ticotimes.net', 'https://ticotimes.net/feed', 'en',
      'ONLINE_NEWS', 'RSS 10 items, all in 3 days; ' + CHK, 'English-language news site about Costa Rica.',
      ['commercial_generalist'], "Site d'information en anglais sur le Costa Rica.", 'Actualité costaricienne, en anglais.'),
    g('CU', 'Granma', 'granma', 'https://www.granma.cu/', 'granma.cu', 'https://www.granma.cu/feed', 'es',
      'NEWSPAPER', 'RSS 33 items, 28 in 3 days; robots.txt did not answer; strict XML + Node fetch OK; dates correct',
      'Official newspaper of the Communist Party of Cuba.',
      ['public_state'], 'Organe officiel du Comité central du Parti communiste de Cuba.', "Actualité cubaine et internationale, voix officielle de l'État, en espagnol.",
      own='Presse d\'État / de parti', owner='Parti communiste de Cuba',
      ev="Organe officiel du Comité central du PCC ; information publique.", conf='high'),
    g('CU', 'elTOQUE', 'eltoque', 'https://eltoque.com/', 'eltoque.com', 'https://eltoque.com/feed', 'es',
      'ONLINE_NEWS', 'RSS 10 items, all in 3 days; ' + CHK, 'Independent Cuban digital media outlet.',
      ['independent'], 'Média numérique cubain indépendant.', 'Actualité, économie et société cubaines, en espagnol.',
      ev=INDP),
    g('PY', 'La Nación', 'la-nacion-py', 'https://www.lanacion.com.py/', 'lanacion.com.py', 'https://www.lanacion.com.py/arc/outboundfeeds/rss/?outputType=xml', 'es',
      'NEWSPAPER', 'RSS 100 items, all in 3 days; ' + CHK, 'Paraguayan national daily newspaper.',
      ['commercial_generalist'], 'Quotidien national paraguayen.', 'Actualité paraguayenne et internationale, en espagnol.',
      own='Presse écrite privée',
      ev="Propriété attribuée au groupe de la famille Cartes (Parti colorado) dans des sources publiques ; non vérifiée pour ce profil -- à revoir (government_aligned possible)."),
    g('PA', 'Newsroom Panama', 'newsroom-panama', 'https://newsroompanama.com/', 'newsroompanama.com', 'https://newsroompanama.com/feed/', 'en',
      'ONLINE_NEWS', 'RSS 10 items, all in 3 days; ' + CHK, 'English-language news site about Panama.',
      ['commercial_generalist'], "Site d'information en anglais sur le Panama.", 'Actualité panaméenne, en anglais.'),
    g('UY', 'Semanario Brecha', 'brecha', 'https://brecha.com.uy/', 'brecha.com.uy', 'https://brecha.com.uy/feed/', 'es',
      'MAGAZINE', 'RSS 100 items, weekly (newest 10-30 at check); ' + CHK, 'Uruguayan left-wing weekly, run as a cooperative.',
      ['independent'], 'Hebdomadaire uruguayen de gauche, géré en coopérative.', 'Politique, société et culture uruguayennes, en espagnol.',
      own='Coopérative de presse', owner='Cooperativa de trabajadores de Brecha',
      ev="Hebdomadaire fondé en 1985, géré en coopérative ; information publique, non vérifiée en détail pour ce profil."),
]

assert len(P) == 7
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
  INSERT INTO feeds (publisher_id, feed_url, feed_type, parser_config) VALUES (v_pid, {q(p['feed'])}, 'rss', {q(json.dumps(p.get('pc', {})))}::jsonb);
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association,
    historical_context, current_context, confidence, evidence_summary, evidence_sources,
    classification_date, last_reviewed, evidence_date, review_required)
  VALUES (v_pid, {q(p['own'])}, {q(p['owner'])}, ARRAY[{tags}]::text[], NULL,
    {q(p['hist'])}, {q(p['cur'])}, {q(p['conf'])}, {q(p['ev'])}, {q(srcs)}::jsonb,
    '{DAY}', '{DAY}', '{DAY}', true);
  RAISE NOTICE '% added: publisher %', {q(p['name'])}, v_pid;"""


pairs = ', '.join(f"({q(p['dom'])}, {q(p['iso'])})" for p in P)
apply = f"""-- GENERATED by Build-Sql.py. Build #177 (MEDIUM): 7 RSS publishers for CR, CU, PY, PA, UY.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  -- Domains are unique per country (AllAfrica serves several countries): check domain and country together.
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}))
     OR EXISTS (SELECT 1 FROM publishers x JOIN countries c ON c.id = x.country_id WHERE (x.domain, c.iso_code) IN ({pairs}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the seven is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('la-nacion-cr', 'tico-times', 'granma', 'eltoque', 'la-nacion-py', 'newsroom-panama', 'brecha') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #177 (all tables with a FK to publishers, children first).
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
