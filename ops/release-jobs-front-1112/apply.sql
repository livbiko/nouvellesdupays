-- Owner option 2 (11-12 15:10): run the re-queued jobs 40 RW, 41 SO, 43 SD (Build #241) before the 10 jobs queued
-- at 12:25, so the 07:25 UTC run on 11-13 (first with quota left, ~1,010 units) tests the fix. Claim order is
-- next_run_at, id. Guards: id + still queued with 0 attempts. Expected: UPDATE 3.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE discovery_jobs SET next_run_at = '2026-11-12 12:25:00+00'
 WHERE id IN (40, 41, 43) AND status = 'queued' AND attempts = 0;
SELECT c.iso_code, j.id, j.next_run_at FROM discovery_jobs j JOIN countries c ON c.id = j.country_id
 WHERE j.status = 'queued' ORDER BY j.next_run_at, j.id LIMIT 5;
COMMIT;
