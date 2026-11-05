# Generates apply / rehearse / reverse SQL for Build #166 part 2: 4 RSS publishers for LK (Newswire, Daily Mirror), PS (Quds News Network), JO (7iber).
# Owner, 2026-11-05: "add 4". Same shape as Build #165 part 1.
import json, os

TAG = '[added by Claude 2026-11-05, LK-PS-JO top-up]'
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
P = [
    g('LK', 'Newswire', 'newswire-lk', 'https://www.newswire.lk/', 'newswire.lk', 'https://www.newswire.lk/feed/', 'en',
      'ONLINE_NEWS', 'RSS 20 items, all in 3 days, newest 2026-11-05; strict XML + Node fetch OK',
      'Sri Lankan English-language news website.',
      ['commercial_generalist'], "Site d'information srilankais en anglais.",
      'Actualité nationale (transports, politique, économie), en anglais.'),
    g('LK', 'Daily Mirror', 'daily-mirror-lk', 'https://www.dailymirror.lk/', 'dailymirror.lk', 'https://www.dailymirror.lk/rss/breaking_news/108', 'en',
      'NEWSPAPER', 'RSS (breaking news) 12 items, all in 3 days, newest 2026-11-05; strict XML + Node fetch OK',
      'Sri Lankan English-language daily published by Wijeya Newspapers.',
      ['commercial_generalist'], 'Quotidien srilankais de langue anglaise, groupe Wijeya Newspapers.',
      'Dernières nouvelles nationales (économie, marchés, politique), en anglais.',
      own='Presse écrite privée', owner='Wijeya Newspapers Ltd',
      ev="Éditeur Wijeya Newspapers indiqué publiquement ; actionnariat détaillé non vérifié pour ce profil.", conf='medium'),
    g('PS', 'Quds News Network', 'quds-news-network', 'https://qudsn.co/', 'qudsn.co', 'https://qudsn.co/feed', 'ar',
      'ONLINE_NEWS', 'RSS 51 items, all in 3 days, newest 2026-11-05; strict XML + Node fetch OK; robots allows (search=yes, ai-train=no)',
      'Palestinian Arabic-language news network that describes itself as independent.',
      ['independent'], 'Réseau palestinien d’information en ligne se présentant comme indépendant.',
      'Couverture de la Cisjordanie, Jérusalem et Gaza (colonisation, arrestations, politique), en arabe.',
      own='Presse en ligne privée', owner='Non vérifié',
      ev="Se présente comme indépendant ; des responsables israéliens et certains analystes le décrivent comme proche du Hamas (non vérifié pour ce profil) ; classement à faible confiance, à réviser."),
    g('JO', '7iber', '7iber', 'https://www.7iber.com/', '7iber.com', 'https://www.7iber.com/feed/', 'ar',
      'MAGAZINE', 'RSS 50 items, 3 in 3 days, newest 2026-11-04; strict XML + Node fetch OK; robots allows (search=yes, ai-train=no)',
      'Independent Jordanian online magazine (Arabic) known for in-depth reporting and analysis.',
      ['independent'], 'Magazine jordanien indépendant en ligne, connu pour ses enquêtes et analyses.',
      'Enquêtes, politique régionale, droits, société, en arabe ; publication peu fréquente.',
      own='Média indépendant en ligne', ev=INDP),
]

assert len(P) == 4
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


apply = f"""-- GENERATED by Build-Sql.py. Build #166 part 2 (MEDIUM): 4 RSS publishers for LK, PS, JO.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the four is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('newswire-lk', 'daily-mirror-lk', 'quds-news-network', '7iber') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #166 part 2 (all tables with a FK to publishers, children first).
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
