-- Build #224: the 10 YouTube discovery jobs queued before Build #223 run as search v3 (keep channels with no declared country).
-- Guard: exactly these 10 jobs, all queued, all v2; otherwise nothing changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM discovery_jobs
   WHERE id BETWEEN 40 AND 49 AND agent = 'youtube' AND job_type = 'discover' AND status = 'queued' AND params->>'v' = '2';
  IF n <> 10 THEN RAISE EXCEPTION 'guard: expected 10 queued v2 jobs (ids 40-49), found %', n; END IF;
END $$;
UPDATE discovery_jobs SET params = jsonb_set(params, '{v}', '3')
 WHERE id BETWEEN 40 AND 49 AND status = 'queued' AND params->>'v' = '2';
SELECT j.id, c.iso_code, j.status, j.params->>'v' AS v, j.params->'queries' AS queries FROM discovery_jobs j
  JOIN countries c ON c.id = j.country_id WHERE j.id BETWEEN 40 AND 49 ORDER BY j.id;
ROLLBACK;
