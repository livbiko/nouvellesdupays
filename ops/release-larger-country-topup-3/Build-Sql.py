# Generates apply / rehearse / reverse SQL for Build #176: 8 RSS publishers for HK, BY (2 each), AZ, LT, AE, LB.
# Owner, 2026-11-05: "add 8". Same shape as Build #174.
import json, os

TAG = '[added by Claude 2026-11-05, larger-country top-up 3]'
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
    g('HK', 'RTHK', 'rthk', 'https://news.rthk.hk/rthk/en/', 'rthk.hk', 'https://rthk9.rthk.hk/rthk/news/rss/e_expressnews_elocal.xml', 'en',
      'RADIO', 'RSS 20 items (English local news), all in 3 days; ' + CHK, "Hong Kong's public broadcaster, English local news.",
      ['public_state'], 'Radiodiffuseur public de Hong Kong (Radio Television Hong Kong), actualité locale en anglais.', 'Actualité hongkongaise, en anglais.',
      own='Radiodiffuseur public', owner='Gouvernement de Hong Kong (département gouvernemental)',
      ev="RTHK est un département du gouvernement de Hong Kong ; information publique.", conf='high'),
    g('HK', 'Ming Pao', 'ming-pao', 'https://news.mingpao.com/', 'mingpao.com', 'https://news.mingpao.com/rss/ins/s00001.xml', 'zh',
      'NEWSPAPER', 'RSS 55 items (Hong Kong news), all in 3 days; robots.txt answers 403 (unreadable, treated as allowed); strict XML + Node fetch OK; dates correct',
      'Hong Kong Chinese-language daily newspaper.',
      ['commercial_generalist'], 'Quotidien hongkongais de langue chinoise (明報).', 'Actualité hongkongaise et chinoise, en chinois.',
      own='Presse écrite privée', owner='Media Chinese International',
      ev="Groupe Media Chinese International ; information publique, non vérifiée en détail pour ce profil.", conf='medium'),
    g('BY', 'Charter97', 'charter97', 'https://charter97.org/', 'charter97.org', 'https://charter97.org/rss.php', 'ru',
      'ONLINE_NEWS', 'RSS 50 items, all in 3 days; ' + CHK, 'Belarusian opposition news site, working from exile.',
      ['opposition_aligned'], "Site d'information de l'opposition biélorusse, en exil.", 'Actualité biélorusse et régionale, ligne d\'opposition, en russe.',
      ev="Site associé au mouvement d'opposition Charte 97, travaillant depuis l'exil ; financement non vérifié pour ce profil."),
    g('BY', 'Radio Svaboda', 'radio-svaboda', 'https://www.svaboda.org/', 'svaboda.org', 'https://www.svaboda.org/api/', 'be',
      'RADIO', 'RSS 20 items, all in 3 days; ' + CHK, "Belarusian service of Radio Free Europe/Radio Liberty.",
      ['public_state'], 'Service biélorusse de Radio Free Europe/Radio Liberty.', 'Actualité biélorusse, en biélorusse.',
      own='Radiodiffuseur public étranger', owner='RFE/RL (financement du gouvernement des États-Unis, USAGM)',
      ev="RFE/RL est financée par le gouvernement américain via l'USAGM ; information publique.", conf='high'),
    g('AZ', 'Meydan TV', 'meydan-tv', 'https://www.meydan.tv/en/', 'meydan.tv', 'https://www.meydan.tv/en/rss/', 'en',
      'ONLINE_NEWS', 'RSS 10 items, newest 11-02 (slow); ' + CHK, 'Independent Azerbaijani media outlet working from exile.',
      ['independent'], "Média azerbaïdjanais indépendant travaillant depuis l'exil.", 'Actualité azerbaïdjanaise, droits humains, en anglais.',
      ev=EXIL),
    g('LT', 'LRT English', 'lrt-english', 'https://www.lrt.lt/en/news-in-english', 'lrt.lt', 'https://www.lrt.lt/en/news-in-english?rss', 'en',
      'TV', 'RSS 100 items, 26 in 3 days; ' + CHK, "English news service of LRT, Lithuania's public broadcaster.",
      ['public_state'], "Service d'information en anglais de LRT, radiodiffuseur public lituanien.", 'Actualité lituanienne et balte, en anglais.',
      own='Radiodiffuseur public', owner='LRT (État lituanien)',
      ev="Radiodiffuseur public lituanien ; information publique.", conf='high'),
    g('AE', 'The National', 'the-national-ae', 'https://www.thenationalnews.com/', 'thenationalnews.com', 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml', 'en',
      'NEWSPAPER', 'RSS 100 items, all in 3 days; ' + CHK, 'English-language newspaper based in Abu Dhabi.',
      ['government_aligned'], "Quotidien anglophone basé à Abou Dhabi, propriété d'intérêts liés au gouvernement.", 'Actualité émiratie, régionale et internationale, en anglais.',
      own='Presse écrite privée', owner="International Media Investments (Abou Dhabi)",
      ev="Détenu par International Media Investments, lié à la famille dirigeante d'Abou Dhabi ; information publique.", conf='medium'),
    g('LB', 'LBCI', 'lbci', 'https://www.lbcgroup.tv/', 'lbcgroup.tv', 'https://www.lbcgroup.tv/Rss/latest-news/en', 'en',
      'TV', 'RSS 20 items, all in 3 days; ' + CHK, 'Lebanese private television channel, English news.',
      ['commercial_generalist'], 'Chaîne de télévision privée libanaise, actualités en anglais.', 'Actualité libanaise et régionale, en anglais.',
      own='Télévision privée'),
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
apply = f"""-- GENERATED by Build-Sql.py. Build #176 (MEDIUM): 8 RSS publishers for HK, BY, AZ, LT, AE, LB.
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
    RAISE EXCEPTION 'One of the eight is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('rthk', 'ming-pao', 'charter97', 'radio-svaboda', 'meydan-tv', 'lrt-english', 'the-national-ae', 'lbci') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #176 (all tables with a FK to publishers, children first).
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
