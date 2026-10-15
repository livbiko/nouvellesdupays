# Generates apply.sql, rehearse.sql (same body, ROLLBACK) and reverse.sql for the editorial profiles of the six
# Egyptian publishers added in Build #70. Same shape and language (French) as the existing 554 profiles; evidence
# researched 2026-10-15, every source in evidence_sources. Text is dollar-quoted ($$...$$), JSON included.
import json

D = '2026-10-15'


def src(url, note, category):
    return {'url': url, 'note': note, 'category': category, 'accessed_at': D}


MOM_EMG = src('https://egypt.mom-rsf.org/en/owners/companies/detail/company/company/show/egyptian-media-group/',
              'Egyptian Media Group détenue par Eagle Capital, société d’investissement d’État appartenant aux Renseignements généraux (données 2018)', 'media_research')
SMM_EMG = src('https://statemediamonitor.com/2026/06/egyptian-media-group-emg/',
              'Al-Watan listé parmi les titres du groupe ; contrôle ultime par l’appareil sécuritaire via Eagle Capital (juin 2026)', 'media_research')
BUSINESS_NEWS = [
    src('https://cpj.org/data/people/mostafa-sakr/', 'Mostafa Sakr propriétaire de Business News ; gestion confiée à Akhbar El-Yom après le gel de ses avoirs en décembre 2016 ; détenu avril 2020 - mars 2021', 'press_freedom'),
    src('https://egyptianstreets.com/2017/08/20/state-run-newspaper-akhbar-al-youm-to-take-over-daily-news-egypt/', 'Le journal public Akhbar El-Yom prend la gestion de Business News (août 2017)', 'press'),
    src('https://www.middleeasteye.net/news/egypt-newspaper-arrested-over-government-currency-article', 'Arrestation de Mostafa Sakr en avril 2020 ; comité gouvernemental à la tête des titres depuis 2017', 'press'),
]

