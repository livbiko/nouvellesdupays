# Build #94 - editorial profiles for the six publishers added in Build #93 (data only, MEDIUM).
# Generates apply.sql, rehearse.sql (same body, ROLLBACK) and reverse.sql. Same shape and language (French) as the
# existing profiles. The five Asia Pacific Report feeds reuse the sourced profile of the existing APR publishers
# (2070/2072/2076, classified 2026-09-15); Island Times researched 2026-10-18. Text is dollar-quoted ($$...$$).
import json

D = '2026-10-18'


def src(url, note, category):
    return {'url': url, 'note': note, 'category': category, 'accessed_at': D}


APR_SRC = [src('https://asiapacificreport.nz/about/',
               'Coentreprise à but non lucratif entre Multimedia Investments Ltd et Cafe Pacific Media ; issu du Pacific Media Centre (AUT), indépendant depuis la fermeture du centre le 19 décembre 2020',
               'self_described')]
APR_HIST = ("Asia Pacific Report a été fondé en 2016 avec le contenu d'étudiants en journalisme de troisième cycle du Pacific Media Centre "
            "de l'Auckland University of Technology (AUT), avant de devenir indépendant après la fermeture du cours et du centre le 19 décembre 2020.")
APR_CUR = ("Le site opère désormais comme coentreprise à but non lucratif sous licence Creative Commons, dirigé par le rédacteur David Robie, "
           "sans lien direct avec l'AUT. Flux de la rubrique {} du site.")
APR_SUMM = 'Le site lui-même confirme la structure de coentreprise à but non lucratif et la rupture du lien universitaire depuis fin 2020 ; même profil que les autres flux Asia Pacific Report.'

# publisher_id, name, iso, ownership_type, owner, tags, party, historical, current, confidence, summary, sources, review
P = [(pid, name, iso, 'Coentreprise à but non lucratif',
      'Multimedia Investments Ltd et Cafe Pacific Media, en association avec Asia Pacific Media Network',
      ['independent'], None, APR_HIST, APR_CUR.format(rubric), 'high', APR_SUMM, APR_SRC, False)
     for (pid, name, iso, rubric) in [
         (8996, 'Asia Pacific Report: Kiribati', 'KI', 'Kiribati'),
         (8997, 'Asia Pacific Report: Marshall Islands', 'MH', 'Îles Marshall'),
         (8998, 'Asia Pacific Report: Nauru', 'NR', 'Nauru'),
         (9000, 'Asia Pacific Report: Solomon Islands', 'SB', 'Îles Salomon'),
         (9001, 'Asia Pacific Report: Tuvalu', 'TV', 'Tuvalu'),
     ]]
P.append((8999, 'Island Times', 'PW', 'Entreprise de presse privée (structure du capital non publiée)',
          'Leilani Reklai (éditrice et rédactrice en chef)',
          ['commercial_generalist'], None,
          "Journal privé de Koror présenté par la PINA comme le principal journal des Palaos : deux éditions par semaine, "
          "plus de 800 exemplaires, diffusé surtout à Koror et Airai, avec un site web.",
          "Son éditrice, Leilani Reklai, est aussi femme politique (gouverneure de l'État d'Aimeliik depuis 2007) ; aucune ligne "
          "partisane du journal n'est documentée dans les sources consultées. En octobre 2024, le journal et son éditrice ont été "
          "poursuivis en diffamation par la société Surangel and Sons au sujet d'un article du 29 octobre ; le Palau Media Council "
          "a dénoncé une atteinte à la liberté de la presse.",
          'low',
          "Éditrice, périodicité et diffusion documentées par la PINA et Wikipédia ; propriété et financement non publiés. "
          "Le mandat politique de l'éditrice justifie une revue.",
          [src('https://pina.com.fj/pina-members/island-times/', 'Fiche membre PINA : éditrice Leilani Reklai, deux éditions par semaine, plus de 800 exemplaires', 'media_research'),
           src('https://en.wikipedia.org/wiki/Leilani_Reklai', "Rédactrice en chef de l'Island Times, gouverneure d'Aimeliik depuis 2007 ; plainte en diffamation de Surangel and Sons (octobre 2024)", 'reference'),
           src('https://www.mvariety.com/news/regional_world/palau-media-council-lawsuit-against-island-times-an-assault-on-press-freedom/article_7dda9d8a-99ef-11ef-866e-eb917757b3e7.html/',
               'Le Palau Media Council qualifie la plainte contre Island Times d’atteinte à la liberté de la presse (titre de l’article)', 'press_freedom')],
          True))
N = len(P)


def dq(s):
    if s is None:
        return 'NULL'
    assert '$$' not in s
    return f'$${s}$$'


rows = []
for (pid, name, iso, otype, owner, tags, party, hist, cur, conf, summ, sources, review) in P:
    tags_sql = 'ARRAY[' + ', '.join(f"'{t}'" for t in tags) + ']::text[]'
    js = json.dumps(sources, ensure_ascii=False)
    rows.append(f"  ({pid}, {dq(name)}, '{iso}', {dq(otype)}, {dq(owner)}, {tags_sql}, {dq(party)}, {dq(hist)}, {dq(cur)}, '{conf}', {dq(summ)}, {dq(js)}::jsonb, {'true' if review else 'false'})")

IDS = ', '.join(str(p[0]) for p in P)
BODY = f"""SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE prof (publisher_id int, name text, iso text, ownership_type text, owner text, classification_tags text[], political_party_association text,
  historical_context text, current_context text, confidence text, evidence_summary text, evidence_sources jsonb, review_required boolean) ON COMMIT DROP;
INSERT INTO prof VALUES
{(',' + chr(10)).join(rows)};
DO $$
DECLARE bad int; n int;
BEGIN
  -- Each target must be the publisher of that name in that country, and must not have a profile yet.
  SELECT count(*) INTO bad FROM prof x
   WHERE NOT EXISTS (SELECT 1 FROM publishers p JOIN countries c ON c.id = p.country_id
                      WHERE p.id = x.publisher_id AND p.name = x.name AND c.iso_code = x.iso)
      OR EXISTS (SELECT 1 FROM editorial_profiles e WHERE e.publisher_id = x.publisher_id);
  IF bad > 0 THEN RAISE EXCEPTION '% of {N} publishers are not the expected outlet or already have a profile - nothing changed', bad; END IF;
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
SELECT 'gap|' || count(*) || ' active publishers without a profile'
  FROM publishers p LEFT JOIN editorial_profiles e ON e.publisher_id = p.id WHERE p.feed_status = 'active' AND e.id IS NULL;"""

HDR = '\\set ON_ERROR_STOP on\n'
with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #94: editorial profiles for the six Build #93 publishers (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
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
