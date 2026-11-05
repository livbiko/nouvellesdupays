# Generates apply / rehearse / reverse SQL for Build #168: 9 RSS publishers for US, GB, IN, DE, IT, JP, KR, CA, CH (one each, to reach 5).
# Owner, 2026-11-05: "add 9". Same shape as Build #167.
import json, os

TAG = '[added by Claude 2026-11-05, large-country top-up]'
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
    g('US', 'The New York Times', 'new-york-times', 'https://www.nytimes.com/', 'nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'en',
      'NEWSPAPER', 'RSS (home page) 22 items, all in 3 days; ' + CHK, 'American daily newspaper of record, based in New York.',
      ['commercial_generalist'], 'Quotidien américain de référence, basé à New York.', 'Actualité américaine et internationale, en anglais.',
      own='Presse écrite privée (cotée)', owner='The New York Times Company (famille Ochs-Sulzberger, contrôle)',
      ev="Société cotée contrôlée par la famille Ochs-Sulzberger (actions de classe B) ; information publique.", conf='high'),
    g('GB', 'The Telegraph', 'the-telegraph', 'https://www.telegraph.co.uk/', 'telegraph.co.uk', 'https://www.telegraph.co.uk/rss.xml', 'en',
      'NEWSPAPER', 'RSS 120 items, 14 in 3 days; ' + CHK, 'British daily newspaper with a centre-right editorial line.',
      ['commercial_generalist'], 'Quotidien britannique, ligne éditoriale de centre droit.', 'Actualité britannique et internationale, opinion conservatrice, en anglais.',
      own='Presse écrite privée', owner='Non vérifié (propriété en cours de cession depuis 2023)',
      ev="Ligne éditoriale de centre droit largement documentée ; propriétaire actuel non vérifié pour ce profil (vente engagée depuis 2023)."),
    g('IN', 'The Indian Express', 'the-indian-express', 'https://indianexpress.com/', 'indianexpress.com', 'https://indianexpress.com/feed/', 'en',
      'NEWSPAPER', 'RSS 200 items, all in 3 days; ' + CHK, 'Indian English-language daily known for investigative reporting.',
      ['commercial_generalist'], "Quotidien indien de langue anglaise, connu pour ses enquêtes.", 'Actualité nationale, politique, opinion, en anglais.',
      own='Presse écrite privée', owner='Indian Express Group',
      ev="Groupe Indian Express (famille Goenka) ; information publique, non vérifiée en détail pour ce profil.", conf='medium'),
    g('DE', 'Süddeutsche Zeitung', 'sueddeutsche-zeitung', 'https://www.sueddeutsche.de/', 'sueddeutsche.de', 'https://rss.sueddeutsche.de/rss/Topthemen', 'de',
      'NEWSPAPER', 'RSS (Topthemen) 15 items, all in 3 days; ' + CHK, 'German national daily based in Munich.',
      ['commercial_generalist'], 'Quotidien national allemand basé à Munich.', 'Actualité allemande et internationale, en allemand.',
      own='Presse écrite privée', owner='Südwestdeutsche Medien Holding (SWMH)',
      ev="Éditeur Süddeutscher Verlag, groupe SWMH ; information publique.", conf='medium'),
    g('IT', 'Il Fatto Quotidiano', 'il-fatto-quotidiano', 'https://www.ilfattoquotidiano.it/', 'ilfattoquotidiano.it', 'https://www.ilfattoquotidiano.it/feed/', 'it',
      'NEWSPAPER', 'RSS 25 items, all in 3 days; ' + CHK, 'Italian daily that takes no public press subsidies.',
      ['independent'], 'Quotidien italien qui ne reçoit pas de subventions publiques à la presse.', 'Actualité italienne, politique, justice, en italien.',
      own='Presse écrite privée', owner='Società Editoriale Il Fatto',
      ev="Se présente comme indépendant et sans financement public ; actionnariat non vérifié en détail pour ce profil."),
    g('JP', 'Japan Today', 'japan-today', 'https://japantoday.com/', 'japantoday.com', 'https://japantoday.com/feed', 'en',
      'ONLINE_NEWS', 'RSS 31 items, all in 3 days; ' + CHK, 'English-language news site about Japan, based in Tokyo.',
      ['commercial_generalist'], "Site d'information en anglais sur le Japon, basé à Tokyo.", 'Actualité japonaise et internationale, en anglais.'),
    g('KR', 'Chosun Ilbo', 'chosun-ilbo', 'https://www.chosun.com/', 'chosun.com', 'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml', 'ko',
      'NEWSPAPER', 'RSS 100 items, 97 in 3 days; ' + CHK, "South Korea's largest daily newspaper, with a conservative editorial line.",
      ['commercial_generalist'], 'Premier quotidien sud-coréen, ligne éditoriale conservatrice.', 'Actualité nationale et internationale, en coréen.',
      own='Presse écrite privée', owner='Chosun Media',
      ev="Ligne conservatrice largement documentée ; actionnariat non vérifié en détail pour ce profil.", conf='medium'),
    g('CA', 'Radio-Canada', 'radio-canada', 'https://ici.radio-canada.ca/', 'radio-canada.ca', 'https://ici.radio-canada.ca/rss/4159', 'fr',
      'TV', 'RSS (À la une) 27 items, all in 3 days; ' + CHK, "French-language service of Canada's public broadcaster (CBC/Radio-Canada).",
      ['public_state'], 'Service francophone du diffuseur public canadien (CBC/Radio-Canada).', 'Actualité canadienne, québécoise et internationale, en français.',
      own='Radiodiffuseur public', owner='Société Radio-Canada (État canadien)',
      ev="Société d'État fédérale régie par la Loi sur la radiodiffusion ; information publique.", conf='high'),
    g('CH', 'Le Temps', 'le-temps', 'https://www.letemps.ch/', 'letemps.ch', 'https://www.letemps.ch/articles.rss', 'fr',
      'NEWSPAPER', 'RSS 21 items, all in 3 days; ' + CHK, 'Swiss French-language daily owned by a non-profit foundation.',
      ['independent'], 'Quotidien suisse romand détenu par une fondation à but non lucratif (Fondation Aventinus).', 'Actualité suisse et internationale, en français.',
      own='Presse détenue par une fondation', owner='Fondation Aventinus',
      ev="Racheté en 2021 par la Fondation Aventinus (à but non lucratif) ; information publique.", conf='medium'),
]

assert len(P) == 9
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


apply = f"""-- GENERATED by Build-Sql.py. Build #168 (MEDIUM): 9 RSS publishers for US, GB, IN, DE, IT, JP, KR, CA, CH.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the nine is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('new-york-times', 'the-telegraph', 'the-indian-express', 'sueddeutsche-zeitung', 'il-fatto-quotidiano', 'japan-today', 'chosun-ilbo', 'radio-canada', 'le-temps') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #168 (all tables with a FK to publishers, children first).
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
