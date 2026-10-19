# Build #103 - second sources for single-source countries, with editorial profiles (data only, MEDIUM).
# Generates apply.sql, rehearse.sql, reverse.sql, verify.sql.
# 2026-10-19 sweep: 42 countries have at most one publisher with a dated article in 14 days (one broken feed blanks the
# country, as happened to Myanmar). Feeds checked with the NDP user agent for the larger ones; six are live with sane dates
# (none ahead of the clock). Left out: Inquirer (PH) labels Philippine time as +0000 (8 h ahead) - needs a worker option first;
# others bot-blocked (403) or without a feed. Publisher + feed + profile per source, one transaction, same shape as Build #96.
import json

D = '2026-10-19'
TAG = '[added by Claude 2026-10-19, Build #103 second sources]'


def src(url, note, category):
    return {'url': url, 'note': note, 'category': category, 'accessed_at': D}


# iso, name, homepage, feed, lang, domain, source_type, probe,
#   (ownership_type, owner, tags, historical, current, confidence, summary, sources, review)
SRC = [
    ('CO', 'Semana', 'https://www.semana.com', 'https://www.semana.com/arc/outboundfeeds/rss/?outputType=xml', 'es', 'semana.com', 'ONLINE_NEWS',
     'rss, 23 items, newest <1 h',
     ('Entreprise de presse privée', 'Groupe Gilinski (Gabriel Gilinski) via Publicaciones Semana',
      ['commercial_generalist'],
      "Fondé en 1946 par Alberto Lleras Camargo, relancé en 1983 par Felipe López Caballero ; reconnu pour ses enquêtes (Pablo Escobar, financement de la campagne d'Ernesto Samper).",
      "Le groupe Gilinski a acquis 50 % en 2019 puis la totalité en novembre 2020 ; sous la direction de Vicky Dávila (2020-2024), départ de plusieurs journalistes reconnus et virage vers un journalisme numérique polarisant, décrit par la presse comme un relais de la droite colombienne. Vicky Dávila est ensuite devenue candidate à la présidentielle avec le soutien financier de Gabriel Gilinski (2026).",
      'medium',
      "Historique documenté par Wikipédia ; rachat Gilinski et virage éditorial documentés par Infobae, Portafolio et eldiario.es ; ligne actuelle à confirmer.",
      [src('https://en.wikipedia.org/wiki/Semana', 'Fondation 1946, relance 1983, journalisme d’enquête', 'reference'),
       src('https://www.infobae.com/america/colombia/2020/11/11/nadie-los-saco-asi-justifico-gabriel-gilinski-los-cambios-de-revista-semana-y-la-renuncia-de-periodistas-reconocidos/', 'Rachat total par Gilinski (nov. 2020) et départs de journalistes', 'press'),
       src('https://www.eldiario.es/internacional/semana-revista-convertida-multimillonarios-gilinski-escudo-derecha-colombiana_1_8655149.html', 'Semana décrite comme « bouclier de la droite colombienne » sous Gilinski', 'press'),
       src('https://www.infobae.com/colombia/2026/04/15/semana-y-gabriel-gilinski-aportaron-la-mayor-parte-de-los-recursos-para-la-campana-de-recoleccion-de-firmas-de-vicky-davila/', 'Gilinski principal financeur de la collecte de signatures de Vicky Dávila (2026)', 'press')],
      True)),
    ('EC', 'El Universo', 'https://www.eluniverso.com', 'https://www.eluniverso.com/arc/outboundfeeds/rss/?outputType=xml', 'es', 'eluniverso.com', 'NEWSPAPER',
     'rss, 4 items, newest <1 h',
     ('Entreprise de presse privée familiale', 'Famille Pérez (Carlos, César et Nicolás Pérez)',
      ['commercial_generalist'],
      "Quotidien de Guayaquil fondé le 16 septembre 1921 par Ismael Pérez Pazmiño ; toujours détenu par la famille Pérez.",
      "Ligne de centre droit et conservatrice. Condamné en 2011-2012 à 42 millions de dollars dans un procès en diffamation intenté par le président Rafael Correa (gracié en février 2012) ; prix Maria Moors Cabot 2012 pour sa résistance aux pressions gouvernementales.",
      'high', "Fondation, propriété, orientation et affaire Correa documentées par Wikipédia.",
      [src('https://en.wikipedia.org/wiki/El_Universo', 'Fondé en 1921 ; famille Pérez ; centre droit ; procès Correa et prix Cabot 2012', 'reference')],
      False)),
    ('PY', 'ABC Color', 'https://www.abc.com.py', 'https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml', 'es', 'abc.com.py', 'NEWSPAPER',
     'rss, 6 items, newest <1 h',
     ('Entreprise de presse privée', 'Editorial Azeta S.A. (groupe Azeta, famille Zuccolillo)',
      ['commercial_generalist'],
      "Fondé le 8 août 1967 par Aldo Zuccolillo, d'abord favorable au régime de Stroessner puis critique à partir de la fin des années 1970 ; suspendu de force de mars 1984 à 1989.",
      "Principal quotidien du Paraguay, diffusé dans tout le pays ; aucune affiliation partisane formelle documentée.",
      'medium', "Fondation, propriétaire et histoire sous Stroessner documentés par Wikipédia.",
      [src('https://en.wikipedia.org/wiki/ABC_Color', 'Fondé en 1967 par Aldo Zuccolillo ; Editorial Azeta ; suspendu 1984-1989', 'reference')],
      False)),
    ('PA', 'La Prensa (Panamá)', 'https://www.prensa.com', 'https://www.prensa.com/arc/outboundfeeds/rss/?outputType=xml', 'es', 'prensa.com', 'NEWSPAPER',
     'rss, 17 items, newest <1 h',
     ('Entreprise de presse privée (actionnariat)', 'Corporación La Prensa ; fondé par I. Roberto Eisenmann Jr.',
      ['independent'],
      "Fondé en 1980 par Roberto Eisenmann Jr. (premier numéro le 4 août 1981) ; seul journal critique de Manuel Noriega en 1986, fermé en 1987 et 1988, rouvert en 1990.",
      "Journal de référence du Panama, décrit comme conservateur et pro-démocratie, longtemps principal journal d'opposition ; présidence élue par les actionnaires.",
      'high', "Fondation, histoire sous Noriega et orientation documentées par Wikipédia.",
      [src('https://en.wikipedia.org/wiki/La_Prensa_(Panama_City)', 'Fondé en 1980 par Eisenmann ; fermé sous Noriega ; conservateur, pro-démocratie', 'reference')],
      False)),
    ('MG', 'Midi Madagasikara', 'https://www.midi-madagasikara.mg', 'https://www.midi-madagasikara.mg/feed/', 'fr', 'midi-madagasikara.mg', 'NEWSPAPER',
     'rss, 30 items, newest 11 h',
     ('Entreprise de presse privée familiale', 'Midi Madagasikara S.A. (famille Andriambelo ; direction Juliana Rakotoarivelo Andriambelo depuis 2006)',
      ['commercial_generalist'],
      "Fondé en 1983 par Marthe Andriambelo ; premier quotidien national distribué à Madagascar, publié du lundi au samedi, surtout en français.",
      "Quotidien privé généraliste ; aucune affiliation partisane documentée dans les sources consultées.",
      'medium', "Fondation et propriété documentées par Wikipédia et AllAfrica.",
      [src('https://en.wikipedia.org/wiki/Midi_Madagasikara', 'Fondé en 1983 par Marthe Andriambelo ; Midi Madagasikara S.A. ; premier quotidien national', 'reference')],
      False)),
    ('HT', 'HaitiLibre', 'https://www.haitilibre.com', 'https://www.haitilibre.com/rss-flash-en.xml', 'en', 'haitilibre.com', 'ONLINE_NEWS',
     'rss, 15 items, newest <1 h',
     ("Site d'information privé (structure non publiée)", 'Non publié',
      ['commercial_generalist'],
      "Site d'information quotidien sur Haïti, mis à jour en continu, en français et en anglais.",
      "Se présente comme ne relayant aucune ligne idéologique et voulant mettre en lumière les aspects cachés de l'actualité ; propriété et financement non publiés.",
      'low', "Seule la page de présentation du site a été consultée ; aucune recherche indépendante sur la propriété.",
      [src('https://www.haitilibre.com/en/why-HaitiLibre.php', 'Page « Why HaitiLibre » : mission et absence de ligne idéologique revendiquée', 'self_described')],
      True)),
]
N = len(SRC)


