# Build #107 - two editorial profile corrections from follow-up research (data only). Generates apply.sql, rehearse.sql, reverse.sql.
# 2026-10-19:
#  - Philippine Daily Inquirer (9049, Build #104): the 2017 sale to Ramon S. Ang (85 %, with Manny Pangilinan 15 %) covered the print
#    company; Inquirer.net - the source of our feed - belongs to Inquirer Interactive, Inc., 69.99 % owned by the Rufino-Prieto family's
#    Inquirer Holdings (print and digital integrated on 2025-07-01). The contradiction that flagged it for review is resolved.
#  - Island Times (8999, Build #94): the 2024 libel suit was brought by Surangel and Sons, the company of President Surangel Whipps Jr's
#    father, days before the general election; withdrawn, and dismissed on 2025-10-23 with the reporting called a matter of public
#    interest. Review flag kept (the publisher holds elected office - owner's editorial call).
# Rollback: the recovery point's full DB backup (two profile rows; no schema change, so no backup table). reverse.sql only re-flags
# both profiles for review.
import json

D = '2026-10-19'


def src(url, note, category):
    return {'url': url, 'note': note, 'category': category, 'accessed_at': D}


def dq(s):
    assert '$$' not in s
    return f'$${s}$$'


UPDATES = [
    (9049, 'Philippine Daily Inquirer',
     dict(owner='Inquirer Interactive, Inc. (Inquirer.net), détenue à 69,99 % par Inquirer Holdings, Inc. de la famille Rufino-Prieto ; '
                'la société du journal imprimé a été rachetée en 2017 par Ramon S. Ang (85 %) et Manny Pangilinan (15 %)',
          current_context="Ligne décrite comme de centre gauche. Boycott publicitaire de cinq mois en 1999 sous Joseph Estrada, attribué au palais "
                          "présidentiel. En 2017, sous la pression de Rodrigo Duterte, la famille Prieto a cédé la société du journal imprimé à "
                          "Ramon S. Ang ; le site Inquirer.net (source de ce flux) est resté à la famille Rufino-Prieto via Inquirer Interactive, "
                          "qui intègre depuis le 1er juillet 2025 l'imprimé et le numérique. Lectorat le plus élevé des quotidiens grand format, "
                          "confiance de 68 % (Reuters Institute 2023).",
          evidence_summary="Fondation, conflits avec les présidents et audience documentés par Wikipédia ; rachat de 2017 (imprimé) confirmé par "
                           "CNN Philippines et le Manila Standard ; propriété d'Inquirer.net par la famille Rufino-Prieto documentée par Rappler "
                           "et Media Ownership Monitor.",
          sources=[src('https://en.wikipedia.org/wiki/Philippine_Daily_Inquirer', 'Fondé en 1985 ; boycott 1999 ; cession à Ramon Ang 2017 ; intégration 2025', 'reference'),
                   src('https://nine.cnnphilippines.com/business/2017/11/22/ramon-ang-complete-philippine-daily-inquirer-deal.html', 'Ramon Ang finalise le rachat (novembre 2017)', 'press'),
                   src('https://philippines.mom-gmr.org/en/media/detail/outlet/inquirernet-4/', 'Inquirer.net : Inquirer Interactive, famille Rufino-Prieto', 'media_research'),
                   src('https://www.rappler.com/business/175896-fast-facts-philippine-daily-inquirer-prieto-family/', 'Structure du groupe Inquirer et famille Prieto', 'press')],
          review=False)),
    (8999, 'Island Times',
     dict(owner=None,
          current_context="Son éditrice, Leilani Reklai, est aussi femme politique (gouverneure de l'État d'Aimeliik depuis 2007) ; aucune ligne "
                          "partisane du journal n'est documentée. En octobre 2024, quelques jours avant les élections générales, Surangel and Sons, "
                          "société du père du président Surangel Whipps Jr., a poursuivi le journal et son éditrice en diffamation pour un article "
                          "fondé sur des documents fiscaux divulgués ; le Palau Media Council y a vu une atteinte à la liberté de la presse. La "
                          "plainte a été retirée et le tribunal l'a classée le 23 octobre 2025 en reconnaissant l'intérêt public de l'article.",
          evidence_summary="Éditrice, périodicité et diffusion documentées par la PINA et Wikipédia ; plainte, lien avec la famille présidentielle "
                           "et classement documentés par RNZ, la PINA et Island Times. Propriété et financement non publiés ; le mandat politique "
                           "de l'éditrice justifie une revue.",
          sources=[src('https://pina.com.fj/pina-members/island-times/', 'Fiche membre PINA : éditrice Leilani Reklai, deux éditions par semaine, plus de 800 exemplaires', 'media_research'),
                   src('https://en.wikipedia.org/wiki/Leilani_Reklai', "Rédactrice en chef de l'Island Times, gouverneure d'Aimeliik depuis 2007", 'reference'),
                   src('https://www.rnz.co.nz/international/pacific-news/532662/palau-newspaper-sued-by-president-s-family-company-ahead-of-general-election', 'Plainte de la société de la famille présidentielle avant les élections (2024)', 'press_freedom'),
                   src('https://islandtimes.org/palau-court-dismisses-defamation-case-against-island-times/', 'Plainte retirée, classée le 23 octobre 2025', 'self_described')],
          review=True)),
]
N = len(UPDATES)
IDS = ', '.join(str(u[0]) for u in UPDATES)
HDR = '\\set ON_ERROR_STOP on\n'

