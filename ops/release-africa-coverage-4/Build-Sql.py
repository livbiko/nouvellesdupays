# Generates apply / rehearse / reverse SQL for Build #142: 8 RSS publishers for SD, MU, GA, TD, BW, SC (countries
# below 5 live publishers). Owner, 2026-11-03: "yes, add the 8". Feeds checked from dr-rke2 with the bot UA. Same shape as Build #140.
import json, os

TAG = '[added by Claude 2026-11-03, Africa coverage 4]'
DAY = '2026-11-03'


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


P = [
    pub('SD', 'Al Taghyeer', 'al-taghyeer', 'https://www.altaghyeer.info/ar/', 'altaghyeer.info', 'https://www.altaghyeer.info/ar/feed/', 'ar',
        'NEWSPAPER', 'RSS 24 items, 13 in 3 days, newest 2026-11-03',
        'Sudanese Arabic-language independent newspaper (Al Taghyeer).',
        'Presse en ligne privée', 'Non vérifié', ['independent'], 'low',
        'Journal soudanais en ligne de langue arabe, se présentant comme indépendant.',
        'Actualité politique et humanitaire soudanaise en arabe (guerre, déplacés, transition).',
        'Se présente comme indépendant ; indépendance et propriétaire non vérifiés pour ce profil.'),
    pub('SD', 'Al Sudani', 'al-sudani', 'https://www.alsudaninews.com/', 'alsudaninews.com', 'https://www.alsudaninews.com/?feed=rss2', 'ar',
        'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Sudanese Arabic-language daily newspaper (Al Sudani).',
        'Presse écrite privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Quotidien soudanais de langue arabe.',
        'Actualité politique, diplomatique et économique soudanaise en arabe.',
        'Quotidien privé ; propriétaire non vérifié pour ce profil.'),
    pub('MU', 'Inside News', 'inside-news', 'https://www.inside.news/', 'inside.news', 'https://www.inside.news/feed/', 'fr',
        'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Mauritian online news site.',
        'Presse en ligne privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d’information mauricien en ligne.',
        'Actualité mauricienne et internationale, principalement en français.',
        'Site privé ; propriétaire non vérifié pour ce profil.'),
    pub('MU', 'News Moris', 'news-moris', 'https://newsmoris.com/', 'newsmoris.com', 'https://newsmoris.com/feed/', 'en',
        'ONLINE_NEWS', 'RSS 10 items, 9 in 3 days, newest 2026-11-03',
        'Mauritian English-language online news site.',
        'Presse en ligne privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Site d’information mauricien en ligne, en anglais.',
        'Faits divers, société et politique mauriciennes en anglais.',
        'Site privé ; propriétaire non vérifié pour ce profil.'),
    pub('GA', 'AGP Gabon', 'agp-gabon', 'https://www.agpgabon.ga/', 'agpgabon.ga', 'https://www.agpgabon.ga/feed/', 'fr',
        'NEWS_AGENCY', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Agence Gabonaise de Presse, the national news agency of Gabon.',
        'Agence de presse publique', 'État gabonais', ['public_state'], 'medium',
        'Agence Gabonaise de Presse (AGP), agence de presse nationale du Gabon.',
        'Actualité institutionnelle et nationale gabonaise, communiqués officiels, en français.',
        'Agence publique ; statut juridique et gouvernance non vérifiés pour ce profil.'),
    pub('TD', 'Le Pays Tchad', 'le-pays-tchad', 'https://lepaystchad.com/', 'lepaystchad.com', 'https://lepaystchad.com/feed/', 'fr',
        'NEWSPAPER', 'RSS 10 items, 4 in 3 days, newest 2026-11-03',
        'Chadian newspaper Le Pays, published in N’Djamena.',
        'Presse écrite privée', 'Non vérifié', ['commercial_generalist'], 'low',
        'Journal tchadien Le Pays, publié à N’Djamena.',
        'Actualité nationale tchadienne (santé, société, politique) en français.',
        'Journal privé ; propriétaire non vérifié pour ce profil.'),
    pub('BW', 'The Business Weekly & Review', 'business-weekly-review', 'https://www.businessweekly.co.bw/', 'businessweekly.co.bw',
        'https://www.businessweekly.co.bw/feed/', 'en', 'NEWSPAPER', 'RSS 10 items, 8 in 3 days, newest 2026-11-03',
        'Botswana business weekly newspaper.',
        'Presse écrite privée', 'Non vérifié', ['specialist'], 'low',
        'Hebdomadaire économique du Botswana.',
        'Économie, entreprises, travail et politique publique au Botswana, en anglais.',
        'Hebdomadaire privé ; propriétaire non vérifié pour ce profil.'),
    pub('SC', 'SBC Seychelles', 'sbc-seychelles', 'https://www.sbc.sc/', 'sbc.sc', 'https://www.sbc.sc/feed/', 'en',
        'TV', 'RSS 10 items, 10 in 3 days, newest 2026-11-03',
        'Seychelles Broadcasting Corporation, the national broadcaster.',
        'Radiodiffuseur public', 'Seychelles Broadcasting Corporation (État seychellois)', ['public_state'], 'medium',
        'Seychelles Broadcasting Corporation, radiodiffuseur national des Seychelles.',
        'Actualité nationale seychelloise en créole seychellois et en anglais.',
        'Radiodiffuseur public ; gouvernance non vérifiée pour ce profil.'),
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
  INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (v_pid, {q(p['feed'])}, 'rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association,
    historical_context, current_context, confidence, evidence_summary, evidence_sources,
    classification_date, last_reviewed, evidence_date, review_required)
  VALUES (v_pid, {q(p['own'])}, {q(p['owner'])}, ARRAY[{tags}]::text[], NULL,
    {q(p['hist'])}, {q(p['cur'])}, {q(p['conf'])}, {q(p['ev'])}, {q(srcs)}::jsonb,
    '{DAY}', '{DAY}', '{DAY}', true);
  RAISE NOTICE '% added: publisher %', {q(p['name'])}, v_pid;"""


apply = f"""-- GENERATED by Build-Sql.py. Build #142 (MEDIUM): 8 RSS publishers for SD, MU, GA, TD, BW, SC.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the eight is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('agp-gabon', 'le-pays-tchad', 'inside-news') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #142 (all tables with a FK to publishers, children first).
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
