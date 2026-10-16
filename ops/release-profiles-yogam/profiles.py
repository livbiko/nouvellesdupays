# Editorial profiles for the "Journal de/du" network and People 243, in the shape Build-Sql.py expects. Researched 2026-10-15/16.
# 11 of the 12 Journal sites and People 243 name Yogam Group SAS (Paris) as publisher in their legal notice;
# Journal du Mali names Impact Média Presse (Bamako). Cynomedia Africa sells the ad space of all 15 network sites.

CYNO = src('https://cynomedia.com/expertises/edition/', 'Cynomedia Africa gère en exclusivité les espaces publicitaires d’un réseau de quinze sites « Journal du/de … » (Cameroun, Tchad, Gabon, Kinshasa, Brazza, Bangui, Malabo, Mali, Niger, Conakry, Abidjan, Faso, Sénégal, Bénin, Togo)', 'self_described')
NONO = src('https://cameroonceo.com/2017/08/21/cyrille-tchuente-nono-ceo-cynomedia-groupe-une-etoile-camerounaise-du-web-panafricain/', 'Cyrille Tchuente Nono, fondateur de Cynomedia (2003) ; YOGAM, entité de Cynomedia, édite journalducameroun.com', 'press')
WIKI_JDM = src('https://en.wikipedia.org/wiki/Le_Journal_du_Mali', 'Attribue à Impact Média Presse, éditeur de Journal du Mali, d’autres sites du réseau dont Journal du Faso et Journal d’Abidjan', 'reference')


def legal(domain, note):
    return src(f'https://www.{domain}/mentions-legales', note, 'self_described')


YOGAM_OTYPE = 'Yogam Group SAS (société privée de droit français, Paris)'
YOGAM_OWNER = 'Yogam Group SAS ; directeur de publication Cyrille T. Nono, fondateur de la régie Cynomedia et éditeur de Journal du Cameroun'
YOGAM_SUMMARY = 'Éditeur et directeur de publication identifiés par les mentions légales du site (consultées le 2026-10-16) et par la page de la régie Cynomedia ; ligne éditoriale non évaluée par une source indépendante.'


def yogam(pid, name, iso, domain, pays, extra_hist='', review=False, extra_src=()):
    hist = (f'Déclinaison {pays} du réseau de sites « Journal du/de … » né autour de Journal du Cameroun (2008). '
            'La régie Cynomedia Africa, fondée par Cyrille T. Nono, commercialise en exclusivité les espaces publicitaires des quinze sites du réseau.' + extra_hist)
    cur = (f'Site d’information générale sur l’actualité {pays} (politique, économie, société, sport), édité depuis Paris. '
           'Aucune affiliation gouvernementale ou partisane documentée dans les sources consultées ; aucune étude indépendante de sa ligne éditoriale trouvée.')
    summ = YOGAM_SUMMARY + (' Attribution contradictoire à vérifier (voir contexte historique).' if review else '')
    return (pid, name, iso, YOGAM_OTYPE, YOGAM_OWNER, ['commercial_generalist'], None, hist, cur, 'medium', summ,
            [legal(domain, 'Mentions légales : éditeur Yogam Group SAS (RCS Paris 102 832 623), directeur de publication Cyrille T. Nono'), CYNO, NONO, *extra_src], review)


ATTRIB = (' Wikipédia attribue ce site à Impact Média Presse, éditeur de Journal du Mali ; '
          'les mentions légales actuelles désignent Yogam Group SAS.')

