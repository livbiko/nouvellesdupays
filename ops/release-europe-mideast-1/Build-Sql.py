# Generates apply / rehearse / reverse SQL for Build #148: 34 RSS publishers for Europe (18 countries) and the Middle East
# (SA, YE, IL). Owner, 2026-11-04: "yes, add the 34". Same shape as Build #147.
import json, os

TAG = '[added by Claude 2026-11-04, Europe-Middle East 1]'
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
INDP = "Se présente comme média indépendant ; financement et propriétaire non vérifiés pour ce profil."
PUB = 'Radiodiffuseur public ; gouvernance non vérifiée pour ce profil.'
P = [
    g('SA', 'Asharq Al-Awsat', 'asharq-al-awsat', 'https://aawsat.com/', 'aawsat.com', 'https://aawsat.com/feed', 'ar',
      'NEWSPAPER', 'RSS 300 items, 300 in 3 days, newest 2026-11-04', 'Pan-Arab daily newspaper, Saudi-owned (SRMG), published from London.',
      ['government_aligned'], 'Quotidien panarabe publié à Londres, propriété du groupe saoudien SRMG.',
      'Actualité arabe et internationale en arabe, ligne proche des positions saoudiennes.', own='Presse écrite privée',
      owner='Saudi Research and Media Group (SRMG)', ev="Propriété du groupe SRMG, proche du pouvoir saoudien ; alignement à revoir.", conf='medium'),
    g('SA', 'Asharq Al-Awsat English', 'asharq-al-awsat-english', 'https://english.aawsat.com/', 'english.aawsat.com', 'https://english.aawsat.com/feed', 'en',
      'NEWSPAPER', 'RSS 300 items, 191 in 3 days, newest 2026-11-04', 'English-language site of Asharq Al-Awsat.',
      ['government_aligned'], "Site anglophone d'Asharq Al-Awsat (groupe saoudien SRMG).",
      'Actualité arabe et internationale en anglais.', own='Presse écrite privée',
      owner='Saudi Research and Media Group (SRMG)', ev="Propriété du groupe SRMG, proche du pouvoir saoudien ; alignement à revoir.", conf='medium'),
    g('YE', 'Aden Al-Ghad', 'aden-al-ghad', 'https://www.adengad.net/', 'adengad.net', 'https://www.adengad.net/feed', 'ar',
      'NEWSPAPER', 'RSS 25 items, 25 in 3 days, newest 2026-11-04', 'Yemeni daily newspaper and news site based in Aden.',
      ['unknown'], "Quotidien et site d'information yéménite basé à Aden.", 'Actualité du sud du Yémen et nationale en arabe.',
      ev='Alignement politique et propriétaire non établis pour ce profil.'),
    g('IL', 'Globes', 'globes', 'https://www.globes.co.il/', 'globes.co.il',
      'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=1725', 'en',
      'NEWSPAPER', 'RSS 93 items, 21 in 3 days, newest 2026-11-04', 'Israeli business daily (English edition).',
      ['specialist'], 'Quotidien économique israélien (édition anglaise).', 'Économie, technologie et marchés israéliens en anglais.',
      own='Presse écrite privée'),
    g('LU', 'Reporter.lu', 'reporter-lu', 'https://www.reporter.lu/', 'reporter.lu', 'https://www.reporter.lu/feed', 'de',
      'ONLINE_NEWS', 'RSS 10 items, 3 in 3 days, newest 2026-11-04', 'Independent Luxembourg investigative news magazine.',
      ['independent'], "Magazine d'investigation luxembourgeois indépendant en ligne.",
      'Enquêtes, politique et société luxembourgeoises en allemand et en français.', ev=INDP),
    g('DK', 'Berlingske', 'berlingske', 'https://www.berlingske.dk/', 'berlingske.dk', 'https://www.berlingske.dk/content/rss', 'da',
      'NEWSPAPER', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'Danish national daily newspaper, Copenhagen.',
      ['commercial_generalist'], 'Quotidien national danois, Copenhague.', 'Actualité danoise et internationale en danois.',
      own='Presse écrite privée'),
    g('DK', 'Information', 'information-dk', 'https://www.information.dk/', 'information.dk', 'https://www.information.dk/feed', 'da',
      'NEWSPAPER', 'RSS 21 items, 21 in 3 days, newest 2026-11-04', 'Danish national daily newspaper.',
      ['independent'], 'Quotidien national danois.', 'Politique, culture et international en danois.', own='Presse écrite privée', ev=INDP),
    g('DK', 'Altinget', 'altinget', 'https://www.altinget.dk/', 'altinget.dk', 'https://www.altinget.dk/rss', 'da',
      'ONLINE_NEWS', 'RSS 16 items, 13 in 3 days, newest 2026-11-04', 'Danish political news outlet.',
      ['specialist'], "Média danois d'information politique.", 'Politique danoise et débats de fond en danois.'),
    g('EE', 'ERR', 'err-ee', 'https://www.err.ee/', 'err.ee', 'https://www.err.ee/rss', 'et',
      'TV', 'RSS 51 items, 50 in 3 days, newest 2026-11-04', 'Estonian Public Broadcasting, Estonian-language news.',
      ['public_state'], "Eesti Rahvusringhääling (ERR), radiodiffuseur public estonien ; l'édition anglaise est déjà suivie.",
      'Actualité estonienne et internationale en estonien.', own='Radiodiffuseur public',
      owner='Eesti Rahvusringhääling (État estonien)', ev=PUB, conf='medium'),
    g('EE', 'Äripäev', 'aripaev', 'https://www.aripaev.ee/', 'aripaev.ee', 'https://www.aripaev.ee/rss', 'et',
      'NEWSPAPER', 'RSS 25 items, 25 in 3 days, newest 2026-11-04', 'Estonian business daily newspaper.',
      ['specialist'], 'Quotidien économique estonien.', 'Économie, entreprises et énergie en Estonie, en estonien.',
      own='Presse écrite privée', owner='AS Äripäev'),
    g('MK', 'Plusinfo', 'plusinfo', 'https://www.plusinfo.mk/', 'plusinfo.mk', 'https://www.plusinfo.mk/rss', 'mk',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'Macedonian online news site.',
      ['commercial_generalist'], "Site d'information macédonien en ligne.", 'Actualité macédonienne en macédonien.'),
    g('MK', 'Radio MOF', 'radio-mof', 'https://www.radiomof.mk/', 'radiomof.mk', 'https://www.radiomof.mk/feed/', 'mk',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'Independent Macedonian online radio and news outlet.',
      ['independent'], "Radio en ligne et média d'information macédonien indépendant.",
      'Société, culture et politique macédoniennes en macédonien.', ev=INDP),
    g('MT', 'The Shift', 'the-shift-news', 'https://theshiftnews.com/', 'theshiftnews.com', 'https://theshiftnews.com/feed/', 'en',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'Independent Maltese investigative news outlet.',
      ['independent'], "Média d'investigation maltais indépendant.", 'Corruption, gouvernance et justice à Malte, en anglais.', ev=INDP),
    g('DE', 'Frankfurter Allgemeine Zeitung', 'faz', 'https://www.faz.net/', 'faz.net', 'https://www.faz.net/rss/aktuell/', 'de',
      'NEWSPAPER', 'RSS 163 items, 103 in 3 days, newest 2026-11-04', 'German national daily newspaper, Frankfurt.',
      ['commercial_generalist'], 'Quotidien national allemand, Francfort.', 'Actualité allemande et internationale en allemand.',
      own='Presse écrite privée', owner='FAZIT-Stiftung (non vérifié)'),
    g('AT', 'Die Presse', 'die-presse', 'https://www.diepresse.com/', 'diepresse.com', 'https://www.diepresse.com/rss', 'de',
      'NEWSPAPER', 'RSS 78 items, 65 in 3 days, newest 2026-11-04', 'Austrian national daily newspaper, Vienna.',
      ['commercial_generalist'], 'Quotidien national autrichien, Vienne.', 'Actualité autrichienne et internationale en allemand.',
      own='Presse écrite privée'),
    g('AT', 'Kurier', 'kurier', 'https://kurier.at/', 'kurier.at', 'https://kurier.at/xml/rssd', 'de',
      'NEWSPAPER', 'RSS 21 items, 21 in 3 days, newest 2026-11-04', 'Austrian national daily newspaper, Vienna.',
      ['commercial_generalist'], 'Quotidien national autrichien, Vienne.', 'Actualité autrichienne et internationale en allemand.',
      own='Presse écrite privée'),
    g('CH', 'RTS Info', 'rts-info', 'https://www.rts.ch/', 'rts.ch', 'https://www.rts.ch/info/?format=rss/news', 'fr',
      'TV', 'RSS 26 items, 26 in 3 days, newest 2026-11-04', 'Radio Télévision Suisse, French-language public broadcaster.',
      ['public_state'], 'Radio Télévision Suisse (RTS), radiodiffuseur public de Suisse romande (SSR).',
      'Actualité suisse et internationale en français.', own='Radiodiffuseur public', owner='SRG SSR', ev=PUB, conf='medium'),
    g('SE', 'Aftonbladet', 'aftonbladet', 'https://www.aftonbladet.se/', 'aftonbladet.se', 'https://www.aftonbladet.se/rss.xml', 'sv',
      'NEWSPAPER', 'RSS 39 items, 39 in 3 days, newest 2026-11-04', 'Swedish national daily newspaper.',
      ['commercial_generalist'], 'Quotidien national suédois.', 'Actualité suédoise et internationale en suédois.',
      own='Presse écrite privée', owner='Schibsted (non vérifié)'),
    g('SE', 'Expressen', 'expressen', 'https://www.expressen.se/', 'expressen.se', 'https://www.expressen.se/rss/nyheter', 'sv',
      'NEWSPAPER', 'RSS 20 items, 20 in 3 days, newest 2026-11-04', 'Swedish national daily newspaper.',
      ['commercial_generalist'], 'Quotidien national suédois.', 'Actualité suédoise et internationale en suédois.',
      own='Presse écrite privée', owner='Bonnier (non vérifié)'),
    g('IE', 'The Irish Times', 'the-irish-times', 'https://www.irishtimes.com/', 'irishtimes.com',
      'https://www.irishtimes.com/arc/outboundfeeds/feed-irish-news/', 'en',
      'NEWSPAPER', 'RSS 100 items, 80 in 3 days, newest 2026-11-04', 'Irish national daily newspaper, Dublin.',
      ['commercial_generalist'], 'Quotidien national irlandais, Dublin.', 'Actualité irlandaise en anglais (fil Irlande).',
      own='Presse écrite privée', owner='The Irish Times Trust (non vérifié)'),
    g('CZ', 'Seznam Zprávy', 'seznam-zpravy', 'https://www.seznamzpravy.cz/', 'seznamzpravy.cz', 'https://www.seznamzpravy.cz/rss', 'cs',
      'ONLINE_NEWS', 'RSS 30 items, 30 in 3 days, newest 2026-11-04', 'Czech online news outlet.',
      ['commercial_generalist'], "Média d'information tchèque en ligne.", 'Actualité tchèque et internationale en tchèque.',
      owner='Seznam.cz (non vérifié)'),
    g('CZ', 'Deník N', 'denik-n', 'https://denikn.cz/', 'denikn.cz', 'https://www.denikn.cz/feed/', 'cs',
      'NEWSPAPER', 'RSS 40 items, 40 in 3 days, newest 2026-11-04', 'Independent Czech daily newspaper.',
      ['independent'], 'Quotidien tchèque indépendant.', 'Politique, société et international en tchèque.', ev=INDP),
    g('SK', 'Pravda', 'pravda-sk', 'https://www.pravda.sk/', 'pravda.sk', 'https://www.pravda.sk/rss/xml/', 'sk',
      'NEWSPAPER', 'RSS 21 items, 21 in 3 days, newest 2026-11-04', 'Slovak national daily newspaper.',
      ['commercial_generalist'], 'Quotidien national slovaque.', 'Actualité slovaque et internationale en slovaque.',
      own='Presse écrite privée'),
    g('SK', 'TERAZ (TASR)', 'teraz-tasr', 'https://www.teraz.sk/', 'teraz.sk', 'https://www.teraz.sk/rss/vsetky-spravy.rss', 'sk',
      'NEWS_AGENCY', 'RSS 15 items, 15 in 3 days, newest 2026-11-04', 'News site of TASR, the Slovak national news agency.',
      ['public_state'], "Site d'information de la TASR, agence de presse nationale slovaque.",
      'Actualité institutionnelle et nationale slovaque en slovaque.', own='Agence de presse publique',
      owner='TASR (État slovaque)', ev='Agence publique ; gouvernance non vérifiée pour ce profil.', conf='medium'),
    g('CY', 'Philenews', 'philenews', 'https://www.philenews.com/', 'philenews.com', 'https://www.philenews.com/feed/', 'el',
      'NEWSPAPER', 'RSS 20 items, 20 in 3 days, newest 2026-11-04', 'Greek-language site of Phileleftheros, Cypriot daily newspaper.',
      ['commercial_generalist'], "Site en grec du quotidien chypriote Phileleftheros ; l'édition anglaise (in-cyprus) est déjà suivie.",
      'Actualité chypriote en grec.', own='Presse écrite privée'),
    g('CY', 'Politis', 'politis-cy', 'https://www.politis.com.cy/', 'politis.com.cy', 'https://www.politis.com.cy/feed/', 'el',
      'NEWSPAPER', 'RSS 12 items, 12 in 3 days, newest 2026-11-04', 'Cypriot daily newspaper, Nicosia.',
      ['commercial_generalist'], 'Quotidien chypriote, Nicosie.', 'Actualité chypriote en grec.', own='Presse écrite privée'),
    g('LT', 'Verslo žinios', 'verslo-zinios', 'https://www.vz.lt/', 'vz.lt', 'https://www.vz.lt/rss', 'lt',
      'NEWSPAPER', 'RSS 50 items, 50 in 3 days, newest 2026-11-04', 'Lithuanian business daily newspaper.',
      ['specialist'], 'Quotidien économique lituanien.', 'Économie, entreprises et finances en Lituanie, en lituanien.',
      own='Presse écrite privée'),
    g('LV', 'Diena', 'diena', 'https://www.diena.lv/', 'diena.lv', 'https://www.diena.lv/rss', 'lv',
      'NEWSPAPER', 'RSS 50 items, 50 in 3 days, newest 2026-11-04', 'Latvian daily newspaper, Riga.',
      ['commercial_generalist'], 'Quotidien letton, Riga.', 'Actualité lettone et internationale en letton.', own='Presse écrite privée'),
    g('LV', 'LA.LV', 'la-lv', 'https://www.la.lv/', 'la.lv', 'https://www.la.lv/feed', 'lv',
      'NEWSPAPER', 'RSS 40 items, 40 in 3 days, newest 2026-11-04', 'Latvian news site (Latvijas Avīze).',
      ['commercial_generalist'], "Site d'information letton (Latvijas Avīze).", 'Actualité lettone en letton.', own='Presse écrite privée'),
    g('RS', 'B92', 'b92', 'https://www.b92.net/', 'b92.net', 'https://www.b92.net/info/rss/vesti.xml', 'sr',
      'TV', 'RSS 20 items, 20 in 3 days, newest 2026-11-04', 'News site of the Serbian broadcaster B92.',
      ['commercial_generalist'], 'Site d’information du diffuseur serbe B92.', 'Actualité serbe et internationale en serbe.',
      own='Télévision privée'),
    g('RS', 'Vreme', 'vreme', 'https://www.vreme.com/', 'vreme.com', 'https://www.vreme.com/feed/', 'sr',
      'NEWSPAPER', 'RSS 12 items, 12 in 3 days, newest 2026-11-04', 'Independent Serbian weekly news magazine, Belgrade.',
      ['independent'], 'Hebdomadaire serbe indépendant, Belgrade.', 'Politique, justice et société serbes en serbe.',
      own='Presse écrite privée', ev=INDP),
    g('XK', 'Prishtina Insight', 'prishtina-insight', 'https://prishtinainsight.com/', 'prishtinainsight.com', 'https://prishtinainsight.com/feed/', 'en',
      'ONLINE_NEWS', 'RSS 5 items, 5 in 3 days, newest 2026-11-04', 'Kosovo English-language news outlet (BIRN Kosovo).',
      ['independent'], "Média kosovar de langue anglaise (BIRN Kosovo).", 'Politique, justice et société au Kosovo, en anglais.', ev=INDP),
    g('AL', 'Balkanweb', 'balkanweb', 'https://www.balkanweb.com/', 'balkanweb.com', 'https://www.balkanweb.com/feed/', 'sq',
      'ONLINE_NEWS', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'Albanian online news portal (News24 group).',
      ['commercial_generalist'], "Portail d'information albanais (groupe News24).", 'Actualité albanaise et internationale en albanais.'),
    g('AL', 'ABC News Albania', 'abc-news-albania', 'https://abcnews.al/', 'abcnews.al', 'https://abcnews.al/feed/', 'sq',
      'TV', 'RSS 10 items, 10 in 3 days, newest 2026-11-04', 'Albanian television news channel.',
      ['commercial_generalist'], "Chaîne d'information télévisée albanaise.", 'Actualité albanaise en albanais.', own='Télévision privée'),
]

assert len(P) == 34
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


apply = f"""-- GENERATED by Build-Sql.py. Build #148 (MEDIUM): 34 RSS publishers for SA, YE, IL, LU, DK, EE, MK, MT, DE, AT, CH, SE, IE, CZ, SK, CY, LT, LV, RS, XK, AL.
\\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ({slugs}) OR domain IN ({doms}))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ({feeds})) THEN
    RAISE EXCEPTION 'One of the thirty-four is already present - nothing changed';
  END IF;{''.join(block(p) for p in P)}
END $do$;
SELECT p.id, p.slug, c.iso_code, p.language, f.id AS feed_id FROM publishers p JOIN countries c ON c.id = p.country_id
  JOIN feeds f ON f.publisher_id = p.id WHERE p.slug IN ({slugs}) ORDER BY p.id;
SELECT p.slug, e.classification_tags, left(e.historical_context, 60) FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN ('asharq-al-awsat', 'err-ee', 'teraz-tasr') ORDER BY 1;
COMMIT;
"""

reverse = f"""-- GENERATED by Build-Sql.py. Reverses Build #148 (all tables with a FK to publishers, children first).
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
