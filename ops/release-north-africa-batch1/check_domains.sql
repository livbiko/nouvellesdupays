-- Check for domain+country conflicts before applying Build #124 North Africa batch 1.
SELECT p.slug, p.domain, c.iso_code
FROM publishers p JOIN countries c ON c.id = p.country_id
WHERE (c.iso_code = 'MA' AND p.domain IN ('hespress.com','lavieeco.com'))
   OR (c.iso_code = 'DZ' AND p.domain IN ('tsa-algerie.com'))
   OR (c.iso_code = 'TN' AND p.domain IN ('businessnews.com.tn','nawaat.org'))
   OR (c.iso_code = 'LY' AND p.domain IN ('libyaherald.com'))
   OR (c.iso_code = 'SD' AND p.domain IN ('sudantribune.net'));
