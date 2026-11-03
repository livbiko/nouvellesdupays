# Generates apply / rehearse / reverse SQL for Build #135: 7 publishers for stale African countries (GQ DJ KM LS SS).
# Owner, 2026-11-03: "yes, add the 7, skip Jornal Tropical". Same shape as release-west-africa-sources-3 (Build #134).
# Feeds checked 2026-11-02 with our own bot UA; robots.txt allows; none present in publishers/feeds/discovered_sources.
import json, os

TAG = '[added by Claude 2026-11-02, stale Africa 1]'
DAY = '2026-11-02'


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


NV = 'non vérifié pour ce profil'
P = [
    pub('GQ', 'Ahora EG', 'ahora-eg', 'https://ahoraeg.com/', 'ahoraeg.com',
        'https://ahoraeg.com/feed/', 'es', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'Equatorial Guinean news site (Spanish).', "Site d'information", 'Non vérifié', ['unknown'], 'low',
        "Site d'information équato-guinéen en espagnol.", 'Actualité institutionnelle et politique de Guinée équatoriale (Parlement, budget, gouvernement).',
        f"Site d'information ; propriété et ligne éditoriale {NV}. Seule source vivante pour la Guinée équatoriale au 2026-11-02."),
    pub('DJ', "ADI (Agence Djiboutienne d'Information)", 'adi-djibouti', 'https://www.adi.dj/', 'adi.dj',
        'https://www.adi.dj/rss', 'fr', 'NEWS_AGENCY', 'RSS 50 items, newest 2026-11-02',
        'Djibouti national news agency.', "Agence de presse d'État", 'État de Djibouti', ['public_state'], 'medium',
        "Agence Djiboutienne d'Information, agence de presse nationale de Djibouti.",
        'Dépêches officielles et actualité nationale djiboutienne en français.',
        "Agence de presse nationale ; rattachement exact au gouvernement non vérifié pour ce profil."),
    pub('DJ', 'RTD (Radiodiffusion Télévision de Djibouti)', 'rtd-djibouti', 'https://rtd.dj/', 'rtd.dj',
        'https://rtd.dj/feed/', 'fr', 'TV', 'RSS 10 items, newest 2026-10-29',
        'Djibouti national radio and television.', "Radiodiffuseur public (État de Djibouti)", 'État de Djibouti', ['public_state'], 'medium',
        'Radiodiffusion Télévision de Djibouti, radiodiffuseur national.', 'Actualité nationale et coopération internationale de Djibouti en français.',
        "Radiodiffuseur national ; gouvernance non vérifiée pour ce profil."),
    pub('KM', 'Habari za Comores', 'habari-za-comores', 'https://www.habarizacomores.com/', 'habarizacomores.com',
        'https://www.habarizacomores.com/feeds/posts/default?alt=rss', 'fr', 'ONLINE_NEWS', 'RSS 25 items, newest 2026-11-02',
        'Comorian news site (French).', "Site d'information", 'Non vérifié', ['unknown'], 'low',
        "Site d'actualité comorien en français, hébergé sur Blogger.", 'Actualité des Comores (société, politique, éducation) en français.',
        f"Site d'information ; auteurs et propriété {NV}."),
    pub('LS', 'Lesotho Times', 'lesotho-times', 'https://lestimes.com/', 'lestimes.com',
        'https://lestimes.com/?feed=rss2', 'en', 'NEWSPAPER', 'RSS 10 items, newest 2026-10-31',
        'Lesotho weekly newspaper (Maseru).', 'Hebdomadaire privé', 'Non vérifié', ['commercial_generalist'], 'low',
        'Hebdomadaire anglophone publié à Maseru.', 'Actualité politique, économique et sportive du Lesotho en anglais.',
        f"Hebdomadaire privé ; propriété {NV} (possiblement le même groupe que Sunday Express, non confirmé)."),
    pub('SS', 'Radio Tamazuj', 'radio-tamazuj', 'https://www.radiotamazuj.org/', 'radiotamazuj.org',
        'https://www.radiotamazuj.org/en/feed', 'en', 'RADIO', 'RSS 12 items, newest 2026-11-02',
        'Independent radio and news site covering South Sudan.', 'Média indépendant à but non lucratif', 'Non vérifié', ['independent'], 'medium',
        "Radio et site d'information indépendants couvrant le Soudan du Sud.", 'Actualité politique et sécuritaire du Soudan du Sud en anglais.',
        f"Média réputé indépendant ; structure et financement {NV}."),
    pub('SS', 'Sudans Post', 'sudans-post', 'https://www.sudanspost.com/', 'sudanspost.com',
        'https://www.sudanspost.com/feed/', 'en', 'ONLINE_NEWS', 'RSS 10 items, newest 2026-11-02',
        'South Sudanese news site (English).', "Site d'information privé", 'Non vérifié', ['commercial_generalist'], 'low',
        "Site d'information sud-soudanais en anglais.", 'Actualité du Soudan du Sud (élections, institutions, sécurité) en anglais.',
        f"Site d'information privé ; propriété {NV}."),
]

slugs = ','.join(q(p['slug']) for p in P)
doms = ','.join(q(p['dom']) for p in P)
feeds = ','.join(q(p['feed']) for p in P)


def block(p):
    srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
    detail = f"Added on owner approval {DAY} (country with 0-1 live sources); {p['check']} {TAG}"
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



apply = f"""-- GENERATED by Build-Sql.py. Build #135 (MEDIUM): 7 publishers for stale African countries (GQ DJ KM LS SS).
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of these is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, f.id AS feed_id, f.feed_url FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #135 (new publishers removed, children first).
\\set ON_ERROR_STOP on
BEGIN;
DO $do$
DECLARE pids integer[];
BEGIN
  SELECT array_agg(id) INTO pids FROM publishers WHERE slug IN ({slugs});
  IF pids IS NULL THEN RAISE NOTICE 'No new publishers to remove'; RETURN; END IF;
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
