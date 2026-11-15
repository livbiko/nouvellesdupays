-- Build #258 (MEDIUM, owner: "approve Build #258"): Côte d'Ivoire (brief priority 1) had 0 creator candidates - its
-- three generic searches (job 50) saw 146 channels and added 1. Queue 3 targeted discover jobs (3 queries each, the
-- worker's MAX_QUERIES) with the brief's named creators and Ivorian content terms, same rules as job 50 (v3, fr,
-- min 10000 subscribers, declared-foreign channels refused). next_run_at before the queued jobs so they run first.
-- About 900 of the 8000 daily YouTube units. Reverse: reverse.sql (cancels any that has not run).
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO discovery_jobs (agent, job_type, country_id, params, idempotency_key, next_run_at)
SELECT 'youtube', 'discover', c.id, q.params::jsonb, q.k, '2026-11-15 14:00:00+00'
  FROM countries c,
       (VALUES ('{"v": 3, "queries": ["Le Samouraï", "État d''Urgence", "Franklin Nyamsi"], "language": "fr", "min_subscribers": 10000}', 'youtube:discover:v3:CI:targeted-1:2026-11-15'),
               ('{"v": 3, "queries": ["Bantu Media", "humoriste ivoirien", "actualité ivoirienne"], "language": "fr", "min_subscribers": 10000}', 'youtube:discover:v3:CI:targeted-2:2026-11-15'),
               ('{"v": 3, "queries": ["zouglou", "coupé-décalé", "influenceur ivoirien"], "language": "fr", "min_subscribers": 10000}', 'youtube:discover:v3:CI:targeted-3:2026-11-15')) q(params, k)
 WHERE c.iso_code = 'CI';
DO $$ BEGIN
  IF (SELECT count(*) FROM discovery_jobs WHERE idempotency_key LIKE 'youtube:discover:v3:CI:targeted-%:2026-11-15') <> 3 THEN
    RAISE EXCEPTION 'expected 3 targeted CI jobs'; END IF;
END $$;
SELECT id, status, next_run_at, params->'queries' FROM discovery_jobs WHERE idempotency_key LIKE 'youtube:discover:v3:CI:targeted-%' ORDER BY id;
ROLLBACK;
