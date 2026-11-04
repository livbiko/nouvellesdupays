# Generates apply / rehearse / reverse SQL for Build #147: 24 RSS publishers for Eastern Europe (BY, UA), South and
# Central Asia (AF, MV, NP, KG, KZ, UZ, TM), the Caucasus (AZ, AM, GE) and Canada. Owner, 2026-11-04: "yes, add the 24".
import json, os

TAG = '[added by Claude 2026-11-04, Eurasia-Canada 1]'
DAY = '2026-11-04'


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
P = [
    g('BY', 'Zerkalo', 'zerkalo', 'https://news.zerkalo.io/', 'news.zerkalo.io', 'https://news.zerkalo.io/rss/all.rss', 'ru',
      'ONLINE_NEWS', 'RSS 101 items, 101 in 3 days, newest 2026-11-04', 'Independent Belarusian news outlet working from exile, successor to TUT.by.',
      ['independent'], "Média biélorusse indépendant travaillant depuis l'exil, issu de l'équipe de TUT.by.",
      'Actualité biélorusse, société et politique, en russe.', ev=EXIL),
    g('BY', 'Reform.news', 'reform-news', 'https://reform.news/', 'reform.news', 'https://reform.news/feed', 'ru',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Independent Belarusian news outlet working from exile.',
      ['independent'], "Média biélorusse indépendant travaillant depuis l'exil.", 'Actualité biélorusse en russe.', ev=EXIL),
    g('UA', 'Ukrinform', 'ukrinform', 'https://www.ukrinform.net/', 'ukrinform.net', 'https://www.ukrinform.net/rss/block-lastnews', 'en',
      'NEWS_AGENCY', 'RSS 30 items, 30 in 3 days, newest 2026-11-04', 'National news agency of Ukraine (English edition).',
      ['public_state'], "Ukrinform, agence de presse nationale de l'Ukraine (édition anglaise).",
      'Guerre, politique, économie et actualité ukrainiennes en anglais.', own='Agence de presse publique',
      owner="État ukrainien", ev='Agence publique ; gouvernance non vérifiée pour ce profil.', conf='medium'),
    g('UA', 'UNIAN', 'unian', 'https://www.unian.net/', 'unian.net', 'https://www.unian.net/rss', 'ru',
      'NEWS_AGENCY', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Ukrainian independent news agency (Russian-language feed).',
      ['commercial_generalist'], "Agence d'information ukrainienne UNIAN.", 'Actualité ukrainienne et internationale (fil en russe).',
      own='Agence de presse privée', owner='Non vérifié (groupe 1+1 Media, non vérifié)'),
    g('AF', 'Amu TV', 'amu-tv', 'https://amu.tv/', 'amu.tv', 'https://amu.tv/feed/', 'en',
      'TV', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Afghan news outlet working from exile.',
      ['independent'], "Média afghan travaillant depuis l'exil.", "Actualité afghane sous le régime taliban, en anglais.", ev=EXIL),
    g('AF', 'Etilaat Roz', 'etilaat-roz', 'https://www.etilaatroz.com/', 'etilaatroz.com', 'https://www.etilaatroz.com/feed/', 'fa',
      'NEWSPAPER', 'RSS 20 items, 20 in 3 days, newest 2026-11-03', 'Afghan daily newspaper, now working from exile.',
      ['independent'], "Quotidien afghan, aujourd'hui publié depuis l'exil.", 'Actualité afghane et internationale en persan (dari).', ev=EXIL),
    g('AF', 'KabulNow', 'kabulnow', 'https://kabulnow.com/', 'kabulnow.com', 'https://kabulnow.com/feed/', 'en',
      'ONLINE_NEWS', 'RSS 12 items, 12 in 3 days, newest 2026-11-03', 'Afghan news outlet working from exile.',
      ['independent'], "Média afghan travaillant depuis l'exil.", 'Actualité, droits humains et société afghanes en anglais.', ev=EXIL),
    g('MV', 'Dhauru', 'dhauru', 'https://dhauru.com/', 'dhauru.com', 'https://dhauru.com/feed', 'dv',
      'ONLINE_NEWS', 'RSS 51 items, 45 in 3 days, newest 2026-11-03', 'Maldivian online news site.',
      ['commercial_generalist'], "Site d'information maldivien en ligne.", 'Actualité maldivienne en dhivehi (écrit en alphabet latin).'),
    g('KG', 'Kloop', 'kloop', 'https://kloop.kg/', 'kloop.kg', 'https://kloop.kg/feed/', 'ru',
      'ONLINE_NEWS', 'RSS 12 items, 1 in 3 days, newest 2026-11-02', 'Independent Kyrgyz news outlet, banned in Kyrgyzstan in 2024.',
      ['independent'], 'Média kirghize indépendant, interdit au Kirghizistan en 2024.',
      'Enquêtes, société et politique kirghizes en russe.', ev="Se présente comme média indépendant ; interdit par les autorités kirghizes en 2024 ; financement non vérifié pour ce profil."),
    g('KG', 'Kabar', 'kabar', 'https://kabar.kg/', 'kabar.kg', 'https://kabar.kg/feed/', 'ky',
      'NEWS_AGENCY', 'RSS 50 items, 50 in 3 days, newest 2026-11-03', 'National news agency of Kyrgyzstan.',
      ['public_state'], 'Kabar, agence de presse nationale du Kirghizistan.', 'Actualité institutionnelle et nationale kirghize en kirghize.',
      own='Agence de presse publique', owner='État kirghize', ev='Agence publique ; gouvernance non vérifiée pour ce profil.', conf='medium'),
    g('KG', 'Economist.kg', 'economist-kg', 'https://economist.kg/', 'economist.kg', 'https://economist.kg/feed/', 'ru',
      'ONLINE_NEWS', 'RSS 30 items, 30 in 3 days, newest 2026-11-03', 'Kyrgyz business and economics news site.',
      ['specialist'], "Site d'information économique kirghize.", 'Économie, finances et énergie au Kirghizistan, en russe.'),
    g('AZ', 'Minval', 'minval', 'https://minval.az/', 'minval.az', 'https://minval.az/rss', 'ru',
      'ONLINE_NEWS', 'RSS 23 items, 23 in 3 days, newest 2026-11-03', 'Azerbaijani Russian-language news and politics site.',
      ['unknown'], "Site d'information et d'analyse politique azerbaïdjanais de langue russe.",
      'Politique azerbaïdjanaise, régionale et internationale en russe.', ev='Alignement politique et propriétaire non établis pour ce profil.'),
    g('TM', 'Chronicles of Turkmenistan', 'chronicles-of-turkmenistan', 'https://www.hronikatm.com/', 'hronikatm.com', 'https://www.hronikatm.com/feed/', 'ru',
      'ONLINE_NEWS', 'RSS 20 items, 7 in 3 days, newest 2026-11-03', 'News site run from exile by the Turkmen Initiative for Human Rights.',
      ['independent'], "Site d'information publié depuis l'exil par la Turkmen Initiative for Human Rights.",
      'Droits humains, société et économie au Turkménistan, en russe.', own='ONG', owner='Turkmen Initiative for Human Rights (non vérifié)', ev=EXIL),
    g('NP', 'Nepali Times', 'nepali-times', 'https://www.nepalitimes.com/', 'nepalitimes.com', 'https://www.nepalitimes.com/feed/', 'en',
      'NEWSPAPER', 'RSS 30 items, 4 in 3 days, newest 2026-11-03', 'English-language weekly newspaper, Kathmandu.',
      ['commercial_generalist'], 'Hebdomadaire népalais de langue anglaise, Katmandou.', 'Politique, société et environnement népalais en anglais.',
      own='Presse écrite privée'),
    g('NP', 'Khabarhub', 'khabarhub', 'https://english.khabarhub.com/', 'english.khabarhub.com', 'https://english.khabarhub.com/feed/', 'en',
      'ONLINE_NEWS', 'RSS 12 items, 12 in 3 days, newest 2026-11-04', 'Nepali online news site (English edition).',
      ['commercial_generalist'], "Site d'information népalais (édition anglaise).", 'Actualité népalaise en anglais.'),
    g('KZ', 'Tengrinews', 'tengrinews', 'https://tengrinews.kz/', 'tengrinews.kz', 'https://tengrinews.kz/news.rss', 'ru',
      'ONLINE_NEWS', 'RSS 105 items, 103 in 3 days, newest 2026-11-04', 'Major Kazakh news portal.',
      ['commercial_generalist'], "Grand portail d'information kazakh.", 'Actualité kazakhe et internationale en russe.'),
    g('KZ', 'Kursiv', 'kursiv-kz', 'https://kz.kursiv.media/', 'kz.kursiv.media', 'https://kz.kursiv.media/feed/', 'ru',
      'ONLINE_NEWS', 'RSS 100 items, 100 in 3 days, newest 2026-11-04', 'Kazakh business news outlet.',
      ['specialist'], "Média kazakh d'information économique.", 'Économie, finances et entreprises au Kazakhstan, en russe.'),
    g('UZ', 'Kun.uz', 'kun-uz', 'https://kun.uz/', 'kun.uz', 'https://kun.uz/news/rss', 'uz',
      'ONLINE_NEWS', 'RSS 15 items, 15 in 3 days, newest 2026-11-03', 'Major Uzbek news portal.',
      ['commercial_generalist'], "Grand portail d'information ouzbek.", 'Actualité ouzbèke et internationale en ouzbek.'),
    g('UZ', 'Daryo', 'daryo', 'https://daryo.uz/', 'daryo.uz', 'https://daryo.uz/feed', 'uz',
      'ONLINE_NEWS', 'RSS 30 items, 30 in 3 days, newest 2026-11-04', 'Major Uzbek news portal.',
      ['commercial_generalist'], "Grand portail d'information ouzbek.", 'Actualité ouzbèke et internationale en ouzbek.'),
    g('AM', 'Hetq', 'hetq', 'https://hetq.am/', 'hetq.am', 'https://hetq.am/en/rss', 'en',
      'ONLINE_NEWS', 'RSS 51 items, 15 in 3 days, newest 2026-11-04', 'Armenian investigative news outlet.',
      ['independent'], "Média d'investigation arménien.", 'Enquêtes, corruption et société arméniennes en anglais.',
      own='Média associatif', ev="Se présente comme média d'investigation indépendant ; financement non vérifié pour ce profil."),
    g('GE', 'JAMnews', 'jamnews', 'https://jam-news.net/', 'jam-news.net', 'https://jam-news.net/feed/', 'en',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-03', 'Caucasus regional news outlet based in Tbilisi.',
      ['independent'], "Média régional du Caucase basé à Tbilissi.", 'Actualité de Géorgie, Arménie et Azerbaïdjan en anglais.',
      ev="Se présente comme média indépendant ; financement non vérifié pour ce profil."),
    g('GE', 'Netgazeti', 'netgazeti', 'https://netgazeti.ge/', 'netgazeti.ge', 'https://netgazeti.ge/feed/', 'ka',
      'ONLINE_NEWS', 'RSS 32 items, 32 in 3 days, newest 2026-11-03', 'Independent Georgian online news outlet.',
      ['independent'], 'Média géorgien indépendant en ligne.', 'Politique, société et droits en Géorgie, en géorgien.',
      ev="Se présente comme média indépendant ; financement non vérifié pour ce profil."),
    g('CA', 'The Globe and Mail', 'the-globe-and-mail', 'https://www.theglobeandmail.com/', 'theglobeandmail.com',
      'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/', 'en',
      'NEWSPAPER', 'RSS 100 items, 41 in 3 days, newest 2026-11-04', 'Canadian national daily newspaper, Toronto.',
      ['commercial_generalist'], 'Quotidien national canadien, Toronto.', 'Actualité canadienne en anglais (fil Canada).',
      own='Presse écrite privée', owner='Woodbridge Company (non vérifié)'),
    g('CA', 'Le Devoir', 'le-devoir', 'https://www.ledevoir.com/', 'ledevoir.com', 'https://www.ledevoir.com/rss/manchettes.xml', 'fr',
      'NEWSPAPER', 'RSS 36 items, 36 in 3 days, newest 2026-11-03', 'Montreal French-language daily newspaper.',
      ['independent'], 'Quotidien montréalais de langue française.', 'Actualité québécoise, canadienne et internationale en français.',
      own='Presse écrite privée', ev="Se présente comme quotidien indépendant ; structure de propriété non vérifiée pour ce profil."),
]

assert len(P) == 24
slugs = ','.join(q(p['slug']) for p in P)
doms = ','.join(q(p['dom']) for p in P)
feeds = ','.join(q(p['feed']) for p in P)


def block(p):
    srcs = json.dumps([dict(url=u, note=n, category=c, accessed_at=DAY) for u, n, c in p['src']], ensure_ascii=False)
    detail = f"Added on owner approval {DAY} (country at 1-2 live publishers); {p['check']} {TAG}"
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


apply = f"""-- GENERATED by Build-Sql.py. Build #147 (MEDIUM): 24 RSS publishers for BY, UA, AF, MV, KG, AZ, TM, NP, KZ, UZ, AM, GE, CA.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the twenty-four is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('kloop', 'ukrinform', 'chronicles-of-turkmenistan') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #147 (all tables with a FK to publishers, children first).
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
