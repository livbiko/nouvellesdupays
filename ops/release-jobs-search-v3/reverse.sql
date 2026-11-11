-- Build #224 reverse: jobs 40-49 still waiting go back to search v2 (candidates already added stay for review).
BEGIN;
UPDATE discovery_jobs SET params = jsonb_set(params, '{v}', '2')
 WHERE id BETWEEN 40 AND 49 AND status = 'queued' AND params->>'v' = '3';
COMMIT;
