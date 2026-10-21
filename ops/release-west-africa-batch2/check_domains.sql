-- Check for domain+country conflicts in Batch 2 publishers
SELECT p.slug, p.domain, c.iso_code
FROM publishers p JOIN countries c ON c.id = p.country_id
WHERE (c.iso_code = 'NE' AND p.domain IN ('tamtaminfo.com','journalduniger.com'))
   OR (c.iso_code = 'LR' AND p.domain IN ('thenewdawnliberia.com'))
   OR (c.iso_code = 'GM' AND p.domain IN ('thepoint.gm'))
   OR (c.iso_code = 'MR' AND p.domain IN ('saharamedias.net'))
   OR (c.iso_code = 'TG' AND p.domain IN ('icilome.com'))
   OR (c.iso_code = 'BJ' AND p.domain IN ('beninwebtv.bj','journaldubenin.com'))
   OR (c.iso_code = 'CV' AND p.domain IN ('expressodasilhas.cv'));