# publisher_id, name, ownership_type, owner, tags, party, historical, current, confidence, summary, sources, review
P = [
    (8980, 'Daily News Egypt',
     'Business News for Press, Publishing and Distribution (privée, avoirs gelés, gestion publique)',
     'Mostafa Sakr (propriétaire formel) ; gestion assurée depuis 2017 par le groupe public Akhbar El-Yom',
     ['government_aligned'], None,
     'Fondé en 2005 (Egyptian Media Services), repris en 2012 par Business News, éditeur du quotidien économique Al Borsa.',
     'Depuis le gel des avoirs de son propriétaire en décembre 2016 (liens présumés avec les Frères musulmans), le titre est géré par le groupe de presse public Akhbar El-Yom ; le propriétaire n’en contrôle plus la gestion. Le site se présente comme libre de toute interférence politique. Site bloqué en Égypte depuis mai 2017.',
     'medium', 'Gestion publique documentée par le CPJ, Egyptian Streets et Middle East Eye ; situation en 2026 non reconfirmée.',
     BUSINESS_NEWS + [src('https://www.dailynewsegypt.com/daily-news-egypt-ownership-and-funding-information/', 'Page propriété et financement du titre : propriété de Business News, également éditeur d’Al Borsa', 'self_described')],
     True),
    (8978, 'Al Borsa',
     'Business News for Press, Publishing and Distribution (privée, avoirs gelés, gestion publique)',
     'Mostafa Sakr (propriétaire formel, rédacteur en chef 2008-2017) ; gestion assurée depuis 2017 par le groupe public Akhbar El-Yom',
     ['government_aligned', 'specialist'], None,
     'Quotidien économique et financier lancé par Business News en 2008 ; même éditeur que Daily News Egypt.',
     'Même situation que Daily News Egypt : avoirs du propriétaire gelés en décembre 2016, gestion confiée au groupe public Akhbar El-Yom ; le propriétaire a été détenu d’avril 2020 à mars 2021 après un article sur la politique monétaire. Site bloqué en Égypte depuis mai 2017.',
     'medium', 'Gestion publique documentée par le CPJ, Egyptian Streets et Middle East Eye ; situation en 2026 non reconfirmée.',
     BUSINESS_NEWS, True),
    (8982, 'El Watan News',
     'Future Company for Publishing, Circulation and Press, sous le contrôle de la Société Unie des Services Médiatiques (United Media Services)',
     'United Media Services (ex-Egyptian Media Group), liée aux Renseignements généraux via Eagle Capital ; fondé par Mohamed Al-Amin',
     ['government_aligned'], None,
     'Quotidien et portail fondés en 2012 par l’homme d’affaires Mohamed Al-Amin (groupe CBC). L’accord de 2018 entre Al-Amin et Egyptian Media Group ne portait pas encore sur Al-Watan (Media Ownership Monitor, 2018).',
     'En août 2023, United Media Services a nommé le rédacteur en chef du journal et du site ; le titre figure parmi les médias du groupe, que RSF et State Media Monitor décrivent comme contrôlé par les services de renseignement.',
     'high', 'Fondation et propriétaire d’origine documentés par Media Ownership Monitor ; contrôle actuel attesté par la nomination de 2023 et par State Media Monitor (2026).',
     [src('https://egypt.mom-rsf.org/en/media/detail/outlet/al-watan/', 'Al Watan fondé en 2012, appartenant à Mohamed Al-Amin via Future Company (données 2018)', 'media_research'),
      src('https://www.youm7.com/story/2023/8/8/%D8%A7%D9%84%D9%85%D8%AA%D8%AD%D8%AF%D8%A9-%D9%84%D9%84%D8%AE%D8%AF%D9%85%D8%A7%D8%AA-%D8%A7%D9%84%D8%A5%D8%B9%D9%84%D8%A7%D9%85%D9%8A%D8%A9-%D8%AA%D8%B9%D9%84%D9%86-%D8%AA%D8%B9%D9%8A%D9%8A%D9%86-%D9%85%D8%B5%D8%B7%D9%81%D9%89-%D8%B9%D9%85%D8%A7%D8%B1-%D8%B1%D8%A6%D9%8A%D8%B3%D8%A7-%D9%84%D8%AA%D8%AD%D8%B1%D9%8A%D8%B1-%D8%AC%D8%B1%D9%8A%D8%AF%D8%A9/6266680', 'United Media Services nomme Mostafa Ammar rédacteur en chef du journal et du site Al-Watan (8 août 2023)', 'press'),
      SMM_EMG, MOM_EMG],
     False),
    (8983, 'Mada Masr',
     'Mada Masr Media Company (privée, actionnariat non publié)',
     'Fondé par Lina Attalah et d’anciens journalistes d’Egypt Independent ; actionnariat non divulgué',
     ['independent'], None,
     'Fondé le 30 juin 2013 par Lina Attalah, ancienne rédactrice en chef d’Egypt Independent, après la fermeture de l’édition imprimée de ce titre.',
     'Média critique des politiques du pouvoir : site bloqué en Égypte depuis mai 2017, locaux perquisitionnés en 2019 après un article sur le fils du président, journalistes poursuivis. Continue de publier via des sites miroirs.',
     'high', 'Indépendance éditoriale documentée par Media Ownership Monitor, le CPJ et la presse internationale ; actionnariat non publié par le titre.',
     [src('https://egypt.mom-rsf.org/en/media/detail/outlet/mada-masr/', 'Fondation 2013, contenu critique du pouvoir, blocage 2017 ; actionnariat non communiqué (données 2018-2019)', 'media_research'),
      src('https://en.wikipedia.org/wiki/Lina_Attalah', 'Fondatrice et rédactrice en chef ; blocage 2017 et perquisition 2019', 'reference'),
      src('https://www.cjr.org/q_and_a/lina-attalah-mada-masr.php', 'Entretien CJR avec Lina Attalah sur l’avenir de Mada Masr', 'press')],
     False),
    (8981, 'Egyptian Streets',
     'ES Media Network FZ LLC (privée)',
     'Mohamed Khairat (fondateur), avec les cofondateurs Mostafa Amin et Assem Emam',
     ['independent'], None,
     'Blog lancé en juillet 2012 par le journaliste Mohamed Khairat, devenu une société de médias en mars 2014.',
     'Se présente comme le premier média anglophone indépendant d’Égypte ; aucun lien avec un parti ou avec l’État documenté. La structure du capital et le financement ne sont pas publiés.',
     'medium', 'Fondateurs et société éditrice identifiés par le site lui-même et Wikipédia ; propriété et financement non publiés.',
     [src('https://egyptianstreets.com/about/', 'Page « À propos » : fondateurs, ES Media Network FZ LLC, indépendance revendiquée', 'self_described'),
      src('https://en.wikipedia.org/wiki/Egyptian_Streets', 'Historique : blog 2012, société 2014, fondateurs', 'reference'),
      src('https://mediabiasfactcheck.com/egyptian-streets/', 'Note que la propriété n’est pas clairement divulguée', 'media_research')],
     False),
    (8979, 'Cairo 24',
     'Cairo 24 for Press, Advertising and Media (privée)',
     'Mahmoud Al-Mamlouk (fondateur, directeur de Cairo for Media et rédacteur en chef) ; Twenty Four Seven for Media, société du défunt Dr Walid Mostafa, entrée comme associée',
     ['commercial_generalist'], None,
     'Site d’information générale privé ; fondé et dirigé par le journaliste Mahmoud Al-Mamlouk.',
     'Aucun lien avec l’État ou un parti trouvé dans les sources consultées, mais aucune étude indépendante de la propriété non plus. Misbar attribue au site 11 contenus trompeurs ou faux (crédibilité B).',
     'low', 'Société et fondateur identifiés par la page « Qui sommes-nous » du site et Misbar ; aucune recherche indépendante sur la propriété.',
     [src('https://www.cairo24.com/1870797', 'Page « Qui sommes-nous » : société éditrice et rédacteur en chef', 'self_described'),
      src('https://www.misbar.com/publisher/cairo24.com', 'Fiche Misbar : société Cairo 24, crédibilité B, 11 contenus trompeurs ou faux relevés', 'fact_check'),
      src('https://www.cairolive24.com/2205160', 'Dr Walid Mostafa, président du conseil des administrateurs de Cairo 24 (avis de décès)', 'self_described')],
     True),
]
N = len(P)


