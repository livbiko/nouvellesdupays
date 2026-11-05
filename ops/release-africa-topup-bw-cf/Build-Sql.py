# Generates apply / rehearse / reverse SQL for Build #161: 3 RSS publishers for BW (Mmegi, Guardian Sun) and CF (Radio Lengo Songo).
# Owner, 2026-11-05: "add 3". Same shape as Build #158.
import json, os

TAG = '[added by Claude 2026-11-05, Africa top-up BW-CF]'
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
    g('BW', 'Mmegi', 'mmegi', 'https://www.mmegi.bw/', 'mmegi.bw', 'https://www.mmegi.bw/rssFeed/1', 'en',
      'NEWSPAPER', 'RSS (News section) 50 items, newest 2026-11-04; sparse, ~6 items since mid-October',
      "Botswana's leading independent newspaper, published by CBET in Gaborone.",
      ['independent'], 'Journal indépendant botswanais de référence ("Mmegi" signifie "Le Reporter" en setswana), publié par CBET à Gaborone.',
      'Actualité nationale botswanaise (justice, économie, mines, société) en anglais.',
      own='Presse écrite privée', owner='CBET (Pty) Ltd',
      ev="Éditeur CBET indiqué sur le site ; se présente comme source indépendante d'information ; actionnariat détaillé non vérifié pour ce profil.",
      conf='medium'),
    g('BW', 'Guardian Sun', 'guardian-sun-bw', 'https://guardiansun.co.bw/', 'guardiansun.co.bw', 'https://guardiansun.co.bw/rssFeed/48', 'en',
      'NEWSPAPER', 'RSS (News section) 50 items, 3 in 3 days, newest 2026-11-04; old botswanaguardian.co.bw / themidweeksun.co.bw now redirect to a betting site',
      'Shared website of the Botswana Guardian and The Midweek Sun weeklies, published by CBET.',
      ['commercial_generalist'], "Site commun des hebdomadaires Botswana Guardian et The Midweek Sun, publiés par CBET (éditeur de Mmegi).",
      'Actualité nationale botswanaise (faits divers, politique, économie) en anglais.',
      own='Presse écrite privée', owner='CBET (Pty) Ltd',
      ev="Éditeur CBET indiqué sur le site (même plateforme que Mmegi) ; actionnariat détaillé non vérifié pour ce profil.",
      conf='medium'),
    g('CF', 'Radio Lengo Songo', 'radio-lengo-songo', 'https://lengosongo.cf/', 'lengosongo.cf', 'https://lengosongo.cf/feed/', 'fr',
      'RADIO', 'RSS 10 items, all 2026-11-02..05',
      'Radio station in Bangui reported to be funded by Russia; pro-government and pro-Russian line.',
      ['government_aligned'], "Radio de Bangui lancée en 2018, décrite par plusieurs enquêtes (dont l'Atlantic Council / DFRLab) comme financée par des réseaux russes.",
      'Couverture favorable au gouvernement centrafricain et à la Russie (sommet Russie-Afrique, FACA, ministres), en français.',
      own='Radio privée (financement étranger signalé)', owner='Non vérifié (financement russe signalé)',
      ev="Financement russe signalé par des enquêtes publiques (Atlantic Council / DFRLab, médias internationaux) ; non reconnu par la station ; structure juridique non vérifiée pour ce profil.",
      conf='medium'),
]

assert len(P) == 3
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


apply = f"""-- GENERATED by Build-Sql.py. Build #161 (MEDIUM): 3 RSS publishers for BW, CF.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the three is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('mmegi', 'guardian-sun-bw', 'radio-lengo-songo') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #161 (all tables with a FK to publishers, children first).
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
