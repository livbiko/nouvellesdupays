# Generates apply / rehearse / reverse SQL for Build #178: 11 RSS publishers for BZ, SR, MM (2 each), GY, TJ, TM, MK, SB.
# Owner, 2026-11-05: "add 11". Same shape as Build #177.
import json, os

TAG = '[added by Claude 2026-11-05, remaining-at-3 top-up]'
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
RFE = ('Radiodiffuseur public étranger', 'RFE/RL (financement du gouvernement des États-Unis, USAGM)',
       "RFE/RL est financée par le gouvernement américain via l'USAGM ; information publique.")
P = [
    g('BZ', 'The San Pedro Sun', 'san-pedro-sun', 'https://www.sanpedrosun.com/', 'sanpedrosun.com', 'https://www.sanpedrosun.com/feed/', 'en',
      'NEWSPAPER', 'RSS 12 items, all in 3 days; ' + CHK, 'Weekly newspaper from San Pedro, Ambergris Caye, Belize.',
      ['commercial_generalist'], 'Hebdomadaire de San Pedro (Ambergris Caye, Belize).', 'Actualité locale et nationale du Belize, en anglais.',
      own='Presse écrite privée'),
    g('BZ', '7 News Belize', '7-news-belize', 'https://www.7newsbelize.com/', '7newsbelize.com', 'https://www.7newsbelize.com/rss.php', 'en',
      'TV', 'RSS 13 items, all in 3 days; date-only stamps (00:00 +0000) -> label_time_zone America/Belize; strict XML + Node fetch OK; robots allows',
      "Belize's evening television newscast.",
      ['commercial_generalist'], 'Journal télévisé du soir du Belize (chaîne 7).', 'Actualité bélizienne, en anglais.',
      own='Télévision privée'),
    g('GY', 'iNews Guyana', 'inews-guyana', 'https://www.inewsguyana.com/', 'inewsguyana.com', 'https://www.inewsguyana.com/feed/', 'en',
      'ONLINE_NEWS', 'RSS 10 items, all in 3 days; ' + CHK, 'Guyanese online news site.',
      ['commercial_generalist'], "Site d'information guyanien.", 'Actualité du Guyana, en anglais.'),
    g('SR', 'Starnieuws', 'starnieuws', 'https://www.starnieuws.com/', 'starnieuws.com', 'https://www.starnieuws.com/rss/starnieuws.rss', 'nl',
      'ONLINE_NEWS', 'RSS 14 items, all in 3 days; labels are UTC (checked); strict XML + Node fetch OK; robots allows', 'Surinamese online news site.',
      ['commercial_generalist'], "Site d'information surinamien.", 'Actualité du Suriname, en néerlandais.'),
    g('SR', 'Suriname Herald', 'suriname-herald', 'https://www.srherald.com/', 'srherald.com', 'https://www.srherald.com/feed/', 'nl',
      'ONLINE_NEWS', 'RSS 10 items, all in 3 days; ' + CHK, 'Surinamese online news site.',
      ['commercial_generalist'], "Site d'information surinamien.", 'Actualité du Suriname, en néerlandais.'),
    g('TJ', 'Radio Ozodi', 'radio-ozodi', 'https://www.ozodi.org/', 'ozodi.org', 'https://www.ozodi.org/api/', 'tg',
      'RADIO', 'RSS 20 items, 16 in 3 days; ' + CHK, "Tajik service of Radio Free Europe/Radio Liberty.",
      ['public_state'], 'Service tadjik de Radio Free Europe/Radio Liberty.', 'Actualité du Tadjikistan, en tadjik.',
      own=RFE[0], owner=RFE[1], ev=RFE[2], conf='high'),
    g('TM', 'Radio Azatlyk', 'radio-azatlyk', 'https://www.azathabar.com/', 'azathabar.com', 'https://www.azathabar.com/api/', 'tk',
      'RADIO', 'RSS 20 items, all in 3 days; ' + CHK, "Turkmen service of Radio Free Europe/Radio Liberty.",
      ['public_state'], 'Service turkmène de Radio Free Europe/Radio Liberty.', 'Actualité du Turkménistan, en turkmène.',
      own=RFE[0], owner=RFE[1], ev=RFE[2], conf='high'),
    g('MM', 'RFA Burmese', 'rfa-burmese', 'https://www.rfa.org/burmese/', 'rfa.org', 'https://www.rfa.org/burmese/RSS', 'my',
      'RADIO', 'RSS 30 items, 11 in 3 days; ' + CHK, "Radio Free Asia's Burmese-language service.",
      ['public_state'], 'Service birman de Radio Free Asia.', 'Actualité de la Birmanie, en birman.',
      own='Radiodiffuseur public étranger', owner='Radio Free Asia (financement du gouvernement des États-Unis, USAGM)',
      ev="Radio Free Asia est financée par le gouvernement américain via l'USAGM ; information publique.", conf='high'),
    g('MM', 'Global New Light of Myanmar', 'global-new-light-of-myanmar', 'https://www.gnlm.com.mm/', 'gnlm.com.mm', 'https://www.gnlm.com.mm/feed/', 'en',
      'NEWSPAPER', 'RSS 10 items, all in 3 days; ' + CHK, "Myanmar's state-run English-language newspaper.",
      ['public_state'], "Quotidien d'État birman en anglais, voix officielle du régime militaire.", "Communiqués et actualités officiels de l'État birman, en anglais.",
      own="Presse d'État", owner="Ministère de l'Information (Birmanie)",
      ev="Journal d'État publié sous l'autorité du ministère de l'Information ; information publique.", conf='high'),
    g('MK', 'Nova Makedonija', 'nova-makedonija', 'https://www.novamakedonija.com.mk/', 'novamakedonija.com.mk', 'https://www.novamakedonija.com.mk/feed/', 'mk',
      'NEWSPAPER', 'RSS 10 items, all in 3 days; ' + CHK, 'North Macedonian daily newspaper, founded in 1944.',
      ['commercial_generalist'], 'Quotidien macédonien fondé en 1944.', 'Actualité de la Macédoine du Nord, en macédonien.',
      own='Presse écrite privée'),
    g('SB', 'Solomon Times', 'solomon-times', 'https://www.solomontimes.com/', 'solomontimes.com', 'https://www.solomontimes.com/rss/latest-news.xml', 'en',
      'ONLINE_NEWS', 'RSS 20 items, 15 in 3 days; labels are UTC (checked against article page); strict XML + Node fetch OK; robots allows',
      'Solomon Islands online news site.',
      ['commercial_generalist'], "Site d'information des Îles Salomon.", 'Actualité des Îles Salomon, en anglais.'),
]
P[1]['pc'] = {'label_time_zone': 'America/Belize'}

assert len(P) == 11
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
apply = f"""-- GENERATED by Build-Sql.py. Build #178 (MEDIUM): 11 RSS publishers for BZ, SR, MM, GY, TJ, TM, MK, SB.
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
    RAISE EXCEPTION 'One of the eleven is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('san-pedro-sun', '7-news-belize', 'inews-guyana', 'starnieuws', 'suriname-herald', 'radio-ozodi', 'radio-azatlyk', 'rfa-burmese', 'global-new-light-of-myanmar', 'nova-makedonija', 'solomon-times') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #178 (all tables with a FK to publishers, children first).
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
