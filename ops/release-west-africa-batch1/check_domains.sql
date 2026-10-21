SELECT p.slug, p.domain, c.iso_code
FROM publishers p JOIN countries c ON c.id = p.country_id
WHERE (c.iso_code = 'CI' AND p.domain IN ('aip.ci','connectionivoirienne.net'))
   OR (c.iso_code = 'GH' AND p.domain IN ('adomonline.com','3news.com'))
   OR (c.iso_code = 'NG' AND p.domain IN ('premiumtimesng.com','tribuneonlineng.com','saharareporters.com'))
   OR (c.iso_code = 'SN' AND p.domain IN ('rewmi.com','xibaaru.sn'))
   OR (c.iso_code = 'BF' AND p.domain IN ('lefaso.net'));