# publisher_id, name, iso, ownership_type, owner, tags, party, historical, current, confidence, summary, sources, review
P = [
    yogam(8937, 'Journal du Gabon', 'GA', 'journaldugabon.com', 'gabonaise'),
    yogam(8938, 'Journal du Niger', 'NE', 'journalduniger.com', 'nigérienne'),
    yogam(8939, 'Journal de Brazza', 'CG', 'journaldebrazza.com', 'congolaise (Congo-Brazzaville)'),
    yogam(8941, 'Journal du Bénin', 'BJ', 'journaldubenin.com', 'béninoise'),
    yogam(8942, 'Journal du Sénégal', 'SN', 'journaldusenegal.com', 'sénégalaise'),
    yogam(8943, 'Journal de Bangui', 'CF', 'journaldebangui.com', 'centrafricaine'),
    yogam(8944, 'Journal de Conakry', 'GN', 'journaldeconakry.com', 'guinéenne'),
    yogam(8945, 'Journal du Togo', 'TG', 'journaldutogo.com', 'togolaise'),
    yogam(8946, 'Journal de Malabo', 'GQ', 'journaldemalabo.com', 'équato-guinéenne'),
    yogam(8947, 'Journal du Faso', 'BF', 'journaldufaso.com', 'burkinabè', ATTRIB, True, (WIKI_JDM,)),
    yogam(8948, "Journal d'Abidjan", 'CI', 'journaldabidjan.com', 'ivoirienne', ATTRIB, True, (WIKI_JDM,)),
    (8963, 'People 243', 'CD', YOGAM_OTYPE, YOGAM_OWNER, ['specialist'], None,
     'Site « people » du même éditeur que le réseau « Journal du/de … » ; Yogam publie des sites people dans plusieurs pays (People237, People225, People228…).',
     'Actualité des célébrités, de la musique et du divertissement en République démocratique du Congo ; pas de couverture politique suivie. Aucune affiliation gouvernementale ou partisane documentée.',
     'medium', YOGAM_SUMMARY,
     [legal('people243.com', 'Mentions légales : éditeur Yogam Group SAS, directeur de publication Cyrille T. Nono'), NONO], False),
    (8940, 'Journal du Mali', 'ML',
     'Impact Média Presse SARL (société privée malienne, Bamako)',
     'Mahamadou Camara (fondateur et directeur de publication), ancien directeur de cabinet du président Ibrahim Boubacar Keïta et ancien ministre de l’Économie numérique, de l’Information et de la Communication (2014-2015)',
     ['commercial_generalist'], None,
     'Site lancé en 2009 par Mahamadou Camara, également fondateur de l’agence Impact Media Conseil et de la régie d’affichage MIP Mali ; hebdomadaire imprimé lancé en 2015. Le fondateur a été directeur de cabinet du président Keïta puis ministre de la Communication (2014-2015).',
     'Site d’information générale et hebdomadaire, dont la régie Cynomedia Africa commercialise les espaces publicitaires. Mahamadou Camara a été placé en détention en mars 2020 puis en septembre 2021 dans l’affaire de l’avion présidentiel et des équipements militaires achetés en 2014 ; l’issue judiciaire n’a pas été vérifiée. Aucune étude indépendante de la ligne éditoriale actuelle trouvée.',
     'medium', 'Éditeur et directeur de publication identifiés par les mentions légales et Wikipédia ; parcours politique et poursuites du fondateur documentés par Wikipédia et l’Agence Anadolu ; ligne éditoriale actuelle non évaluée.',
     [src('https://www.journaldumali.com/mentions-legales', 'Mentions légales : éditeur Impact Média Presse (Bamako), directeur de publication Mahamadou Camara', 'self_described'),
      src('https://en.wikipedia.org/wiki/Le_Journal_du_Mali', 'Propriété d’Impact Média Presse SARL, fondée par Mahamadou Camara (2009)', 'reference'),
      src('https://fr.wikipedia.org/wiki/Mahamadou_Camara', 'Ancien directeur de cabinet du président et ministre (2014-2015) ; fondateur de journaldumali.com, Impact Media Conseil et MIP Mali', 'reference'),
      src('https://www.aa.com.tr/fr/afrique/mali-lancien-ministre-de-la-communication-mahamadou-camara-d%C3%A9f%C3%A9r%C3%A9-en-prison/2373458', 'Placé en détention le 23 septembre 2021 (complicité de favoritisme, affaire de l’avion présidentiel)', 'press'),
      CYNO],
     True),
]
