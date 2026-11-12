-- Reverse of Build #241's re-queue: only while the jobs have not run again (status queued, attempts 0).
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE discovery_jobs SET status = 'failed', attempts = 3,
       params = CASE WHEN id = 41 THEN params || '{"language": "so"}' ELSE params END,
       last_error = CASE WHEN id = 41 THEN 'YouTube search HTTP 400: badRequest Request contains an invalid argument. [region SO, language so, query "Mogadishu"]'
                         ELSE 'YouTube channels HTTP 400: invalidFilters (parameter parameters.) The request specifies an invalid filter parameter. [51 id(s)]' END
 WHERE id IN (40, 41, 43) AND status = 'queued' AND attempts = 0;
SELECT id, status, attempts, params->>'language' AS language FROM discovery_jobs WHERE id IN (40, 41, 43) ORDER BY id;
COMMIT;
