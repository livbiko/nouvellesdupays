# Updated editorial profiles for Journal de Kinshasa (5299) and Journal du Tchad (216), both seeded 2026-09-14 as unknown/low.
# Researched 2026-10-16: both legal notices name Yogam Group SAS (Paris) as publisher, like the 9 sites in release-profiles-yogam;
# Journal du Tchad is alive at journaldutchad.com (its 2026-09-14 profile said the domain no longer resolved; only www. has a bad certificate).
# Same wording as release-profiles-yogam/profiles.py so the network reads consistently.

CYNO = src('https://cynomedia.com/expertises/edition/', 'Cynomedia Africa gère en exclusivité les espaces publicitaires d’un réseau de quinze sites « Journal du/de … » (Cameroun, Tchad, Gabon, Kinshasa, Brazza, Bangui, Malabo, Mali, Niger, Conakry, Abidjan, Faso, Sénégal, Bénin, Togo)', 'self_described')
NONO = src('https://cameroonceo.com/2017/08/21/cyrille-tchuente-nono-ceo-cynomedia-groupe-une-etoile-camerounaise-du-web-panafricain/', 'Cyrille Tchuente Nono, fondateur de Cynomedia (2003) ; YOGAM, entité de Cynomedia, édite journalducameroun.com', 'press')

YOGAM_OTYPE = 'Yogam Group SAS (société privée de droit français, Paris)'
YOGAM_OWNER = 'Yogam Group SAS ; directeur de publication Cyrille T. Nono, fondateur de la régie Cynomedia et éditeur de Journal du Cameroun'
YOGAM_SUMMARY = 'Éditeur et directeur de publication identifiés par les mentions légales du site (consultées le 2026-10-16) et par la page de la régie Cynomedia ; ligne éditoriale non évaluée par une source indépendante.'


def yogam(pid, name, iso, legal_url, pays, chief):
    hist = (f'Déclinaison {pays} du réseau de sites « Journal du/de … » né autour de Journal du Cameroun (2008). '
            'La régie Cynomedia Africa, fondée par Cyrille T. Nono, commercialise en exclusivité les espaces publicitaires des quinze sites du réseau.')
    cur = (f'Site d’information générale sur l’actualité {pays} (politique, économie, société, sport), édité depuis Paris. '
           'Aucune affiliation gouvernementale ou partisane documentée dans les sources consultées ; aucune étude indépendante de sa ligne éditoriale trouvée.')
    legal = src(legal_url, f'Mentions légales : éditeur Yogam Group SAS (RCS Paris 102 832 623), directeur de publication Cyrille T. Nono, {chief}', 'self_described')
    return (pid, name, iso, YOGAM_OTYPE, YOGAM_OWNER, ['commercial_generalist'], None, hist, cur, 'medium', YOGAM_SUMMARY,
            [legal, CYNO, NONO], False)


# publisher_id, name, iso, ownership_type, owner, tags, party, historical, current, confidence, summary, sources, review
P = [
    yogam(5299, 'Journal de Kinshasa', 'CD', 'https://www.journaldekinshasa.com/mentions-legales/', 'congolaise (RDC)', 'rédactrice en chef Cynthiche-Clara Pandi'),
    yogam(216, 'Journal du Tchad', 'TD', 'https://journaldutchad.com/mentions-legales/', 'tchadienne', 'rédacteur en chef Pierre Tahingam'),
]
