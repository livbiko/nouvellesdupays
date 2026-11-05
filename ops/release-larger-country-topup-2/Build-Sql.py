# Generates apply / rehearse / reverse SQL for Build #174: 13 RSS publishers for BE, BG, SG, TW, IR (2 each), BD, NZ, IL.
# Owner, 2026-11-05: "add 13". Same shape as Build #173.
import json, os

TAG = '[added by Claude 2026-11-05, larger-country top-up 2]'
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
    g('BE', 'RTBF Info', 'rtbf-info', 'https://www.rtbf.be/info', 'rtbf.be', 'https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml', 'fr',
      'TV', 'RSS 20 items, all 11-05; ' + CHK, "News service of RTBF, the public broadcaster of French-speaking Belgium.",
      ['public_state'], "Service d'information de la RTBF, radiodiffuseur public de la Belgique francophone.", 'Actualité belge et internationale, en français.',
      own='Radiodiffuseur public', owner='RTBF (Fédération Wallonie-Bruxelles)',
      ev="Entreprise publique autonome de la Fédération Wallonie-Bruxelles ; information publique.", conf='high'),
    g('BE', 'Le Soir', 'le-soir', 'https://www.lesoir.be/', 'lesoir.be', 'https://www.lesoir.be/rss2/2/cible_principale', 'fr',
      'NEWSPAPER', 'RSS 10 items, all 11-05; ' + CHK, 'Main French-language daily newspaper in Belgium.',
      ['commercial_generalist'], 'Principal quotidien francophone de Belgique.', 'Actualité belge et internationale, en français.',
      own='Presse écrite privée', owner='Groupe Rossel',
      ev="Édité par le groupe Rossel ; information publique.", conf='medium'),
    g('BG', 'Dnevnik', 'dnevnik-bg', 'https://www.dnevnik.bg/', 'dnevnik.bg', 'https://www.dnevnik.bg/rss/', 'bg',
      'ONLINE_NEWS', 'RSS 30 items, all in 3 days; ' + CHK, 'Bulgarian news site, formerly a daily newspaper.',
      ['commercial_generalist'], "Site d'information bulgare, ancien quotidien.", 'Actualité bulgare et internationale, en bulgare.',
      own='Presse en ligne privée', owner='Economedia',
      ev="Groupe Economedia (également éditeur de Capital) ; information publique.", conf='medium'),
    g('BG', 'Capital', 'capital-bg', 'https://www.capital.bg/', 'capital.bg', 'https://www.capital.bg/rss/', 'bg',
      'MAGAZINE', 'RSS 30 items, all in 3 days; ' + CHK, 'Bulgarian weekly on business and politics.',
      ['commercial_generalist'], 'Hebdomadaire bulgare économique et politique.', 'Économie, politique et enquêtes, en bulgare.',
      own='Presse écrite privée', owner='Economedia',
      ev="Groupe Economedia (également éditeur de Dnevnik) ; information publique.", conf='medium'),
    g('SG', 'The Business Times', 'the-business-times-sg', 'https://www.businesstimes.com.sg/', 'businesstimes.com.sg', 'https://www.businesstimes.com.sg/rss/top-stories', 'en',
      'FINANCIAL', 'RSS 14 items (top stories); ' + CHK, "Singapore's business daily.",
      ['commercial_generalist'], "Quotidien économique de Singapour.", 'Économie, finance et entreprises à Singapour et en Asie, en anglais.',
      own='Presse écrite privée', owner='SPH Media Trust',
      ev="SPH Media, également éditeur du Straits Times ; information publique.", conf='medium'),
    g('SG', 'The Independent SG', 'the-independent-sg', 'https://theindependent.sg/', 'theindependent.sg', 'https://theindependent.sg/feed/', 'en',
      'ONLINE_NEWS', 'RSS 50 items, 29 in 3 days (feed title reads Sportsry, items are Singapore news); ' + CHK, 'Independent Singaporean news site.',
      ['independent'], "Site d'information singapourien indépendant, souvent critique.", 'Politique et société singapouriennes, en anglais.',
      ev=INDP),
    g('TW', 'The Reporter', 'the-reporter-tw', 'https://www.twreporter.org/', 'twreporter.org', 'https://www.twreporter.org/a/rss2.xml', 'zh',
      'INVESTIGATIVE', 'RSS 10 items, 4 in 3 days; ' + CHK, 'Taiwanese non-profit investigative news outlet.',
      ['independent'], "Média d'investigation taïwanais à but non lucratif (報導者).", 'Enquêtes et reportages de fond, en chinois.',
      own='Fondation à but non lucratif', owner='The Reporter Cultural Foundation',
      ev="Média financé par des dons, géré par une fondation ; information publique.", conf='medium'),
    g('TW', 'PTS News', 'pts-news', 'https://news.pts.org.tw/', 'news.pts.org.tw', 'https://news.pts.org.tw/xml/newsfeed.xml', 'zh',
      'TV', 'Atom 25 items; ' + CHK, "News service of Taiwan's Public Television Service.",
      ['public_state'], "Service d'information de la télévision publique taïwanaise (公視).", 'Actualité taïwanaise et internationale, en chinois.',
      own='Radiodiffuseur public', owner='Public Television Service Foundation',
      ev="Télévision publique taïwanaise, fondation financée par l'État ; information publique.", conf='high'),
    g('IR', 'IranWire', 'iranwire', 'https://iranwire.com/en/', 'iranwire.com', 'https://iranwire.com/en/feed/', 'en',
      'ONLINE_NEWS', 'RSS 459 items, 58 in 3 days; ' + CHK, 'Independent news site on Iran, run by journalists in the diaspora.',
      ['independent'], "Site d'information indépendant sur l'Iran, animé par des journalistes de la diaspora.", 'Actualité iranienne, droits humains, en anglais.',
      ev=INDP),
    g('IR', 'BBC Persian', 'bbc-persian', 'https://www.bbc.com/persian', 'bbc.com', 'https://feeds.bbci.co.uk/persian/rss.xml', 'fa',
      'TV', 'RSS 33 items, 26 in 3 days; ' + CHK, "BBC World Service's Persian-language service.",
      ['public_state'], 'Service en persan de la BBC World Service.', "Actualité de l'Iran et internationale, en persan.",
      own='Radiodiffuseur public étranger', owner='BBC (Royaume-Uni)',
      ev="Service de la BBC World Service, financé par le Royaume-Uni ; information publique.", conf='high'),
    g('BD', 'Bangla Tribune', 'bangla-tribune', 'https://www.banglatribune.com/', 'banglatribune.com', 'https://www.banglatribune.com/feed/', 'bn',
      'ONLINE_NEWS', 'RSS 100 items, all in 3 days; robots.txt answers 403 (unreadable, treated as allowed); strict XML + Node fetch OK; dates correct (+0600)',
      'Bengali-language news site in Bangladesh.',
      ['commercial_generalist'], "Site d'information bangladais en bengali.", 'Actualité bangladaise, en bengali.'),
    g('NZ', '1News', '1news', 'https://www.1news.co.nz/', '1news.co.nz', 'https://www.1news.co.nz/arc/outboundfeeds/rss/?outputType=xml', 'en',
      'TV', 'RSS 100 items, 97 in 3 days; ' + CHK, "News service of TVNZ, New Zealand's public broadcaster.",
      ['public_state'], "Service d'information de TVNZ, télévision publique néo-zélandaise.", 'Actualité néo-zélandaise et internationale, en anglais.',
      own='Radiodiffuseur public', owner='TVNZ (État néo-zélandais)',
      ev="TVNZ est une société d'État ; information publique.", conf='high'),
    g('IL', '+972 Magazine', '972-magazine', 'https://www.972mag.com/', '972mag.com', 'https://www.972mag.com/feed/', 'en',
      'MAGAZINE', 'RSS 10 items, 3 in 3 days; ' + CHK, 'Independent online magazine run by Israeli and Palestinian journalists.',
      ['independent'], 'Magazine en ligne indépendant animé par des journalistes israéliens et palestiniens, ligne de gauche.', 'Politique israélo-palestinienne, reportages, en anglais.',
      ev="Se présente comme média indépendant à but non lucratif ; financement non vérifié pour ce profil."),
]

assert len(P) == 13
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
apply = f"""-- GENERATED by Build-Sql.py. Build #174 (MEDIUM): 13 RSS publishers for BE, BG, SG, TW, IR, BD, NZ, IL.
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
    RAISE EXCEPTION 'One of the thirteen is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('rtbf-info', 'le-soir', 'dnevnik-bg', 'capital-bg', 'the-business-times-sg', 'the-independent-sg', 'the-reporter-tw', 'pts-news', 'iranwire', 'bbc-persian', 'bangla-tribune', '1news', '972-magazine') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #174 (all tables with a FK to publishers, children first).
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
