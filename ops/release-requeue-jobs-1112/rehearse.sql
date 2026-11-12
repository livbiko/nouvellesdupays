-- REHEARSAL (rolls back). -- Build #241: re-queue the three YouTube discovery jobs that failed 3/3 on 11-12 (40 RW, 43 SD: more than 50 ids in
-- one channels.list call; 41 SO: region SO + language so refused). Job 41 loses its language hint like the new
-- search plan. Fresh attempts, due now (the next hourly run takes them first). Checkpoints kept (43 resumes at query 2).
-- Guards: id + idempotency key + failed. Expected: UPDATE 3.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE discovery_jobs SET status = 'queued', attempts = 0, next_run_at = now(), locked_by = NULL, last_error = NULL,
       params = CASE WHEN id = 41 THEN params || '{"language": null}' ELSE params END
 WHERE (id, idempotency_key) IN ((40, 'youtube:discover:v2:RW:2026-11-11'), (41, 'youtube:discover:v2:SO:2026-11-11'),
                                 (43, 'youtube:discover:v2:SD:2026-11-11'))
   AND status = 'failed';
SELECT id, status, attempts, next_run_at, params->>'language' AS language FROM discovery_jobs WHERE id IN (40, 41, 43) ORDER BY id;
ROLLBACK;