def dq(s):
    if s is None:
        return 'NULL'
    assert '$$' not in s
    return f'$${s}$$'


rows = []
for (pid, name, otype, owner, tags, party, hist, cur, conf, summ, sources, review) in P:
    tags_sql = 'ARRAY[' + ', '.join(f"'{t}'" for t in tags) + ']::text[]'
    js = json.dumps(sources, ensure_ascii=False)
    rows.append(f"  ({pid}, {dq(name)}, {dq(otype)}, {dq(owner)}, {tags_sql}, {dq(party)}, {dq(hist)}, {dq(cur)}, '{conf}', {dq(summ)}, {dq(js)}::jsonb, {'true' if review else 'false'})")

IDS = ', '.join(str(p[0]) for p in P)
BODY = f"""SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE prof (publisher_id int, name text, ownership_type text, owner text, classification_tags text[], political_party_association text,
  historical_context text, current_context text, confidence text, evidence_summary text, evidence_sources jsonb, review_required boolean) ON COMMIT DROP;
INSERT INTO prof VALUES
{(',' + chr(10)).join(rows)};
DO $$
DECLARE bad int; n int;
BEGIN
  -- Each target must be the Egyptian publisher of that name, and must not have a profile yet.
  SELECT count(*) INTO bad FROM prof x
   WHERE NOT EXISTS (SELECT 1 FROM publishers p JOIN countries c ON c.id = p.country_id
                      WHERE p.id = x.publisher_id AND p.name = x.name AND c.iso_code = 'EG')
      OR EXISTS (SELECT 1 FROM editorial_profiles e WHERE e.publisher_id = x.publisher_id);
  IF bad > 0 THEN RAISE EXCEPTION '% of {N} publishers are not the expected Egyptian outlet or already have a profile - nothing changed', bad; END IF;
  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association, historical_context,
    current_context, confidence, evidence_summary, evidence_sources, classification_date, last_reviewed, evidence_date, review_required)
  SELECT publisher_id, ownership_type, owner, classification_tags, political_party_association, historical_context,
    current_context, confidence, evidence_summary, evidence_sources, DATE '{D}', DATE '{D}', DATE '{D}', review_required FROM prof;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {N} THEN RAISE EXCEPTION 'inserted %, expected {N}', n; END IF;
END $$;
SELECT 'profile|' || p.id || '|' || p.name || '|' || array_to_string(e.classification_tags, ',') || '|' || e.confidence || '|review ' || e.review_required
       || '|' || jsonb_array_length(e.evidence_sources) || ' sources'
  FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id WHERE e.publisher_id IN ({IDS}) ORDER BY p.id;
SELECT 'egypt|' || count(e.id) || ' of ' || count(*) || ' Egyptian publishers have a profile'
  FROM publishers p JOIN countries c ON c.id = p.country_id LEFT JOIN editorial_profiles e ON e.publisher_id = p.id WHERE c.iso_code = 'EG';"""

HDR = '\\set ON_ERROR_STOP on\n'
with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Editorial profiles for the six Egyptian publishers of Build #70 (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'rolledback|' || count(*) || ' profiles for these publishers' FROM editorial_profiles WHERE publisher_id IN ({IDS});\n")
with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Reverse of apply.sql: removes the six profiles (only if they are still the ones written on {D}). Generated by Build-Sql.py.
{HDR}SET lock_timeout = '5s';
BEGIN;
DO $$ DECLARE n int; BEGIN
  DELETE FROM editorial_profiles WHERE publisher_id IN ({IDS}) AND classification_date = DATE '{D}';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {N} THEN RAISE EXCEPTION 'deleted %, expected {N} - rolled back', n; END IF;
END $$;
COMMIT;
SELECT 'reversed|' || count(*) || ' profiles left for these publishers' FROM editorial_profiles WHERE publisher_id IN ({IDS});
""")
print('ok', N)
