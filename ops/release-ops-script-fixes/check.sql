-- Read-only smoke test for the fixed Sql.ps1.
\set ON_ERROR_STOP on
SET statement_timeout = '30s';
SELECT 'check|profiles|' || count(*) FROM editorial_profiles;
SELECT 'check|gap|' || count(*) FROM publishers p LEFT JOIN editorial_profiles e ON e.publisher_id = p.id WHERE p.feed_status = 'active' AND e.id IS NULL;