stmts = ''
for pid, name, u in UPDATES:
    owner = f"owner = {dq(u['owner'])}, " if u['owner'] else ''
    stmts += f"""  UPDATE editorial_profiles e SET {owner}current_context = {dq(u['current_context'])}, evidence_summary = {dq(u['evidence_summary'])},
    evidence_sources = {dq(json.dumps(u['sources'], ensure_ascii=False))}::jsonb, review_required = {'true' if u['review'] else 'false'},
    last_reviewed = DATE '{D}', evidence_date = DATE '{D}', updated_at = now()
   FROM publishers p WHERE p.id = e.publisher_id AND e.publisher_id = {pid} AND p.name = {dq(name)};
  GET DIAGNOSTICS k = ROW_COUNT; IF k <> 1 THEN RAISE EXCEPTION '{pid}: % profiles updated, expected 1 - nothing changed', k; END IF;
"""
BODY = f"""SET lock_timeout = '5s';
BEGIN;
DO $do$
DECLARE k int;
BEGIN
  IF EXISTS (SELECT 1 FROM editorial_profiles WHERE publisher_id IN ({IDS}) AND last_reviewed = DATE '{D}' AND evidence_date = DATE '{D}'
             AND jsonb_array_length(evidence_sources) >= 4) THEN RAISE EXCEPTION 'already applied - nothing changed'; END IF;
{stmts}END $do$;
SELECT 'profile|' || e.publisher_id || '|' || array_to_string(e.classification_tags, ',') || '|' || e.confidence || '|review ' || e.review_required
       || '|' || jsonb_array_length(e.evidence_sources) || ' sources|' || left(e.owner, 60)
  FROM editorial_profiles e WHERE e.publisher_id IN ({IDS}) ORDER BY 1;"""

with open('apply.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Build #107 profile corrections (data only). Generated by Build-Sql.py. Reverse: reverse.sql.\n{HDR}{BODY}\nCOMMIT;\n')
with open('rehearse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f'-- Rehearsal of apply.sql: same statements, then ROLLBACK. Generated by Build-Sql.py.\n{HDR}{BODY}\nROLLBACK;\n'
             f"SELECT 'still|' || e.publisher_id || '|review ' || e.review_required || '|' || jsonb_array_length(e.evidence_sources) || ' sources' FROM editorial_profiles e WHERE e.publisher_id IN ({IDS}) ORDER BY 1;\n")
with open('reverse.sql', 'w', newline='\n', encoding='utf-8') as fh:
    fh.write(f"""-- Partial reverse: puts both profiles back under review. Full rollback of the text: restore the two rows from the recovery
-- point's DB backup. Generated by Build-Sql.py.
{HDR}UPDATE editorial_profiles SET review_required = true, updated_at = now() WHERE publisher_id IN ({IDS});
SELECT 'reversed|' || publisher_id || '|review ' || review_required FROM editorial_profiles WHERE publisher_id IN ({IDS}) ORDER BY 1;
""")
print('ok', N)
