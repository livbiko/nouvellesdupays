-- Verify script for Build #123 East Africa batch 1 (9 publishers).
\set ON_ERROR_STOP on

SELECT 'publisher|' || p.slug || '|' || p.feed_status || '|' || c.iso_code || '|' || p.language
  FROM publishers p JOIN countries c ON c.id = p.country_id
  WHERE p.slug IN (
    'standard-media-kenya','capital-fm-kenya',
    'citizen-tanzania','mwananchi-tz',
    'new-times-rwanda','watchdog-uganda',
    'iwacu-burundi','eye-radio','fana-ethiopia'
  )
  ORDER BY c.iso_code, p.slug;

SELECT 'feeds|' || count(*) || ' feeds for batch publishers'
  FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug IN (
    'standard-media-kenya','capital-fm-kenya',
    'citizen-tanzania','mwananchi-tz',
    'new-times-rwanda','watchdog-uganda',
    'iwacu-burundi','eye-radio','fana-ethiopia'
  );

SELECT 'profiles|' || count(*) || ' editorial profiles for batch publishers'
  FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN (
    'standard-media-kenya','capital-fm-kenya',
    'citizen-tanzania','mwananchi-tz',
    'new-times-rwanda','watchdog-uganda',
    'iwacu-burundi','eye-radio','fana-ethiopia'
  );

SELECT 'articles|' || p.slug || '|' || count(a.id) || ' articles'
  FROM publishers p
  LEFT JOIN articles a ON a.publisher_id = p.id
  WHERE p.slug IN (
    'standard-media-kenya','capital-fm-kenya',
    'citizen-tanzania','mwananchi-tz',
    'new-times-rwanda','watchdog-uganda',
    'iwacu-burundi','eye-radio','fana-ethiopia'
  )
  GROUP BY p.slug ORDER BY p.slug;

SELECT 'coverage|' || c.iso_code || '|' || count(p.id) FILTER (WHERE p.feed_status='active') || ' active'
  FROM countries c JOIN publishers p ON p.country_id = c.id
  WHERE c.iso_code IN ('KE','TZ','RW','UG','BI','SS','ET')
  GROUP BY c.iso_code ORDER BY c.iso_code;
