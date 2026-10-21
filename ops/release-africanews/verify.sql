-- Verify Build #119 Africanews: publisher active, feed healthy, articles flowing.
SELECT 'publisher|' || p.id || '|slug=' || p.slug || '|' || p.feed_status || '|country=' || c.iso_code
  FROM publishers p JOIN countries c ON c.id = p.country_id WHERE p.slug = 'africanews';
SELECT 'feed|' || f.feed_url || '|enabled=' || f.enabled || '|failures=' || coalesce(f.consecutive_failures::text, '0')
  FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE p.slug = 'africanews';
SELECT 'articles|' || count(*) || ' total|' || count(*) FILTER (WHERE published_at IS NOT NULL) || ' dated|'
       || count(*) FILTER (WHERE published_at > now() - interval '48 hours') || ' last 48h'
  FROM articles a JOIN publishers p ON p.id = a.publisher_id WHERE p.slug = 'africanews';
SELECT 'profile|' || e.ownership_type || '|' || e.owner || '|conf=' || e.confidence
  FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id WHERE p.slug = 'africanews';
SELECT 'social|' || s.platform || '|' || s.handle || '|' || s.verification
  FROM social_accounts s JOIN publishers p ON p.id = s.publisher_id WHERE p.slug = 'africanews';