def q(s):
    return "'" + s.replace("'", "''") + "'"


def dq(s):
    assert '$$' not in s
    return f'$${s}$$'


rows = []
for (iso, n, h, f, l, d, st, note, (ot, ow, tags, hist, cur, conf, summ, sources, review)) in SRC:
    tags_sql = 'ARRAY[' + ', '.join(q(t) for t in tags) + ']::text[]'
    rows.append(f"({q(iso)}, {q(n)}, {q(h)}, {q(f)}, {q(l)}, {q(d)}, {q(st)}, {q(note)}, {dq(ot)}, {dq(ow)}, {tags_sql}, {dq(hist)}, {dq(cur)}, "
                f"{q(conf)}, {dq(summ)}, {dq(json.dumps(sources, ensure_ascii=False))}::jsonb, {'true' if review else 'false'})")
ROWS = ',\n  '.join(rows)
TAGGED = f"verification_detail LIKE '%' || {q(TAG)}"
HDR = '\\set ON_ERROR_STOP on\n'

BODY = f"""SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE src (iso text, name text, homepage text, feed text, lang text, domain text, source_type text, note text,
  ownership_type text, owner text, tags text[], historical_context text, current_context text, confidence text,
  evidence_summary text, evidence_sources jsonb, review_required boolean) ON COMMIT DROP;
INSERT INTO src VALUES
  {ROWS};
DO $$
DECLARE bad int; n int := 0; s record; cid int; sid int; pid int;
BEGIN
  SELECT count(*) INTO bad FROM src x LEFT JOIN countries c ON c.iso_code = x.iso
   WHERE c.id IS NULL
      OR EXISTS (SELECT 1 FROM publishers p WHERE p.country_id = c.id AND (lower(p.name) = lower(x.name)
                 OR lower(regexp_replace(regexp_replace(p.domain, '^www[.]', ''), '/+$', '')) = x.domain))
      OR EXISTS (SELECT 1 FROM feeds f WHERE f.feed_url = x.feed)
      OR EXISTS (SELECT 1 FROM publisher_submissions ps WHERE ps.{TAGGED});
  IF bad > 0 THEN RAISE EXCEPTION '% of {N} already exist as a publisher, feed or earlier run (or unknown country) - nothing changed', bad; END IF;
  FOR s IN SELECT * FROM src ORDER BY iso LOOP
    SELECT id INTO cid FROM countries WHERE iso_code = s.iso;
    INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
      verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
    VALUES (s.name, s.homepage, s.feed, 'rss', cid, s.lang, true,
      'Feed checked {D}: ' || s.note || ' ' || {q(TAG)}, s.domain, 'feed', 'approved', now(), now())
    RETURNING id INTO sid;
    INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type)
    VALUES (cid, s.name, s.homepage, 'active', s.lang, s.domain, s.source_type) RETURNING id INTO pid;
    INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (pid, s.feed, 'rss');
    UPDATE publisher_submissions SET publisher_id = pid WHERE id = sid;
    INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association, historical_context,
      current_context, confidence, evidence_summary, evidence_sources, classification_date, last_reviewed, evidence_date, review_required)
    VALUES (pid, s.ownership_type, s.owner, s.tags, NULL, s.historical_context, s.current_context, s.confidence,
      s.evidence_summary, s.evidence_sources, DATE '{D}', DATE '{D}', DATE '{D}', s.review_required);
    n := n + 1;
  END LOOP;
  IF n <> {N} THEN RAISE EXCEPTION 'added %, expected {N}', n; END IF;
END $$;
SELECT 'added|' || p.id || '|' || c.iso_code || '|' || p.name || '|' || p.language || '|' || f.feed_url || '|profile ' || array_to_string(e.classification_tags, ',')
       || '/' || e.confidence || '/review ' || e.review_required
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
  JOIN countries c ON c.id = p.country_id JOIN editorial_profiles e ON e.publisher_id = p.id WHERE s.{TAGGED} ORDER BY c.iso_code;
SELECT 'gap|' || count(*) || ' active publishers without a profile'
  FROM publishers p LEFT JOIN editorial_profiles e ON e.publisher_id = p.id WHERE p.feed_status = 'active' AND e.id IS NULL;"""

