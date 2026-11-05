# Generates apply / rehearse / reverse SQL for Build #169: 9 RSS publishers for PL, NL, GR, HU, RO, FI, NO, DK, PT (one each, to reach 5).
# Owner, 2026-11-05: "add 9". Same shape as Build #168.
import json, os

TAG = '[added by Claude 2026-11-05, Europe top-up]'
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
    g('PL', 'Notes from Poland', 'notes-from-poland', 'https://notesfrompoland.com/', 'notesfrompoland.com', 'https://notesfrompoland.com/feed/', 'en',
      'ONLINE_NEWS', 'RSS 12 items, 9 in 3 days; ' + CHK, 'English-language news site about Poland.',
      ['independent'], "Site d'information en anglais sur la Pologne, fondé en 2018.", 'Actualité polonaise, politique et société, en anglais.',
      ev="Se présente comme média indépendant financé par ses lecteurs ; propriétaire non vérifié pour ce profil."),
    g('NL', 'NRC', 'nrc', 'https://www.nrc.nl/', 'nrc.nl', 'https://www.nrc.nl/rss/', 'nl',
      'NEWSPAPER', 'RSS 161 items, 94 in 3 days; ' + CHK, 'Dutch national daily newspaper.',
      ['commercial_generalist'], 'Quotidien national néerlandais de référence.', 'Actualité néerlandaise et internationale, en néerlandais.',
      own='Presse écrite privée', owner='Mediahuis',
      ev="Appartient au groupe belge Mediahuis depuis 2015 ; information publique, non vérifiée en détail pour ce profil.", conf='medium'),
    g('GR', 'ERT News', 'ert-news', 'https://www.ertnews.gr/', 'ertnews.gr', 'https://www.ertnews.gr/feed/', 'el',
      'TV', 'RSS 35 items, all in 3 days; ' + CHK, "News service of Greece's public broadcaster ERT.",
      ['public_state'], "Service d'information du radiodiffuseur public grec (ERT).", 'Actualité grecque et internationale, en grec.',
      own='Radiodiffuseur public', owner='ERT S.A. (État grec)',
      ev="Radiodiffuseur public détenu par l'État grec ; information publique.", conf='high'),
    g('HU', 'Magyar Nemzet', 'magyar-nemzet', 'https://magyarnemzet.hu/', 'magyarnemzet.hu', 'https://magyarnemzet.hu/feed/', 'hu',
      'NEWSPAPER', 'RSS 25 items, all in 3 days; ' + CHK, 'Hungarian national daily aligned with the government.',
      ['government_aligned'], 'Quotidien national hongrois, principal titre proche du gouvernement.', 'Actualité hongroise et internationale, ligne progouvernementale, en hongrois.',
      own='Presse écrite privée', owner='Mediaworks (fondation KESMA)',
      ev="Édité par Mediaworks, rattaché à la fondation KESMA qui regroupe des médias proches du gouvernement ; ligne largement documentée.", conf='medium'),
    g('RO', 'G4Media', 'g4media', 'https://www.g4media.ro/', 'g4media.ro', 'https://www.g4media.ro/feed', 'ro',
      'ONLINE_NEWS', 'RSS 30 items, all in 3 days; ' + CHK, 'Romanian news site founded by journalists.',
      ['independent'], "Site d'information roumain fondé en 2018 par des journalistes.", 'Actualité roumaine, politique, justice, en roumain.',
      ev=INDP),
    g('FI', 'MTV Uutiset', 'mtv-uutiset', 'https://www.mtvuutiset.fi/', 'mtvuutiset.fi', 'https://www.mtvuutiset.fi/api/feed/rss/uutiset_uusimmat', 'fi',
      'TV', 'RSS (latest) 21 items, all in 3 days; ' + CHK, 'News service of the Finnish commercial broadcaster MTV.',
      ['commercial_generalist'], "Service d'information de la chaîne commerciale finlandaise MTV.", 'Actualité finlandaise et internationale, en finnois.',
      own='Télévision privée'),
    g('NO', 'Dagbladet', 'dagbladet', 'https://www.dagbladet.no/', 'dagbladet.no', 'https://www.dagbladet.no/?lab_viewport=rss', 'no',
      'NEWSPAPER', 'RSS 33 items, 31 in 3 days; ' + CHK, 'Norwegian national tabloid daily based in Oslo.',
      ['commercial_generalist'], 'Quotidien national norvégien de format tabloïd, basé à Oslo.', 'Actualité norvégienne et internationale, en norvégien.',
      own='Presse écrite privée', owner='Aller Media',
      ev="Groupe Aller Media ; information publique, non vérifiée en détail pour ce profil.", conf='medium'),
    g('DK', 'TV 2 Nyheder', 'tv2-nyheder', 'https://nyheder.tv2.dk/', 'tv2.dk', 'https://feeds.services.tv2.dk/api/feeds/nyheder/rss', 'da',
      'TV', 'RSS 51 items, 47 in 3 days (one pinned 2016 item, older than the age cutoff); ' + CHK, 'News service of the Danish broadcaster TV 2.',
      ['commercial_generalist'], "Service d'information de la chaîne danoise TV 2.", 'Actualité danoise et internationale, en danois.',
      own='Télévision publique financée par la publicité', owner='TV 2 Danmark A/S (État danois)',
      ev="Société anonyme détenue par l'État danois, financée principalement par la publicité et les abonnements ; information publique.", conf='medium'),
    g('PT', 'Público', 'publico-pt', 'https://www.publico.pt/', 'publico.pt', 'https://feeds.feedburner.com/PublicoRSS', 'pt',
      'NEWSPAPER', 'RSS (FeedBurner) 11 items, all in 3 days; ' + CHK, 'Portuguese national daily newspaper based in Lisbon.',
      ['commercial_generalist'], 'Quotidien national portugais basé à Lisbonne.', 'Actualité portugaise et internationale, en portugais.',
      own='Presse écrite privée', owner='Groupe Sonae',
      ev="Appartient au groupe Sonae ; information publique, non vérifiée en détail pour ce profil.", conf='medium'),
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


apply = f"""-- GENERATED by Build-Sql.py. Build #169 (MEDIUM): 9 RSS publishers for PL, NL, GR, HU, RO, FI, NO, DK, PT.
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
  WHERE p.slug IN ('notes-from-poland', 'nrc', 'ert-news', 'magyar-nemzet', 'g4media', 'mtv-uutiset', 'dagbladet', 'tv2-nyheder', 'publico-pt') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #169 (all tables with a FK to publishers, children first).
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
