# Generates apply / rehearse / reverse SQL for Build #173: 6 RSS publishers for IQ (2), ME (2), LA, PG.
# Owner, 2026-11-05: "add 6". Same shape as Build #172.
import json, os

TAG = '[added by Claude 2026-11-05, IQ-ME-LA-PG top-up]'
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
CHK = 'strict XML + Node fetch from worker image OK; robots allows'
P = [
    g('IQ', 'Baghdad Today', 'baghdad-today', 'https://baghdadtoday.news/', 'baghdadtoday.news', 'https://baghdadtoday.news/rss', 'ar',
      'NEWS_AGENCY', 'RSS 10 items, all 11-05; dates +0300 correct; ' + CHK, 'Iraqi Arabic-language news agency based in Baghdad.',
      ['commercial_generalist'], "Agence d'information irakienne en arabe, basée à Bagdad.", 'Actualité politique et sécuritaire irakienne, en arabe.'),
    g('IQ', '964', '964-media', 'https://964media.com/', '964media.com', 'https://964media.com/feed/?for=public&access=dcf191addb8e5554d7986d6603ab8a26583615a3', 'ar',
      'ONLINE_NEWS', 'RSS 20 items, all 11-05; feed URL with public access token advertised in the page head; ' + CHK, 'Iraqi Arabic-language news network (Shabakat 964).',
      ['independent'], "Réseau d'information irakien en arabe (Shabakat 964).", 'Actualité irakienne, reportages de terrain, en arabe.',
      ev=INDP),
    g('ME', 'Portal Analitika', 'portal-analitika', 'https://www.portalanalitika.me/', 'portalanalitika.me', 'https://rss.portalanalitika.me', 'sr',
      'ONLINE_NEWS', 'RSS 66 items, all in 3 days; dates true UTC (checked live); ' + CHK, 'Montenegrin news portal.',
      ['commercial_generalist'], "Portail d'information monténégrin.", 'Actualité politique et société monténégrines, en monténégrin.'),
    g('ME', 'Pobjeda', 'pobjeda', 'https://www.pobjeda.me/', 'pobjeda.me', 'https://rss.pobjeda.me', 'sr',
      'NEWSPAPER', 'RSS 40 items, all in 3 days; labels Montenegro local time as +0000 -> label_time_zone Europe/Podgorica; ' + CHK,
      'Montenegrin national daily newspaper, founded in 1944.',
      ['commercial_generalist'], 'Quotidien national monténégrin, fondé en 1944.', 'Actualité monténégrine et régionale, en monténégrin.',
      own='Presse écrite privée',
      ev="Ancien quotidien d'État ; propriétaire actuel non vérifié pour ce profil."),
    g('LA', 'RFA Lao', 'rfa-lao', 'https://www.rfa.org/lao/', 'rfa.org', 'https://www.rfa.org/lao/RSS', 'lo',
      'RADIO', 'RSS 23 items, 3 in 3 days; ' + CHK, "Radio Free Asia's Lao-language service.",
      ['public_state'], 'Service en lao de Radio Free Asia.', "Actualité du Laos en lao, indépendante des médias d'État lao.",
      own='Radiodiffuseur public étranger', owner='Radio Free Asia (financement du gouvernement des États-Unis, USAGM)',
      ev="Radio Free Asia est financée par le gouvernement américain via l'USAGM ; information publique.", conf='high'),
    g('PG', 'Business Advantage PNG', 'business-advantage-png', 'https://www.businessadvantagepng.com/', 'businessadvantagepng.com', 'https://www.businessadvantagepng.com/feed/', 'en',
      'FINANCIAL', 'RSS 10 items, newest 10-27 (slow); ' + CHK, 'Business news and analysis about Papua New Guinea.',
      ['specialist'], "Actualité économique et analyses sur la Papouasie-Nouvelle-Guinée.", 'Économie, mines, énergie et affaires en PNG, en anglais.',
      own='Presse magazine privée', owner='Business Advantage International',
      ev="Publié par Business Advantage International ; information publique, non vérifiée en détail pour ce profil.", conf='medium'),
]
P[3]['pc'] = {'label_time_zone': 'Europe/Podgorica'}

assert len(P) == 6
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
apply = f"""-- GENERATED by Build-Sql.py. Build #173 (MEDIUM): 6 RSS publishers for IQ, ME, LA, PG.
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
    RAISE EXCEPTION 'One of the six is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('baghdad-today', '964-media', 'portal-analitika', 'pobjeda', 'rfa-lao', 'business-advantage-png') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #173 (all tables with a FK to publishers, children first).
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
