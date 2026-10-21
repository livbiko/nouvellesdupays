-- Verify script for Build #120 West Africa batch 1.
\set ON_ERROR_STOP on

-- Publisher + feed status
SELECT 'publisher|' || p.slug || '|' || p.feed_status || '|' || c.iso_code || '|' || p.language
  FROM publishers p JOIN countries c ON c.id = p.country_id
  WHERE p.slug IN (
    'aip-ci','connectionivoirienne','myjoyonline','adom-online','3news-ghana',
    'premium-times-nigeria','tribune-online-nigeria','sahara-reporters',
    'rewmi','xibaaru','guineematin','guineenews','sierra-leone-telegraph','lefaso'
  )
  ORDER BY c.iso_code, p.slug;

-- Feed count
SELECT 'feeds|' || count(*) || ' feeds for batch publishers'
  FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug IN (
    'aip-ci','connectionivoirienne','myjoyonline','adom-online','3news-ghana',
    'premium-times-nigeria','tribune-online-nigeria','sahara-reporters',
    'rewmi','xibaaru','guineematin','guineenews','sierra-leone-telegraph','lefaso'
  );

-- Editorial profile count
SELECT 'profiles|' || count(*) || ' editorial profiles for batch publishers'
  FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id
  WHERE p.slug IN (
    'aip-ci','connectionivoirienne','myjoyonline','adom-online','3news-ghana',
    'premium-times-nigeria','tribune-online-nigeria','sahara-reporters',
    'rewmi','xibaaru','guineematin','guineenews','sierra-leone-telegraph','lefaso'
  );

-- Article counts per publisher (post worker poll)
SELECT 'articles|' || p.slug || '|' || count(a.id) || ' articles'
  FROM publishers p
  LEFT JOIN articles a ON a.publisher_id = p.id
  WHERE p.slug IN (
    'aip-ci','connectionivoirienne','myjoyonline','adom-online','3news-ghana',
    'premium-times-nigeria','tribune-online-nigeria','sahara-reporters',
    'rewmi','xibaaru','guineematin','guineenews','sierra-leone-telegraph','lefaso'
  )
  GROUP BY p.slug ORDER BY p.slug;

-- Country coverage summary
SELECT 'coverage|' || c.iso_code || '|' || count(p.id) FILTER (WHERE p.feed_status='active') || ' active'
  FROM countries c JOIN publishers p ON p.country_id = c.id
  WHERE c.iso_code IN ('CI','GH','NG','SN','GN','SL','BF')
  GROUP BY c.iso_code ORDER BY c.iso_code;
