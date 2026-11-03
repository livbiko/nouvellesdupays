# Generates apply / rehearse / reverse SQL for Build #137: 8 publishers for thin African countries (AO BI BW CF MG MU).
# Owner, 2026-11-03: "deploy now, and add the 8". Same shape as release-stale-africa-1 (Build #135).
# Feeds checked 2026-11-02 with our own bot UA; robots.txt allows; none present in publishers/feeds/discovered_sources.
import json, os

TAG = '[added by Claude 2026-11-03, thin Africa 2]'
DAY = '2026-11-03'


def q(s):
    return "'" + s.replace("'", "''") + "'"


def pub(iso, name, slug, home, dom, feed, lang, st, check, desc, own, owner, tags, conf, hist, cur, ev):
    return dict(iso=iso, name=name, slug=slug, home=home, dom=dom, feed=feed, lang=lang, st=st, check=check, desc=desc,
                own=own, owner=owner, tags=tags, conf=conf, hist=hist, cur=cur, ev=ev,
                src=[(home, f'Site officiel : {name}', 'self_description')])


NV = 'non vérifié pour ce profil'
P = [
    pub("AO", "O País (Angola)", "o-pais-ao", "https://opais.ao/", "opais.ao",
        "https://opais.ao/feed/", "pt", "NEWSPAPER", "RSS 10 items, newest 2026-11-02",
        "Angolan daily newspaper (Luanda).", "Quotidien privé", "Non vérifié", ["commercial_generalist"], "low",
        "Quotidien angolais publié à Luanda (distinct d'O País du Mozambique).", "Actualité politique, économique et sportive de l'Angola en portugais.",
        f"Quotidien privé ; propriété {NV}."),
    pub("BI", "SOS Médias Burundi", "sos-medias-burundi", "https://www.sosmediasburundi.org/", "sosmediasburundi.org",
        "https://www.sosmediasburundi.org/feed/", "fr", "ONLINE_NEWS", "RSS 10 items, newest 2026-11-02",
        "Independent Burundian news outlet run by journalists in exile.", "Média indépendant (journalistes en exil)", "Non vérifié", ["independent"], "medium",
        "Média burundais créé par des journalistes indépendants, travaillant en partie depuis l'exil.",
        "Actualité du Burundi et des réfugiés burundais (droits humains, régions, éducation) en français.",
        f"Média réputé indépendant et critique du pouvoir ; structure et financement {NV}."),
    pub("BW", "The Botswana Gazette", "the-botswana-gazette", "https://www.thegazette.news/", "thegazette.news",
        "https://www.thegazette.news/feed/", "en", "NEWSPAPER", "RSS 10 items, newest 2026-11-02",
        "Botswana weekly newspaper (Gaborone).", "Hebdomadaire privé", "Non vérifié", ["commercial_generalist"], "low",
        "Hebdomadaire privé publié à Gaborone.", "Actualité politique et économique du Botswana en anglais.",
        f"Hebdomadaire privé ; propriété {NV}."),
    pub("CF", "Corbeau News Centrafrique", "corbeau-news", "https://corbeaunews-centrafrique.org/", "corbeaunews-centrafrique.org",
        "https://corbeaunews-centrafrique.org/feed/", "fr", "ONLINE_NEWS", "RSS 15 items, newest 2026-11-02",
        "Central African news site (French).", "Site d'information", "Non vérifié", ["unknown"], "low",
        "Site d'information centrafricain en français, au ton critique.", "Actualité centrafricaine (sécurité, ressources, politique) en français.",
        f"Site d'information au ton critique ; propriété et orientation {NV}."),
    pub("CF", "Oubangui Médias", "oubangui-medias", "https://oubanguimedias.com/", "oubanguimedias.com",
        "https://oubanguimedias.com/feed/", "fr", "ONLINE_NEWS", "RSS 10 items, newest 2026-11-02",
        "Central African news site (French).", "Site d'information privé", "Non vérifié", ["commercial_generalist"], "low",
        "Site d'information centrafricain en français.", "Actualité centrafricaine (justice, santé, institutions) en français.",
        f"Site d'information privé ; propriété {NV}."),
    pub("MG", "L'Express de Madagascar", "lexpress-de-madagascar", "https://www.lexpress.mg/", "lexpress.mg",
        "https://www.lexpress.mg/feeds/posts/default?alt=rss", "fr", "NEWSPAPER", "RSS 25 items, newest 2026-11-02",
        "Malagasy daily newspaper (Antananarivo).", "Quotidien privé", "Non vérifié", ["commercial_generalist"], "low",
        "Quotidien francophone malgache publié à Antananarivo.", "Actualité nationale malgache, régions et sport en français.",
        f"Quotidien privé ; propriété {NV}."),
    pub("MG", "2424.mg", "2424-mg", "https://www.2424.mg/", "2424.mg",
        "https://www.2424.mg/feed/", "fr", "ONLINE_NEWS", "RSS 20 items, newest 2026-11-02",
        "Malagasy news site (French).", "Site d'information privé", "Non vérifié", ["commercial_generalist"], "low",
        "Site d'information malgache en français.", "Actualité malgache et internationale (diplomatie, sport) en français.",
        f"Site d'information privé ; propriété {NV}."),
    pub("MU", "ION News", "ion-news", "https://ionnews.mu/", "ionnews.mu",
        "https://ionnews.mu/feed/", "fr", "ONLINE_NEWS", "RSS 12 items, newest 2026-11-02",
        "Mauritian news site (French and Mauritian Creole).", "Site d'information privé", "Non vérifié", ["commercial_generalist"], "low",
        "Site d'information mauricien en français et en créole.", "Actualité mauricienne (société, environnement, culture) en français et en créole.",
        f"Site d'information privé ; propriété {NV}."),
]

slugs = ','.join(q(p['slug']) for p in P)
doms = ','.join(q(p['dom']) for p in P)
feeds = ','.join(q(p['feed']) for p in P)


def block(p):
    srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
    detail = f"Added on owner approval {DAY} (country with 1-2 live sources); {p['check']} {TAG}"
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



apply = f"""-- GENERATED by Build-Sql.py. Build #137 (MEDIUM): 8 publishers for thin African countries (AO BI BW CF MG MU).
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

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #137 (new publishers removed, children first).
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