with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #103 second sources + profiles (data only, MEDIUM). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'rolledback|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};\n")
with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Reverse of apply.sql: removes the {N} publishers with their profiles, feeds, articles and submissions (found by the tag).
{HDR}SET lock_timeout = '5s';
BEGIN;
CREATE TEMP TABLE gone ON COMMIT DROP AS SELECT s.id AS sub, s.publisher_id AS pub FROM publisher_submissions s WHERE s.{TAGGED};
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM gone; IF n <> {N} THEN RAISE EXCEPTION 'found % tagged submissions, expected {N}', n; END IF; END $$;
DELETE FROM articles WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM feeds WHERE publisher_id IN (SELECT pub FROM gone);
DELETE FROM editorial_profiles WHERE publisher_id IN (SELECT pub FROM gone);
UPDATE publisher_submissions SET publisher_id = NULL WHERE id IN (SELECT sub FROM gone);
DELETE FROM publishers WHERE id IN (SELECT pub FROM gone);
DELETE FROM publisher_submissions WHERE id IN (SELECT sub FROM gone);
COMMIT;
SELECT 'reversed|' || count(*) || ' tagged submissions left' FROM publisher_submissions WHERE {TAGGED};
""")
with open('verify.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Read-only, after the first poll. Generated by Build-Sql.py.
SELECT 'feed|' || p.id || '|' || p.name || '|' || f.consecutive_failures || '|' || coalesce(to_char(f.last_success_at, 'HH24:MI'), 'never')
       || '|' || coalesce(left(f.last_error, 60), '-')
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id) || ' art'
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id AND a.published_at IS NULL) || ' undated'
  FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
 WHERE s.{TAGGED} ORDER BY p.id;
SELECT 'ok|' || count(*) FILTER (WHERE f.last_success_at > now() - interval '30 minutes') || ' of {N}'
  FROM publisher_submissions s JOIN feeds f ON f.publisher_id = s.publisher_id WHERE s.{TAGGED};
SELECT 'sample|' || p.name || '|' || to_char(a.published_at, 'YYYY-MM-DD HH24:MI') || '|' || left(a.headline, 70)
  FROM articles a JOIN publishers p ON p.id = a.publisher_id
 WHERE a.id IN (SELECT max(a2.id) FROM articles a2 JOIN publisher_submissions s ON s.publisher_id = a2.publisher_id WHERE s.{TAGGED} GROUP BY a2.publisher_id);
""")
print('ok', N)
