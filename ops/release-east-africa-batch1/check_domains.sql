-- Check for domain+country conflicts before applying Build #123 East Africa batch 1.
SELECT p.slug, p.domain, c.iso_code
FROM publishers p JOIN countries c ON c.id = p.country_id
WHERE (c.iso_code = 'KE' AND p.domain IN ('standardmedia.co.ke','capitalfm.africa'))
   OR (c.iso_code = 'TZ' AND p.domain IN ('thecitizen.co.tz','mwananchi.co.tz'))
   OR (c.iso_code = 'RW' AND p.domain IN ('newtimes.co.rw'))
   OR (c.iso_code = 'UG' AND p.domain IN ('watchdoguganda.com'))
   OR (c.iso_code = 'BI' AND p.domain IN ('iwacu-burundi.org'))
   OR (c.iso_code = 'SS' AND p.domain IN ('eyeradio.org'))
   OR (c.iso_code = 'ET' AND p.domain IN ('fanamc.com'));
